import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { skillRegistry, SkillRegistry } from '../src/skills/skill-registry';
import { BaseSkill } from '../src/skills/base-skill';
import { computerControlSkill } from '../src/skills/computer-control';
import { killSwitch } from '../src/core/kill-switch';
import { SkillExecutionContext, SkillExecutionResult } from '../src/types/skills';

// Mock custom skill extending BaseSkill for test coverage
class MockEchoSkill extends BaseSkill<{ message: string }, { echo: string }> {
  public id = 'mock_echo';
  public name = 'Mock Echo Skill';
  public description = 'Echoes back messages for testing';
  public riskLevel = 'LOW' as const;
  public inputSchema = z.object({ message: z.string().min(1) });

  protected async executeInternal(
    input: { message: string },
    _context: SkillExecutionContext
  ): Promise<SkillExecutionResult<{ echo: string }>> {
    return {
      success: true,
      data: { echo: `ECHO: ${input.message}` },
      stdout: `Echoed: ${input.message}`,
      durationMs: 5,
    };
  }
}

describe('Phase 3 Stage 1: Skill Registry & Base Skill Architecture', () => {
  beforeEach(() => {
    killSwitch.disengage();
  });

  describe('SkillRegistry Management', () => {
    it('registers, looks up, and lists skills', () => {
      const registry = new SkillRegistry();
      registry.clear();
      const mockSkill = new MockEchoSkill();

      expect(registry.hasSkill('mock_echo')).toBe(false);
      registry.registerSkill(mockSkill);
      expect(registry.hasSkill('mock_echo')).toBe(true);

      const retrieved = registry.getSkill('mock_echo');
      expect(retrieved?.name).toBe('Mock Echo Skill');
      expect(registry.listSkills().length).toBe(1);

      const unregistered = registry.unregisterSkill('mock_echo');
      expect(unregistered).toBe(true);
      expect(registry.hasSkill('mock_echo')).toBe(false);
    });

    it('has ComputerSkill pre-registered in the global skillRegistry', () => {
      expect(skillRegistry.hasSkill('computer_control')).toBe(true);
      const skill = skillRegistry.getSkill('computer_control');
      expect(skill?.name).toBe('macOS Autonomous Computer Control Engine');
      expect(skill?.id).toBe('computer_control');
    });

    it('dispatches execution to registered skills', async () => {
      const registry = new SkillRegistry();
      registry.registerSkill(new MockEchoSkill());

      const context: SkillExecutionContext = {
        isDryRun: false,
        userPrompt: 'Echo hello world',
        killSwitchActive: () => false,
      };

      const result = await registry.dispatch('mock_echo', { message: 'hello world' }, context);
      expect(result.success).toBe(true);
      expect(result.data?.echo).toBe('ECHO: hello world');
    });

    it('dispatches dry-run execution when isDryRun is true', async () => {
      const registry = new SkillRegistry();
      registry.registerSkill(new MockEchoSkill());

      const context: SkillExecutionContext = {
        isDryRun: true,
        userPrompt: 'Dry run echo',
        killSwitchActive: () => false,
      };

      const result = await registry.dispatch('mock_echo', { message: 'dry run' }, context);
      expect(result.success).toBe(true);
      expect(result.message).toContain('[DRY RUN]');
    });

    it('fails closed when dispatching to an unknown skill', async () => {
      const registry = new SkillRegistry();
      const context: SkillExecutionContext = {
        isDryRun: false,
        userPrompt: 'unknown',
        killSwitchActive: () => false,
      };

      const result = await registry.dispatch('nonexistent_skill', {}, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found in registry');
    });

    it('blocks execution when Emergency Kill Switch is active', async () => {
      const registry = new SkillRegistry();
      registry.registerSkill(new MockEchoSkill());

      killSwitch.engage('Test emergency stop', 'user-ui');

      const context: SkillExecutionContext = {
        isDryRun: false,
        userPrompt: 'Emergency test',
        killSwitchActive: () => true,
      };

      const result = await registry.dispatch('mock_echo', { message: 'test' }, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Emergency Kill Switch');
    });
  });

  describe('BaseSkill Validation & Guardrails', () => {
    it('validates input schemas and fails closed on invalid input', async () => {
      const mockSkill = new MockEchoSkill();
      const context: SkillExecutionContext = {
        isDryRun: false,
        userPrompt: 'Invalid input test',
        killSwitchActive: () => false,
      };

      // Empty message violates min(1) constraint
      const result = await mockSkill.execute({ message: '' }, context);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Input validation failed');
    });

    it('dispatches ComputerSkill through skillRegistry for system state inspection', async () => {
      const context: SkillExecutionContext = {
        isDryRun: false,
        userPrompt: 'Get state',
        killSwitchActive: () => false,
      };

      const res = await skillRegistry.dispatch('computer_control', { action: 'get_state' }, context);
      expect(res.success).toBe(true);
      expect(res.data?.action).toBe('get_state');
      expect(res.data?.state).toBeDefined();
    });

    it('supports dry run execution on ComputerSkill through skillRegistry', async () => {
      const context: SkillExecutionContext = {
        isDryRun: true,
        userPrompt: 'Activate Safari',
        killSwitchActive: () => false,
      };

      const res = await skillRegistry.dispatch(
        'computer_control',
        { action: 'activate_app', appName: 'Safari' },
        context
      );
      expect(res.success).toBe(true);
      expect(res.message).toContain('[DRY RUN]');
    });
  });
});
