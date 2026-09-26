import {
  DynamicPlannedStep,
  DynamicPlannedTask,
  FailureDiagnosis,
} from '../types/task-planning';
import { RiskLevel } from '../types/action-plan';
import { recoveryCatalog } from './workflow/recovery-catalog';

export class ReplanningEngine {
  public readonly MAX_REPLANS = 2;

  /**
   * Analyze why a step verification failed against observed computer state.
   */
  public diagnoseFailure(
    failedStep: DynamicPlannedStep,
    observedState: string,
    targetApp?: string,
    taskOverallRisk?: RiskLevel
  ): FailureDiagnosis {
    return recoveryCatalog.diagnose(failedStep, observedState, {
      targetApp,
      taskOverallRisk,
    });
  }

  /**
   * Re-plan an existing task by inserting recovery steps and pruning invalid paths.
   * Strictly enforces:
   * 1. Max replans cap (<= 2).
   * 2. Risk level invariant: Re-planned steps cannot exceed original approved task risk level.
   * 3. No blind retries: Suggested steps cannot merely repeat the identical failing action without remediation.
   * 4. Fail-closed on exhausted replans.
   */
  public replan(
    task: DynamicPlannedTask,
    failedStepIndex: number,
    diagnosis: FailureDiagnosis
  ): DynamicPlannedTask | null {
    // 1. Check replanning budget
    if (task.replanCount >= (task.maxReplans ?? this.MAX_REPLANS)) {
      return null; // Exhausted replan limit; fail closed
    }

    // 2. If recovery strategy is FAIL_CLOSED or has no steps, abort
    if (diagnosis.recoveryStrategy === 'FAIL_CLOSED' || diagnosis.suggestedSteps.length === 0) {
      return null;
    }

    // 3. Ensure no recovery step exceeds the approved overall risk
    const riskRank: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    const taskRiskRank = riskRank[task.overallRisk];

    for (const step of diagnosis.suggestedSteps) {
      if (riskRank[step.riskLevel] > taskRiskRank) {
        return null; // Escalation prohibited during autonomous replanning!
      }
    }

    // 4. Prohibit blind identical retries without intervening remediation
    const failedStep = task.steps[failedStepIndex];
    if (
      failedStep &&
      diagnosis.suggestedSteps.length === 1 &&
      diagnosis.suggestedSteps[0].action === failedStep.action &&
      diagnosis.suggestedSteps[0].skillId === failedStep.skillId &&
      JSON.stringify(diagnosis.suggestedSteps[0].params) === JSON.stringify(failedStep.params)
    ) {
      return null; // Blind retry without remediation prohibited
    }

    // 5. Construct updated step sequence
    const completedSteps = task.steps.slice(0, failedStepIndex);
    const subsequentSteps = task.steps.slice(failedStepIndex + 1);

    // Merge completed + suggested recovery steps + remaining steps
    const newSteps: DynamicPlannedStep[] = [
      ...completedSteps,
      ...diagnosis.suggestedSteps,
      ...subsequentSteps,
    ];

    // Re-number steps
    newSteps.forEach((s, idx) => {
      s.stepNumber = idx + 1;
    });

    return {
      ...task,
      steps: newSteps,
      replanCount: task.replanCount + 1,
    };
  }
}

export const replanningEngine = new ReplanningEngine();
