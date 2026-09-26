import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCommandStore } from '../src/state/useCommandStore';
import { useAuditStore } from '../src/state/useAuditStore';
import { skillRegistry } from '../src/skills';
import { killSwitch } from '../src/core/kill-switch';
import { ActionPlan } from '../src/types/action-plan';
import { nativeBridge } from '../src/adapters/native/tauri-bridge';

describe('Phase 4A: Unified Skill Dispatch & Dataflow Execution', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    killSwitch.disengage();
    useCommandStore.setState({
      currentPlan: null,
      assistantResponse: null,
      isExecuting: false,
      isDryRun: false,
    });
    useAuditStore.setState({
      executionLogs: [],
      approvalEvents: [],
      entries: [],
      tradeJournal: [],
    });
  });

  describe('Unified Dispatch via SkillRegistry', () => {
    it('dispatches registered files_skill and updates action status to COMPLETED', async () => {
      vi.spyOn(nativeBridge, 'execCommand').mockResolvedValue({
        success: true,
        command: 'mdfind -name "pdf"',
        stdout: '/Users/test/Downloads/doc1.pdf',
        stderr: '',
        exitCode: 0,
      });

      const plan: ActionPlan = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        userPrompt: 'Find files in Downloads',
        interpretedIntent: 'Search files',
        overallRisk: 'LOW',
        isDryRun: false,
        status: 'AWAITING_APPROVAL',
        actions: [
          {
            id: 'action-step-1',
            skillId: 'files_skill',
            title: 'Find PDF files in Downloads',
            description: 'Locates PDF documents',
            riskLevel: 'LOW',
            params: { action: 'find_files', path: '~/Downloads', query: 'pdf' },
            status: 'PENDING_APPROVAL',
            requiresTypedConfirmation: false,
            expectedEffect: 'Files located',
            dryRunSupported: true,
          },
        ],
      };

      useCommandStore.setState({ currentPlan: plan });

      await useCommandStore.getState().approveAction('action-step-1');

      const updatedPlan = useCommandStore.getState().currentPlan;
      expect(updatedPlan).not.toBeNull();
      const action = updatedPlan!.actions.find((a) => a.id === 'action-step-1');
      expect(action?.status).toBe('COMPLETED');
      expect(action?.output).toBeDefined();

      const audit = useAuditStore.getState();
      expect(audit.executionLogs.length).toBe(1);
      expect(audit.executionLogs[0].status).toBe('SUCCESS');
      expect(audit.executionLogs[0].skillId).toBe('files_skill');
    });

    it('records FAILED status when registered skill execution encounters an error', async () => {
      vi.spyOn(nativeBridge, 'execCommand').mockRejectedValue(new Error('Filesystem permission denied'));

      const plan: ActionPlan = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        userPrompt: 'Find files error scenario',
        interpretedIntent: 'Failing action',
        overallRisk: 'LOW',
        isDryRun: false,
        status: 'AWAITING_APPROVAL',
        actions: [
          {
            id: 'action-failing-1',
            skillId: 'files_skill',
            title: 'Find files with error',
            description: 'Failing step',
            riskLevel: 'LOW',
            params: { action: 'find_files', path: '~/Downloads' },
            status: 'PENDING_APPROVAL',
            requiresTypedConfirmation: false,
            expectedEffect: 'Files located',
            dryRunSupported: true,
          },
        ],
      };

      useCommandStore.setState({ currentPlan: plan });

      await useCommandStore.getState().approveAction('action-failing-1');

      const updatedPlan = useCommandStore.getState().currentPlan;
      const action = updatedPlan!.actions.find((a) => a.id === 'action-failing-1');
      expect(action?.status).toBe('FAILED');
      expect(action?.error).toBeDefined();

      const audit = useAuditStore.getState();
      expect(audit.executionLogs.length).toBe(1);
      expect(audit.executionLogs[0].status).toBe('ERROR');
    });

    it('rejects CRITICAL risk action if typed phrase does not match', async () => {
      const dispatchSpy = vi.spyOn(skillRegistry, 'dispatch');

      const plan: ActionPlan = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        userPrompt: 'Format disk',
        interpretedIntent: 'Critical action',
        overallRisk: 'CRITICAL',
        isDryRun: false,
        status: 'AWAITING_APPROVAL',
        actions: [
          {
            id: 'action-crit-1',
            skillId: 'computer_control',
            title: 'Dangerous Operation',
            description: 'Critical action requiring phrase',
            riskLevel: 'CRITICAL',
            params: { action: 'open_app', appName: 'Terminal' },
            status: 'PENDING_APPROVAL',
            requiresTypedConfirmation: true,
            confirmationPhrase: 'CONFIRM DANGEROUS',
            expectedEffect: 'Opened app',
            dryRunSupported: true,
          },
        ],
      };

      useCommandStore.setState({ currentPlan: plan });

      // Wrong phrase passed
      await useCommandStore.getState().approveAction('action-crit-1', 'WRONG PHRASE');

      const updatedPlan = useCommandStore.getState().currentPlan;
      const action = updatedPlan!.actions.find((a) => a.id === 'action-crit-1');
      expect(action?.status).toBe('PENDING_APPROVAL'); // Did not execute!
      expect(dispatchSpy).not.toHaveBeenCalled();
      expect(useCommandStore.getState().assistantResponse).toContain('Confirmation phrase mismatch');
    });

    it('blocks execution when Emergency Stop kill switch is engaged', async () => {
      killSwitch.engage('User pressed stop', 'user-ui');

      const plan: ActionPlan = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        userPrompt: 'Test kill switch',
        interpretedIntent: 'Halted action',
        overallRisk: 'LOW',
        isDryRun: false,
        status: 'AWAITING_APPROVAL',
        actions: [
          {
            id: 'action-kill-1',
            skillId: 'system_skill',
            title: 'Query volume',
            description: 'Read system volume',
            riskLevel: 'LOW',
            params: { action: 'get_volume' },
            status: 'PENDING_APPROVAL',
            requiresTypedConfirmation: false,
            expectedEffect: 'Volume queried',
            dryRunSupported: true,
          },
        ],
      };

      useCommandStore.setState({ currentPlan: plan });

      await useCommandStore.getState().approveAction('action-kill-1');

      const updatedPlan = useCommandStore.getState().currentPlan;
      const action = updatedPlan!.actions.find((a) => a.id === 'action-kill-1');
      expect(action?.status).toBe('FAILED');
      expect(action?.error).toContain('Kill Switch');
    });
  });

  describe('Multi-Step Variable Piping / Dataflow', () => {
    it('pipes step 1 output into step 2 parameters dynamically', async () => {
      vi.spyOn(nativeBridge, 'execCommand').mockResolvedValue({
        success: true,
        command: 'mdfind -name "invoice"',
        stdout: '/Users/test/Downloads/invoice-2026.pdf',
        stderr: '',
        exitCode: 0,
      });
      const createSpy = vi.spyOn(nativeBridge, 'createFile').mockResolvedValue(true);

      const plan: ActionPlan = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        userPrompt: 'Find invoices and summarize in report',
        interpretedIntent: 'Compound multi-step pipeline',
        overallRisk: 'MEDIUM',
        isDryRun: false,
        status: 'AWAITING_APPROVAL',
        actions: [
          {
            id: 'step_1',
            skillId: 'files_skill',
            title: 'Find Invoices',
            description: 'Search for invoice PDFs',
            riskLevel: 'LOW',
            params: { action: 'find_files', path: '~/Downloads', query: 'invoice' },
            status: 'PENDING_APPROVAL',
            requiresTypedConfirmation: false,
            expectedEffect: 'Files found',
            dryRunSupported: true,
          },
          {
            id: 'step_2',
            skillId: 'document_skill',
            title: 'Create Summary Document',
            description: 'Write discovered path to document',
            riskLevel: 'MEDIUM',
            params: {
              action: 'create_document',
              path: '~/Documents/Invoice-Summary.txt',
              content: 'Target file is: {{step_1.output.files[0]}}',
            },
            status: 'PENDING_APPROVAL',
            requiresTypedConfirmation: false,
            expectedEffect: 'Document created',
            dryRunSupported: true,
          },
        ],
      };

      useCommandStore.setState({ currentPlan: plan });

      // Execute Step 1
      await useCommandStore.getState().approveAction('step_1');
      const planAfterStep1 = useCommandStore.getState().currentPlan!;
      expect(planAfterStep1.actions[0].status).toBe('COMPLETED');
      expect(planAfterStep1.actions[0].output).toBeDefined();

      // Execute Step 2: Should resolve {{step_1.output.files[0]}} to '/Users/test/Downloads/invoice-2026.pdf'
      await useCommandStore.getState().approveAction('step_2');
      const planAfterStep2 = useCommandStore.getState().currentPlan!;
      expect(planAfterStep2.actions[1].status).toBe('COMPLETED');

      // Verify that nativeBridge.createFile received the resolved parameter string!
      expect(createSpy).toHaveBeenCalledWith(
        '~/Documents/Invoice-Summary.txt',
        'Target file is: /Users/test/Downloads/invoice-2026.pdf',
        false
      );
    });
  });
});
