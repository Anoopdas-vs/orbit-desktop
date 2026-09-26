import { SkillManifest, SkillExecutionContext, SkillExecutionResult } from '../types/skills';
import { killSwitch } from '../core/kill-switch';
import { computerControlSkill } from './computer-control';

export class SkillRegistry {
  private skills: Map<string, SkillManifest> = new Map();

  constructor() {
    this.registerDefaultSkills();
  }

  /**
   * Register standard foundation skills.
   */
  public registerDefaultSkills(): void {
    if (computerControlSkill && computerControlSkill.id) {
      this.skills.set(computerControlSkill.id, computerControlSkill);
    }
  }

  /**
   * Register a skill in the platform registry.
   */
  public registerSkill(skill: SkillManifest): void {
    if (!skill || !skill.id) {
      throw new Error('Cannot register skill: Invalid skill manifest or missing skill id.');
    }
    this.skills.set(skill.id, skill);
  }

  /**
   * Unregister a skill by ID.
   */
  public unregisterSkill(skillId: string): boolean {
    return this.skills.delete(skillId);
  }

  /**
   * Get a registered skill by ID.
   */
  public getSkill(skillId: string): SkillManifest | undefined {
    return this.skills.get(skillId);
  }

  /**
   * Check if a skill ID is registered.
   */
  public hasSkill(skillId: string): boolean {
    return this.skills.has(skillId);
  }

  /**
   * List all registered skills.
   */
  public listSkills(): SkillManifest[] {
    return Array.from(this.skills.values());
  }

  /**
   * Clear registry (used primarily in test teardown).
   */
  public clear(): void {
    this.skills.clear();
  }

  /**
   * Reset registry back to default foundation skills.
   */
  public reset(): void {
    this.skills.clear();
    this.registerDefaultSkills();
  }

  /**
   * Central dispatch mechanism for all skill executions.
   * Performs safety checks, kill switch checks, and routes to dry-run or execute.
   */
  public async dispatch<TInput = any, TOutput = any>(
    skillId: string,
    input: TInput,
    context?: Partial<SkillExecutionContext>
  ): Promise<SkillExecutionResult<TOutput>> {
    const startTime = performance.now();
    const fullContext: SkillExecutionContext = {
      isDryRun: context?.isDryRun ?? false,
      userPrompt: context?.userPrompt ?? '',
      sessionId: context?.sessionId,
      riskTier: context?.riskTier,
      auditLogId: context?.auditLogId,
      killSwitchActive: context?.killSwitchActive ?? (() => killSwitch.isEngaged()),
    };

    // 1. Emergency kill switch check
    if (killSwitch.isEngaged() || fullContext.killSwitchActive()) {
      return {
        success: false,
        error: `Execution blocked: Emergency Kill Switch is engaged (${killSwitch.getReason() || 'Active'}).`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // 2. Skill lookup
    const skill = this.skills.get(skillId);
    if (!skill) {
      return {
        success: false,
        error: `Skill "${skillId}" not found in registry.`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // 3. Platform check
    if (!skill.allowedPlatforms.includes('all') && !skill.allowedPlatforms.includes('darwin')) {
      return {
        success: false,
        error: `Skill "${skillId}" is not allowed on macOS (darwin).`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // 4. Dry run dispatch
    if (fullContext.isDryRun) {
      if (skill.dryRun) {
        return await skill.dryRun(input, fullContext);
      }
      return {
        success: true,
        data: { dryRun: true, skillId, input } as any,
        stdout: `[DRY RUN] Would execute skill "${skill.name}" (${skillId})`,
        message: `[DRY RUN] Would execute skill "${skill.name}"`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // 5. Full execution
    return await skill.execute(input, fullContext);
  }
}

export const skillRegistry = new SkillRegistry();
