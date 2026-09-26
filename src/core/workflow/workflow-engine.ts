import {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowStatus,
  StepExecutionRecord,
  WorkflowExecutionResult,
  WorkflowMilestoneEvent,
  WorkflowMilestoneType,
} from '../../types/workflow';
import { DynamicPlannedStep } from '../../types/task-planning';
import { RiskLevel } from '../../types/action-plan';
import { SkillExecutionContext } from '../../types/skills';
import { skillRegistry } from '../../skills';
import { variableResolver } from './variable-resolver';
import { killSwitch } from '../kill-switch';
import { replanningEngine } from '../replanning-engine';
import { rollbackCoordinator } from './rollback-coordinator';
import { taskContextManager } from '../../context/task-context-manager';
import { useAuditStore } from '../../state/useAuditStore';

export interface WorkflowExecutionOptions {
  isDryRun?: boolean;
  autoApproveRisk?: RiskLevel;
  approvedStepIds?: string[];
  maxReplans?: number;
}

export type MilestoneListener = (event: WorkflowMilestoneEvent) => void;

export class WorkflowEngine {
  private activeWorkflow: WorkflowDefinition | null = null;
  private executionCache: Record<string, any> = {};
  private stepRecords: StepExecutionRecord[] = [];
  private options: WorkflowExecutionOptions = {};
  private isPaused = false;
  private milestoneListeners: Set<MilestoneListener> = new Set();
  private replanCount = 0;
  private maxReplans = 2;

  /**
   * Subscribe to workflow lifecycle milestone events.
   * Returns an unsubscribe closure.
   */
  public onMilestone(listener: MilestoneListener): () => void {
    this.milestoneListeners.add(listener);
    return () => {
      this.milestoneListeners.delete(listener);
    };
  }

