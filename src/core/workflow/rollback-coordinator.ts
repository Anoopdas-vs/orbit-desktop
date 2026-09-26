import { skillRegistry } from '../../skills/skill-registry';
import '../../skills'; // Ensure all domain skills are loaded into registry
import { killSwitch } from '../kill-switch';
import { validateSafeFilePath } from '../../skills/files/files-skill';
import { useAuditStore } from '../../state/useAuditStore';
import {
  CompensatingAction,
  RollbackResult,
  WorkflowStep,
} from '../../types/workflow';
import { ActionItem } from '../../types/action-plan';
import { SkillExecutionContext } from '../../types/skills';

export interface ExecutedStepRecord {
  id: string;
  stepNumber?: number;
  title: string;
  skillId: string;
  action: string;
  params: Record<string, any>;
  output?: any;
  status: 'COMPLETED' | 'FAILED' | 'DRY_RUN' | string;
  compensatingAction?: CompensatingAction;
}

export class RollbackCoordinator {
  /**
   * Derive a non-destructive compensating action for a given executed step.
   * If an action is non-reversible (e.g. trading orders, network calls), returns isReversible: false.
   */
  public deriveCompensatingAction(step: {
    id: string;
    title: string;
    skillId: string;
    action: string;
    params: Record<string, any>;
  }): CompensatingAction {
    const { id, title, skillId, action, params } = step;

    // 1. Files Skill Compensating Actions
    if (skillId === 'files_skill') {
      if (action === 'create_file' && params.path) {
        return {
          id: crypto.randomUUID(),
          stepId: id,
          title: `Revert created file "${params.path}" (move to Trash)`,
          skillId: 'files_skill',
          action: 'move_to_trash',
          params: { path: params.path },
          isReversible: true,
          riskLevel: 'LOW',
        };
      }

      if (action === 'move_file' && params.path && params.newPath) {
        return {
          id: crypto.randomUUID(),
          stepId: id,
          title: `Revert moved file from "${params.newPath}" back to "${params.path}"`,
          skillId: 'files_skill',
          action: 'move_file',
          params: { path: params.newPath, newPath: params.path },
          isReversible: true,
          riskLevel: 'LOW',
        };
      }

      if (action === 'rename_file' && params.path && params.newPath) {
        return {
          id: crypto.randomUUID(),
          stepId: id,
          title: `Revert renamed file from "${params.newPath}" back to "${params.path}"`,
          skillId: 'files_skill',
          action: 'rename_file',
          params: { path: params.newPath, newPath: params.path },
          isReversible: true,
          riskLevel: 'LOW',
        };
      }
    }

    // 2. Document Skill Compensating Actions
    if (skillId === 'document_skill') {
      if (action === 'create_document' && params.path) {
        return {
          id: crypto.randomUUID(),
          stepId: id,
          title: `Revert created document "${params.path}" (move to Trash)`,
          skillId: 'files_skill',
          action: 'move_to_trash',
          params: { path: params.path },
          isReversible: true,
          riskLevel: 'LOW',
        };
      }
    }

    // 3. Known Non-Reversible Actions (Financial, Outbound Network, Irreversible OS operations)
    if (
      skillId === 'binance_spot_order' ||
      skillId === 'trading_advisory' ||
      skillId === 'open_url' ||
      action === 'send_email' ||
      action === 'move_to_trash' // Trashed items shouldn't be auto-restored blindly
    ) {
      return {
        id: crypto.randomUUID(),
        stepId: id,
        title: `Non-reversible action "${title}"`,
        skillId,
        action,
        params,
        isReversible: false,
        riskLevel: 'LOW',
      };
    }

    // 4. Default: Read-only or idempotent operations that do not require state reversal
    return {
      id: crypto.randomUUID(),
      stepId: id,
      title: `No rollback needed for read-only/idempotent action "${title}"`,
      skillId,
      action,
      params,
      isReversible: false,
      riskLevel: 'LOW',
    };
  }

