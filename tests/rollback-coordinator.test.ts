import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rollbackCoordinator, ExecutedStepRecord } from '../src/core/workflow/rollback-coordinator';
import { skillRegistry } from '../src/skills/skill-registry';
import { killSwitch } from '../src/core/kill-switch';
import { useAuditStore } from '../src/state/useAuditStore';
import { nativeBridge } from '../src/adapters/native/tauri-bridge';

describe('Phase 4B: Step Rollback & Compensating Action Coordinator', () => {
  beforeEach(() => {
    killSwitch.disengage();
    vi.restoreAllMocks();
    useAuditStore.getState().clearLogs();
  });

  describe('Compensating Action Derivation', () => {
    it('derives move_to_trash compensating action for create_file', () => {
      const comp = rollbackCoordinator.deriveCompensatingAction({
        id: 'step-create-1',
        title: 'Create note',
        skillId: 'files_skill',
        action: 'create_file',
        params: { path: '/Users/test/Documents/note.txt', content: 'test' },
      });

      expect(comp.isReversible).toBe(true);
      expect(comp.skillId).toBe('files_skill');
      expect(comp.action).toBe('move_to_trash');
      expect(comp.params.path).toBe('/Users/test/Documents/note.txt');
    });

    it('derives reversed move_file compensating action for move_file', () => {
      const comp = rollbackCoordinator.deriveCompensatingAction({
        id: 'step-move-1',
        title: 'Move download',
        skillId: 'files_skill',
        action: 'move_file',
        params: {
          path: '/Users/test/Downloads/doc.pdf',
          newPath: '/Users/test/Documents/doc.pdf',
        },
      });

      expect(comp.isReversible).toBe(true);
      expect(comp.skillId).toBe('files_skill');
      expect(comp.action).toBe('move_file');
      expect(comp.params.path).toBe('/Users/test/Documents/doc.pdf');
      expect(comp.params.newPath).toBe('/Users/test/Downloads/doc.pdf');
    });

    it('marks financial trading actions as non-reversible', () => {
      const comp = rollbackCoordinator.deriveCompensatingAction({
        id: 'step-trade-1',
        title: 'Place Binance spot order',
        skillId: 'binance_spot_order',
        action: 'execute_order',
        params: { symbol: 'BTCUSDT', side: 'BUY' },
      });

      expect(comp.isReversible).toBe(false);
    });

    it('marks outbound URL opens as non-reversible', () => {
      const comp = rollbackCoordinator.deriveCompensatingAction({
        id: 'step-url-1',
        title: 'Open website',
        skillId: 'open_url',
        action: 'open_url',
        params: { url: 'https://example.com' },
      });

      expect(comp.isReversible).toBe(false);
    });
  });

  describe('LIFO Rollback Execution', () => {
    it('executes compensating actions in reverse order (LIFO) and audits execution', async () => {
      const executionOrder: string[] = [];

      vi.spyOn(skillRegistry, 'dispatch').mockImplementation(async (skillId, params: any) => {
        executionOrder.push(`${skillId}:${params?.action || 'action'}`);
        return { success: true, durationMs: 5 };
      });

      const completedSteps: ExecutedStepRecord[] = [
        {
          id: 'step-1',
          title: 'Create first file',
          skillId: 'files_skill',
          action: 'create_file',
          params: { path: '/Users/test/Documents/first.txt' },
          status: 'COMPLETED',
        },
        {
          id: 'step-2',
          title: 'Move second file',
          skillId: 'files_skill',
          action: 'move_file',
          params: {
            path: '/Users/test/Downloads/second.txt',
            newPath: '/Users/test/Documents/second.txt',
          },
          status: 'COMPLETED',
        },
        {
          id: 'step-3',
          title: 'Send external notification',
          skillId: 'open_url',
          action: 'open_url',
          params: { url: 'https://webhook.site/test' },
          status: 'COMPLETED',
        },
      ];

      const result = await rollbackCoordinator.rollback(completedSteps, 'Step 4 failed');

      expect(result.success).toBe(true);
      // Step 3 (open_url) is non-reversible -> skipped
      expect(result.skippedSteps).toContain('step-3');

      // LIFO: step-2 rolled back first, then step-1
      expect(result.rolledBackSteps).toEqual(['step-2', 'step-1']);
      expect(executionOrder).toEqual([
        'files_skill:move_file',
        'files_skill:move_to_trash',
      ]);

      // Audit logs were recorded for the rollback actions
      const logs = useAuditStore.getState().executionLogs;
      expect(logs.length).toBe(2);
      expect(logs[0].commandExecuted).toContain('[ROLLBACK]');
    });

    it('blocks rollback of file operations targeting forbidden paths', async () => {
      const forbiddenStep: ExecutedStepRecord = {
        id: 'step-forbidden',
        title: 'Tamper attempt',
        skillId: 'files_skill',
        action: 'create_file',
        params: { path: '/System/Library/CoreServices/malicious.txt' },
        status: 'COMPLETED',
      };

      const result = await rollbackCoordinator.rollback([forbiddenStep], 'Abort');
      expect(result.success).toBe(false);
      expect(result.failedRollbacks.length).toBe(1);
      expect(result.failedRollbacks[0].error).toContain('failed safety check');
    });

    it('halts rollback immediately when kill switch is engaged', async () => {
      const steps: ExecutedStepRecord[] = [
        {
          id: 'step-a',
          title: 'File A',
          skillId: 'files_skill',
          action: 'create_file',
          params: { path: '/Users/test/Downloads/a.txt' },
          status: 'COMPLETED',
        },
        {
          id: 'step-b',
          title: 'File B',
          skillId: 'files_skill',
          action: 'create_file',
          params: { path: '/Users/test/Downloads/b.txt' },
          status: 'COMPLETED',
        },
      ];

      // Engage kill switch before rollback
      killSwitch.engage('Safety alert');

      const result = await rollbackCoordinator.rollback(steps, 'Emergency halt');
      expect(result.success).toBe(false);
      expect(result.rolledBackSteps.length).toBe(0);
      expect(result.failedRollbacks[0].error).toContain('Emergency Kill Switch engaged');
    });
  });
});