  private emitMilestone(type: WorkflowMilestoneType, extra: Partial<WorkflowMilestoneEvent> = {}): void {
    if (!this.activeWorkflow) return;
    const event: WorkflowMilestoneEvent = {
      type,
      workflowId: this.activeWorkflow.id,
      goal: this.activeWorkflow.goal,
      stepIndex: this.activeWorkflow.currentStepIndex + 1,
      totalSteps: this.activeWorkflow.steps.length,
      timestamp: new Date().toISOString(),
      ...extra,
    };
    for (const listener of this.milestoneListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in milestone listener:', err);
      }
    }
  }

  public getActiveWorkflow(): WorkflowDefinition | null {
    return this.activeWorkflow;
  }

  public getStepRecords(): StepExecutionRecord[] {
    return [...this.stepRecords];
  }

  /**
   * Pause execution of the currently running workflow.
   */
  public pauseWorkflow(workflowId: string): void {
    if (this.activeWorkflow && this.activeWorkflow.id === workflowId) {
      this.isPaused = true;
      this.activeWorkflow.status = 'PAUSED_FOR_APPROVAL';
      this.emitMilestone('AWAITING_APPROVAL', {
        stepTitle: 'Workflow paused by user/approval gate',
      });
    }
  }

  /**
   * Resume execution of a paused workflow.
   */
  public async resumeWorkflow(
    workflowId: string,
    approvedStepId?: string
  ): Promise<WorkflowExecutionResult | null> {
    if (!this.activeWorkflow || this.activeWorkflow.id !== workflowId) {
      return null;
    }

    if (approvedStepId) {
      this.options.approvedStepIds = [
        ...(this.options.approvedStepIds || []),
        approvedStepId,
      ];
    }

    this.isPaused = false;
    this.activeWorkflow.status = 'RUNNING';
    return this.runWorkflowLoop();
  }

  /**
   * Abort workflow execution immediately.
   */
  public async abortWorkflow(
    workflowId: string,
    reason: string = 'User requested abort'
  ): Promise<WorkflowExecutionResult | null> {
    if (!this.activeWorkflow || this.activeWorkflow.id !== workflowId) {
      return null;
    }

    const wasKillSwitch = killSwitch.isEngaged();
    this.activeWorkflow.status = wasKillSwitch ? 'ABORTED_BY_KILL_SWITCH' : 'FAILED';
    this.emitMilestone(wasKillSwitch ? 'WORKFLOW_ABORTED' : 'WORKFLOW_FAILED', {
      error: reason,
    });

    // Run compensating rollback for completed steps
    const completedStepRecords = this.stepRecords.filter((r) => r.success);
    const rollbackResult = await rollbackCoordinator.rollback(
      completedStepRecords.map((r) => ({
        id: r.stepId,
        title: r.title,
        skillId: r.skillId,
        action: r.action,
        params: r.resolvedParams,
        status: 'COMPLETED',
      })),
      reason
    );

    const result: WorkflowExecutionResult = {
      workflowId: this.activeWorkflow.id,
      goal: this.activeWorkflow.goal,
      status: this.activeWorkflow.status,
      completedStepsCount: completedStepRecords.length,
      totalStepsCount: this.activeWorkflow.steps.length,
      stepRecords: this.stepRecords,
      rollbackResult,
      error: reason,
      totalDurationMs: 0,
    };

    this.activeWorkflow = null;
    return result;
  }

  /**
   * Start executing a complete workflow.
   */
  public async startWorkflow(
    workflow: WorkflowDefinition,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowExecutionResult> {
    this.activeWorkflow = {
      ...workflow,
      currentStepIndex: 0,
      status: 'RUNNING',
    };
    this.options = { ...options };
    this.maxReplans = options.maxReplans ?? 2;
    this.replanCount = 0;
    this.executionCache = {};
    this.stepRecords = [];
    this.isPaused = false;

    // Checkpoint session start
    taskContextManager.startTask(workflow.goal, workflow.targetApp);

    this.emitMilestone('WORKFLOW_STARTED', {
      totalSteps: workflow.steps.length,
    });

    return this.runWorkflowLoop();
  }

  /**
   * Internal execution loop running steps sequentially with risk checks, recovery, and dataflow.
   */
  private async runWorkflowLoop(): Promise<WorkflowExecutionResult> {
    const startTime = performance.now();
    const workflow = this.activeWorkflow!;

    while (workflow.currentStepIndex < workflow.steps.length) {
      // 1. Check emergency stop before every step (<10ms halt)
      if (killSwitch.isEngaged()) {
        workflow.status = 'ABORTED_BY_KILL_SWITCH';
        this.emitMilestone('WORKFLOW_ABORTED', {
          error: 'Emergency Kill Switch engaged',
        });
        return {
          workflowId: workflow.id,
          goal: workflow.goal,
          status: 'ABORTED_BY_KILL_SWITCH',
          completedStepsCount: this.stepRecords.filter((r) => r.success).length,
          totalStepsCount: workflow.steps.length,
          stepRecords: this.stepRecords,
          error: 'Emergency Kill Switch engaged',
          totalDurationMs: Math.round(performance.now() - startTime),
        };
      }

      // 2. Check if paused
      if (this.isPaused) {
        workflow.status = 'PAUSED_FOR_APPROVAL';
        return {
          workflowId: workflow.id,
          goal: workflow.goal,
          status: 'PAUSED_FOR_APPROVAL',
          completedStepsCount: this.stepRecords.filter((r) => r.success).length,
          totalStepsCount: workflow.steps.length,
          stepRecords: this.stepRecords,
          totalDurationMs: Math.round(performance.now() - startTime),
        };
      }

      const step = workflow.steps[workflow.currentStepIndex];

      // 3. Step-Level Human-in-the-Loop Risk Gating
      const requiresApproval =
        (step.riskLevel === 'HIGH' || step.riskLevel === 'CRITICAL') &&
        !(this.options.approvedStepIds || []).includes(step.id);

      if (requiresApproval) {
        workflow.status = 'PAUSED_FOR_APPROVAL';
        this.isPaused = true;
        this.emitMilestone('AWAITING_APPROVAL', {
          stepIndex: workflow.currentStepIndex + 1,
          stepTitle: step.title,
        });
        return {
          workflowId: workflow.id,
          goal: workflow.goal,
          status: 'PAUSED_FOR_APPROVAL',
          completedStepsCount: this.stepRecords.filter((r) => r.success).length,
          totalStepsCount: workflow.steps.length,
          stepRecords: this.stepRecords,
          totalDurationMs: Math.round(performance.now() - startTime),
        };
      }

      // 4. Emit Step Started
      this.emitMilestone('STEP_STARTED', {
        stepIndex: workflow.currentStepIndex + 1,
        stepTitle: step.title,
      });

      // 5. Dynamic Parameter Variable Resolution
      const resolution = variableResolver.resolveStepParams(step.params || {}, {
        steps: this.executionCache,
        context: {
          activeApp: workflow.targetApp || 'Desktop',
          goal: workflow.goal,
        },
      });

      if (!resolution.success) {
        // Variable resolution error
        const record: StepExecutionRecord = {
          stepId: step.id,
          stepNumber: step.stepNumber,
          title: step.title,
          skillId: step.skillId,
          action: step.action,
          resolvedParams: step.params,
          success: false,
          verified: false,
          error: `Parameter resolution failed: ${resolution.errors.join('; ')}`,
          durationMs: 0,
          retriesUsed: 0,
        };
        this.stepRecords.push(record);
        return this.handleUnrecoverableFailure(workflow, record.error!, startTime);
      }

      const resolvedParams = resolution.resolvedParams;

      // 6. Execute Step via SkillRegistry
      const stepStartTime = performance.now();
      let stepSuccess = false;
      let stepOutput: any = null;
      let stepError: string | undefined;
      let retriesUsed = 0;
      const maxRetries = step.retryPolicy?.maxRetries ?? 1;

      const executionContext: SkillExecutionContext = {
        sessionId: `wf-${workflow.id}`,
        isDryRun: this.options.isDryRun,
        userPrompt: workflow.goal,
        riskTier: step.riskLevel,
        killSwitchActive: () => killSwitch.isEngaged(),
      };

      while (retriesUsed <= maxRetries && !stepSuccess) {
        if (killSwitch.isEngaged()) {
          workflow.status = 'ABORTED_BY_KILL_SWITCH';
          this.emitMilestone('WORKFLOW_ABORTED', {
            error: 'Emergency Kill Switch engaged',
          });
          return {
            workflowId: workflow.id,
            goal: workflow.goal,
            status: 'ABORTED_BY_KILL_SWITCH',
            completedStepsCount: this.stepRecords.filter((r) => r.success).length,
            totalStepsCount: workflow.steps.length,
            stepRecords: this.stepRecords,
            error: 'Emergency Kill Switch engaged',
            totalDurationMs: Math.round(performance.now() - startTime),
          };
        }

        try {
          const result = await skillRegistry.dispatch(
            step.skillId,
            { action: step.action, ...resolvedParams },
            executionContext
          );

          if (result.success) {
            stepSuccess = true;
            stepOutput = result.data !== undefined ? result.data : result.stdout;
          } else {
            stepError = result.error || 'Execution returned failure';
            retriesUsed++;
          }
        } catch (err: any) {
          stepError = err.message || 'Exception during step execution';
          retriesUsed++;
        }
      }

      const stepDurationMs = Math.round(performance.now() - stepStartTime);

      if (stepSuccess) {
        // Step Succeeded!
        const record: StepExecutionRecord = {
          stepId: step.id,
          stepNumber: step.stepNumber,
          title: step.title,
          skillId: step.skillId,
          action: step.action,
          resolvedParams,
          success: true,
          verified: true,
          output: stepOutput,
          durationMs: stepDurationMs,
          retriesUsed: retriesUsed > 0 ? retriesUsed - 1 : 0,
        };
        this.stepRecords.push(record);

        // Cache output for downstream variable resolution
        this.executionCache[step.id] = {
          output: stepOutput,
          data: stepOutput?.data ?? stepOutput,
          ...(typeof stepOutput === 'object' && stepOutput !== null ? stepOutput : {}),
        };

        // Checkpoint to TaskContextManager
        taskContextManager.recordTurn({
          userPrompt: workflow.goal,
          interpretedIntent: step.title,
          actions: [`${step.skillId}:${step.action}`],
          success: true,
          durationMs: stepDurationMs,
          riskTier: step.riskLevel,
        });

        // Audit log
        useAuditStore.getState().addExecutionLog({
          id: crypto.randomUUID(),
          planId: workflow.id,
          actionId: step.id,
          skillId: step.skillId,
          commandExecuted: `${step.skillId}:${step.action}`,
          stdout: typeof stepOutput === 'string' ? stepOutput : JSON.stringify(stepOutput),
          exitCode: 0,
          status: this.options.isDryRun ? 'DRY_RUN' : 'SUCCESS',
          startedAt: new Date(Date.now() - stepDurationMs).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: stepDurationMs,
        });

        this.emitMilestone('STEP_COMPLETED', {
          stepIndex: workflow.currentStepIndex + 1,
          stepTitle: step.title,
        });

        // Advance to next step
        workflow.currentStepIndex++;
      } else {
        // Step Failed! Attempt Adaptive Recovery
        workflow.status = 'RECOVERING';
        this.emitMilestone('RECOVERING', {
          stepIndex: workflow.currentStepIndex + 1,
          stepTitle: step.title,
          error: stepError,
        });

        const dynamicStep: DynamicPlannedStep = {
          id: step.id,
          stepNumber: step.stepNumber,
          title: step.title,
          skillId: step.skillId,
          action: step.action,
          params: resolvedParams,
          preconditions: step.preconditions,
          expectedResult: step.expectedResult,
          verificationMethod: step.verificationMethod,
          verificationCriteria: step.verificationCriteria || {},
          riskLevel: step.riskLevel,
          timeoutMs: step.timeoutMs,
          retryPolicy: step.retryPolicy,
        };

        const diagnosis = replanningEngine.diagnoseFailure(
          dynamicStep,
          stepError || 'Step execution verification failed',
          workflow.targetApp,
          workflow.overallRisk
        );

        if (
          diagnosis.recoveryStrategy !== 'FAIL_CLOSED' &&
          diagnosis.suggestedSteps.length > 0 &&
          this.replanCount < this.maxReplans
        ) {
          // Adaptive replan: replace failed step with suggested recovery steps
          const recoveryWorkflowSteps: WorkflowStep[] = diagnosis.suggestedSteps.map((ds, idx) => ({
            id: ds.id,
            stepNumber: workflow.currentStepIndex + 1 + idx,
            title: ds.title,
            skillId: ds.skillId,
            action: ds.action,
            params: ds.params,
            preconditions: ds.preconditions,
            expectedResult: ds.expectedResult,
            verificationMethod: ds.verificationMethod,
            verificationCriteria: ds.verificationCriteria,
            riskLevel: ds.riskLevel,
            timeoutMs: ds.timeoutMs,
            retryPolicy: ds.retryPolicy,
          }));

          const completed = workflow.steps.slice(0, workflow.currentStepIndex);
          const subsequent = workflow.steps.slice(workflow.currentStepIndex + 1);
          workflow.steps = [...completed, ...recoveryWorkflowSteps, ...subsequent];
          workflow.steps.forEach((s, idx) => {
            s.stepNumber = idx + 1;
          });

          this.replanCount++;
          workflow.status = 'RUNNING';
          // Continue execution loop on the newly inserted recovery step!
          continue;
        }

        // Unrecoverable Failure!
        const record: StepExecutionRecord = {
          stepId: step.id,
          stepNumber: step.stepNumber,
          title: step.title,
          skillId: step.skillId,
          action: step.action,
          resolvedParams,
          success: false,
          verified: false,
          error: stepError,
          durationMs: stepDurationMs,
          retriesUsed,
        };
        this.stepRecords.push(record);

        return this.handleUnrecoverableFailure(workflow, stepError || 'Execution failed', startTime);
      }
    }

    // Workflow Completed Successfully!
    workflow.status = 'COMPLETED';
    this.emitMilestone('WORKFLOW_COMPLETED', {
      totalSteps: workflow.steps.length,
    });

    const result: WorkflowExecutionResult = {
      workflowId: workflow.id,
      goal: workflow.goal,
      status: 'COMPLETED',
      completedStepsCount: this.stepRecords.filter((r) => r.success).length,
      totalStepsCount: workflow.steps.length,
      stepRecords: this.stepRecords,
      totalDurationMs: Math.round(performance.now() - startTime),
    };

    this.activeWorkflow = null;
    return result;
  }

  private async handleUnrecoverableFailure(
    workflow: WorkflowDefinition,
    error: string,
    startTime: number
  ): Promise<WorkflowExecutionResult> {
    workflow.status = 'FAILED';
    this.emitMilestone('WORKFLOW_FAILED', { error });

    // Execute compensating rollback for all previously completed steps
    const completedStepRecords = this.stepRecords.filter((r) => r.success);
    const rollbackResult = await rollbackCoordinator.rollback(
      completedStepRecords.map((r) => ({
        id: r.stepId,
        title: r.title,
        skillId: r.skillId,
        action: r.action,
        params: r.resolvedParams,
        status: 'COMPLETED',
      })),
      error
    );

    const result: WorkflowExecutionResult = {
      workflowId: workflow.id,
      goal: workflow.goal,
      status: 'FAILED',
      completedStepsCount: completedStepRecords.length,
      totalStepsCount: workflow.steps.length,
      stepRecords: this.stepRecords,
      rollbackResult,
      error,
      totalDurationMs: Math.round(performance.now() - startTime),
    };

    this.activeWorkflow = null;
    return result;
  }
}

export const workflowEngine = new WorkflowEngine();