  /**
   * Execute compensating actions in reverse order (LIFO) for previously completed steps.
   */
  public async rollback(
    completedSteps: (ExecutedStepRecord | WorkflowStep | ActionItem)[],
    reason: string = 'Workflow execution failed'
  ): Promise<RollbackResult> {
    const rolledBackSteps: string[] = [];
    const failedRollbacks: Array<{ stepId: string; error: string }> = [];
    const skippedSteps: string[] = [];

    // Filter to only steps that actually completed (exclude skipped, pending, or failed steps)
    const stepsToConsider = completedSteps.filter(
      (s) => !('status' in s) || (s as any).status === 'COMPLETED'
    );

    // Reverse order: LIFO
    const reversed = [...stepsToConsider].reverse();

    for (const step of reversed) {
      // 1. Check emergency kill switch
      if (killSwitch.isEngaged()) {
        failedRollbacks.push({
          stepId: step.id,
          error: 'Rollback halted: Emergency Kill Switch engaged.',
        });
        break;
      }

      // 2. Resolve compensating action
      const compensating: CompensatingAction =
        ('compensatingAction' in step && step.compensatingAction)
          ? step.compensatingAction
          : this.deriveCompensatingAction({
              id: step.id,
              title: step.title,
              skillId: step.skillId,
              action: (step as any).action || step.params?.action || '',
              params: step.params || {},
            });

      // 3. Skip non-reversible or no-op actions
      if (!compensating.isReversible) {
        skippedSteps.push(step.id);
        continue;
      }

      // 4. Validate safety for file path operations
      if (
        compensating.skillId === 'files_skill' &&
        typeof compensating.params.path === 'string'
      ) {
        const safetyCheck = validateSafeFilePath(compensating.params.path);
        if (!safetyCheck.isSafe) {
          failedRollbacks.push({
            stepId: step.id,
            error: `Rollback blocked: Target path "${compensating.params.path}" failed safety check: ${safetyCheck.reason}`,
          });
          continue;
        }
      }

      // 5. Execute compensating action via SkillRegistry
      const startTime = performance.now();
      const executionContext: SkillExecutionContext = {
        sessionId: `rollback-${crypto.randomUUID()}`,
        isDryRun: false,
        userPrompt: `Rollback: ${compensating.title}`,
        riskTier: compensating.riskLevel,
        killSwitchActive: () => killSwitch.isEngaged(),
      };

      try {
        const result = await skillRegistry.dispatch(
          compensating.skillId,
          { action: compensating.action, ...compensating.params },
          executionContext
        );

        const durationMs = Math.round(performance.now() - startTime);

        // Audit the rollback event
        useAuditStore.getState().addExecutionLog({
          id: crypto.randomUUID(),
          planId: 'rollback-plan',
          actionId: step.id,
          skillId: compensating.skillId,
          commandExecuted: `[ROLLBACK] ${compensating.title}`,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.success ? 0 : 1,
          status: result.success ? 'SUCCESS' : 'ERROR',
          startedAt: new Date(Date.now() - durationMs).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs,
          error: result.error,
        });

        if (result.success) {
          rolledBackSteps.push(step.id);
        } else {
          failedRollbacks.push({
            stepId: step.id,
            error: result.error || 'Compensating action execution returned failure.',
          });
        }
      } catch (err: any) {
        failedRollbacks.push({
          stepId: step.id,
          error: err.message || 'Exception thrown during compensating action execution.',
        });
      }
    }

    const allSuccessful = failedRollbacks.length === 0;
    const summary = allSuccessful
      ? `Rollback completed: ${rolledBackSteps.length} step(s) reverted, ${skippedSteps.length} non-reversible/read-only step(s) skipped.`
      : `Rollback completed with issues: ${rolledBackSteps.length} step(s) reverted, ${failedRollbacks.length} failed, ${skippedSteps.length} skipped. Reason: ${reason}`;

    return {
      success: allSuccessful,
      rolledBackSteps,
      failedRollbacks,
      skippedSteps,
      summary,
    };
  }
}

export const rollbackCoordinator = new RollbackCoordinator();
