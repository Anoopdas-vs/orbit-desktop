import { z } from 'zod';
import {
  SkillManifest,
  SkillExecutionContext,
  SkillExecutionResult,
  RequiredPermission,
  SkillToolDefinition,
} from '../types/skills';
import { RiskLevel } from '../types/action-plan';
import { killSwitch } from '../core/kill-switch';
import { permissionManager } from '../core/permission-manager';

export abstract class BaseSkill<TInput = any, TOutput = any> implements SkillManifest<TInput, TOutput> {
  public abstract id: string;
  public abstract name: string;
  public abstract description: string;
  public version = '1.0.0';
  public capabilities: string[] = [];
  public riskLevel: RiskLevel = 'LOW';
  public supportsDryRun = true;
  public allowedPlatforms: ('darwin' | 'all')[] = ['darwin', 'all'];
  public approvalRequirement: 'none' | 'single-click' | 'review-diff' | 'typed-phrase' = 'single-click';
  public requiredPermissions: RequiredPermission[] = [];
  public tools?: Record<string, SkillToolDefinition>;
  public abstract inputSchema: z.ZodType<TInput, any, any>;
  public outputSchema?: z.ZodType<TOutput, any, any>;
  public auditDataSchema?: z.ZodType<any, any, any>;

  /**
   * Validate that all required permissions are currently granted.
   */
  public async validatePermissions(): Promise<{
    granted: boolean;
    missing: RequiredPermission[];
    reason?: string;
  }> {
    if (!this.requiredPermissions || this.requiredPermissions.length === 0) {
      return { granted: true, missing: [] };
    }

    const status = await permissionManager.getStatus();
    const missing: RequiredPermission[] = [];

    for (const perm of this.requiredPermissions) {
      if (perm === 'accessibility' && !status.accessibilityGranted) {
        missing.push(perm);
      } else if (perm === 'automation' && !status.automationGranted) {
        missing.push(perm);
      } else if (perm === 'screenRecording' && !status.screenRecordingGranted) {
        missing.push(perm);
      } else if (perm === 'microphone' && !status.microphoneGranted) {
        missing.push(perm);
      }
      // 'network' and 'fullDiskAccess' handled by OS sandbox checks
    }

    if (missing.length > 0) {
      return {
        granted: false,
        missing,
        reason: `Missing required system permissions: ${missing.join(', ')}. ${status.actionRequired || 'Grant access in System Settings > Privacy & Security.'}`,
      };
    }

    return { granted: true, missing: [] };
  }

  /**
   * Safe execution wrapper with kill-switch gating, permission validation, schema check, and duration tracking.
   */
  public async execute(
    input: TInput,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult<TOutput>> {
    const startTime = performance.now();

    // 1. Check emergency stop kill switch
    if (killSwitch.isEngaged() || context.killSwitchActive()) {
      return {
        success: false,
        error: `Execution blocked: Emergency Kill Switch is engaged (${killSwitch.getReason() || 'Active'}).`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // 2. Validate required permissions
    const permCheck = await this.validatePermissions();
    if (!permCheck.granted) {
      return {
        success: false,
        error: permCheck.reason || 'Permission denied: Required system permissions missing.',
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // 3. Validate input schema
    const parseResult = this.inputSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Input validation failed for skill "${this.id}": ${parseResult.error.message}`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // 4. Dispatch to implementation
    try {
      const result = await this.executeInternal(parseResult.data, context);
      const totalDuration = Math.round(performance.now() - startTime);
      return {
        ...result,
        durationMs: result.durationMs ?? totalDuration,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || `Unhandled error executing skill "${this.id}"`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  /**
   * Dry run execution
   */
  public async dryRun(
    input: TInput,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult<TOutput>> {
    const startTime = performance.now();

    const parseResult = this.inputSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        success: false,
        error: `Input validation failed for skill "${this.id}": ${parseResult.error.message}`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    if (this.dryRunInternal) {
      return await this.dryRunInternal(parseResult.data, context);
    }

    return {
      success: true,
      data: {
        dryRun: true,
        skillId: this.id,
        params: parseResult.data,
      } as any,
      stdout: `[DRY RUN] Would execute skill "${this.name}" (${this.id})`,
      message: `[DRY RUN] Would execute skill "${this.name}"`,
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  /**
   * Subclasses implement actual execution logic here.
   */
  protected abstract executeInternal(
    input: TInput,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult<TOutput>>;

  /**
   * Subclasses can optionally override dryRunInternal.
   */
  protected dryRunInternal?(
    input: TInput,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult<TOutput>>;
}
