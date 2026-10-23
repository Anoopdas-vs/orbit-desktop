import {
  WorkflowDefinition,
  StepExecutionRecord,
  WorkflowStatus,
} from '../../types/workflow';

export type CheckpointStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING_CONFIRMATION'
  | 'SUCCESS'
  | 'FAILED'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'RECOVERABLE';

export interface WorkflowCheckpoint {
  checkpointId: string;
  workflowId: string;
  timestamp: string;
  currentStepIndex: number;
  completedStepCount: number;
  totalStepCount: number;
  status: CheckpointStatus;
  completedStepRecords: StepExecutionRecord[];
  failedStepId?: string;
  failureReason?: string;
  isRecoverable: boolean;
  canResumeFromStepIndex?: number;
  snapshotState: Record<string, any>;
}

export class CheckpointManager {
  private checkpoints: Map<string, WorkflowCheckpoint[]> = new Map();

  /**
   * Save a point-in-time execution snapshot for a workflow.
   */
  public saveCheckpoint(
    workflow: WorkflowDefinition,
    records: StepExecutionRecord[],
    status: CheckpointStatus,
    failedStepId?: string,
    failureReason?: string,
    isRecoverable: boolean = false
  ): WorkflowCheckpoint {
    const checkpointId = `ckpt_${workflow.id}_${records.length}_${Date.now()}`;
    const completedRecords = records.filter((r) => r.success);

    const checkpoint: WorkflowCheckpoint = {
      checkpointId,
      workflowId: workflow.id,
      timestamp: new Date().toISOString(),
      currentStepIndex: workflow.currentStepIndex,
      completedStepCount: completedRecords.length,
      totalStepCount: workflow.steps.length,
      status,
      completedStepRecords: [...records],
      failedStepId,
      failureReason,
      isRecoverable,
      canResumeFromStepIndex: isRecoverable ? workflow.currentStepIndex : undefined,
      snapshotState: {
        goal: workflow.goal,
        overallRisk: workflow.overallRisk,
        targetApp: workflow.targetApp,
      },
    };

    const list = this.checkpoints.get(workflow.id) || [];
    list.push(checkpoint);
    this.checkpoints.set(workflow.id, list);

    return checkpoint;
  }

  /**
   * Get all checkpoints for a workflow.
   */
  public getCheckpoints(workflowId: string): WorkflowCheckpoint[] {
    return this.checkpoints.get(workflowId) || [];
  }

  /**
   * Get the latest checkpoint for a workflow.
   */
  public getLatestCheckpoint(workflowId: string): WorkflowCheckpoint | null {
    const list = this.checkpoints.get(workflowId);
    if (!list || list.length === 0) return null;
    return list[list.length - 1];
  }

  /**
   * Determine recovery plan from a failure checkpoint.
   */
  public analyzeRecovery(checkpoint: WorkflowCheckpoint): {
    canResume: boolean;
    resumeStepIndex: number;
    recommendedAction: 'RESUME_STEP' | 'ROLLBACK' | 'USER_CONFIRMATION' | 'FAIL_CLOSED';
    reason: string;
  } {
    if (!checkpoint.isRecoverable || checkpoint.canResumeFromStepIndex === undefined) {
      return {
        canResume: false,
        resumeStepIndex: 0,
        recommendedAction: 'FAIL_CLOSED',
        reason: checkpoint.failureReason || 'Workflow is not recoverable.',
      };
    }

    return {
      canResume: true,
      resumeStepIndex: checkpoint.canResumeFromStepIndex,
      recommendedAction: 'RESUME_STEP',
      reason: `Can safely resume from step ${checkpoint.canResumeFromStepIndex + 1}. Preceding ${checkpoint.completedStepCount} steps verified.`,
    };
  }

  /**
   * Clear checkpoints for completed workflows.
   */
  public clearCheckpoints(workflowId: string): void {
    this.checkpoints.delete(workflowId);
  }
}

export const checkpointManager = new CheckpointManager();
