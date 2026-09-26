import { describe, it, expect, beforeEach } from 'vitest';
import { killSwitch } from '../src/core/kill-switch';
import { filesSkill } from '../src/skills/files/files-skill';
import { computerControlSkill } from '../src/skills/computer-control';
import { skillRegistry } from '../src/skills/skill-registry';
import '../src/skills';

describe('Phase 3 Stage 4: Safety & Human Approval Policies', () => {
  beforeEach(() => {
    killSwitch.disengage();
  });

  describe('Risk Tiering & Escalation Policy', () => {
    it('maintains ComputerSkill as CRITICAL risk tier requiring confirmation', () => {
      expect(computerControlSkill.riskLevel).toBe('CRITICAL');
      expect(computerControlSkill.approvalRequirement).toBe('typed-phrase');
    });

    it('escalates FilesSkill to HIGH risk when moving files to Trash', async () => {
      expect(filesSkill.riskLevel).toBe('MEDIUM');
      // When move_to_trash is executed, skill escalates internally to HIGH
      const result = await skillRegistry.dispatch('files_skill', {
        action: 'move_to_trash',
        path: '/Users/user/Downloads/scratch.txt',
      }, {
        sessionId: 'session-safety-1',
        riskTier: 'HIGH',
      });

      expect(result.success).toBe(true);
      expect(filesSkill.riskLevel).toBe('HIGH');
    });

    it('escalates FilesSkill to HIGH risk on batch file operations (> 3 files)', async () => {
      const result = await skillRegistry.dispatch('files_skill', {
        action: 'find_files',
        fileCount: 10,
      }, {
        sessionId: 'session-safety-2',
        riskTier: 'HIGH',
      });

      expect(result.success).toBe(true);
      expect(filesSkill.riskLevel).toBe('HIGH');
    });
  });

  describe('Emergency Stop Kill Switch Intercepts All Tiers', () => {
    it('blocks execution across all risk tiers when kill switch is engaged', async () => {
      killSwitch.engage('Manual user trigger', 'voice-emergency-stop');

      expect(killSwitch.isEngaged()).toBe(true);

      // LOW tier attempt
      const lowRes = await skillRegistry.dispatch('media_skill', {
        action: 'set_volume',
        volumeLevel: 20,
      }, { sessionId: 'session-kill-low' });
      expect(lowRes.success).toBe(false);
      expect(lowRes.error).toContain('Emergency Kill Switch is engaged');

      // MEDIUM tier attempt
      const medRes = await skillRegistry.dispatch('files_skill', {
        action: 'find_files',
        query: 'test',
      }, { sessionId: 'session-kill-med' });
      expect(medRes.success).toBe(false);
      expect(medRes.error).toContain('Emergency Kill Switch is engaged');

      // CRITICAL tier attempt
      const critRes = await skillRegistry.dispatch('computer_control', {
        action: 'click',
        x: 100,
        y: 100,
      }, { sessionId: 'session-kill-crit' });
      expect(critRes.success).toBe(false);
      expect(critRes.error).toContain('Emergency Kill Switch is engaged');
    });

    it('restores normal execution after kill switch disengage', async () => {
      killSwitch.engage('Test engage', 'user-ui');
      expect(killSwitch.isEngaged()).toBe(true);

      killSwitch.disengage();
      expect(killSwitch.isEngaged()).toBe(false);

      const res = await skillRegistry.dispatch('media_skill', {
        action: 'set_volume',
        volumeLevel: 50,
      }, { sessionId: 'session-kill-restore' });

      expect(res.error).toBeUndefined();
      expect(res.success).toBe(true);
    });
  });
});
