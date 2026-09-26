import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workflowEngine } from '../src/core/workflow/workflow-engine';
import { WorkflowDefinition, WorkflowMilestoneEvent } from '../src/types/workflow';
import { skillRegistry } from '../src/skills/skill-registry';
import { killSwitch } from '../src/core/kill-switch';
import { taskContextManager } from '../src/context/task-context-manager';
import { rollbackCoordinator } from '../src/core/workflow/rollback-coordinator';

describe('Phase 4C: Durable Workflow State Machine (WorkflowEngine)', () => {
  beforeEach(() => {
    killSwitch.disengage();
    vi.restoreAllMocks();
  });

  const mockWorkflow: WorkflowDefinition = {
    id: 'wf-test-1',
    goal: 'Automate weekly report',
    language: 'en',
    interpretedIntent: 'Generate report',
    targetApp: 'TextEdit',
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        title: 'Find data files',
        skillId: 'files_skill',
        action: 'find_files',
        params: { query: 'report_data.csv' },
        preconditions: {},
        expectedResult: 'Files located',
        verificationMethod: 'command_success',
        riskLevel: 'LOW',
        timeoutMs: 4000,
        retryPolicy: { maxRetries: 1, backoffMs: 100, allowReplanOnExhaustion: false },
      },
      {
        id: 'step-2',
        stepNumber: 2,
        title: 'Summarize report content',
        skillId: 'document_skill',
        action: 'summarize_document',
        params: { files: '{{steps.step-1.output.files}}' },
        preconditions: {},
        expectedResult: 'Summary produced',
        verificationMethod: 'command_success',
        riskLevel: 'LOW',
        timeoutMs: 4000,
        retryPolicy: { maxRetries: 1, backoffMs: 100, allowReplanOnExhaustion: false },
      },
    ],
    overallRisk: 'LOW',
    currentStepIndex: 0,
    status: 'PENDING_APPROVAL',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  describe('Happy Path & Milestone Event Stream', () => {
    it('executes multi-step workflow to COMPLETED and emits milestone events in order', async () => {
      const milestones: string[] = [];
      const unsubscribe = workflowEngine.onMilestone((e: WorkflowMilestoneEvent) => {
        milestones.push(e.type);
      });

      vi.spyOn(skillRegistry, 'dispatch').mockImplementation(async (skillId) => {
        if (skillId === 'files_skill') {
          return { success: true, data: { files: ['/path/to/report_data.csv'] }, durationMs: 10 };
        }
        return { success: true, data: { summary: 'Weekly data summary' }, durationMs: 15 };
      });

      const result = await workflowEngine.startWorkflow(mockWorkflow);

      unsubscribe();

      expect(result.status).toBe('COMPLETED');
      expect(result.completedStepsCount).toBe(2);
      expect(result.stepRecords.length).toBe(2);
      expect(result.stepRecords[0].success).toBe(true);
      expect(result.stepRecords[1].success).toBe(true);

      // Verify ordered milestone event stream
      expect(milestones).toEqual([
        'WORKFLOW_STARTED',
        'STEP_STARTED',
        'STEP_COMPLETED',
        'STEP_STARTED',
        'STEP_COMPLETED',
        'WORKFLOW_COMPLETED',
      ]);
    });
  });

  describe('Step-Level Risk Gating', () => {
    it('pauses workflow when encountering an unapproved HIGH risk step and resumes after approval', async () => {
      const highRiskWorkflow: WorkflowDefinition = {
        ...mockWorkflow,
        id: 'wf-high-risk',
        steps: [
          mockWorkflow.steps[0], // LOW risk
          {
            ...mockWorkflow.steps[1],
            id: 'step-high-2',
            riskLevel: 'HIGH', // Requires approval!
          },
        ],
      };

      vi.spyOn(skillRegistry, 'dispatch').mockResolvedValue({
        success: true,
        data: { files: ['data.csv'] },
        durationMs: 5,
      });

      // 1. Start without pre-approved step IDs
      const pauseResult = await workflowEngine.startWorkflow(highRiskWorkflow);

      expect(pauseResult.status).toBe('PAUSED_FOR_APPROVAL');
      expect(pauseResult.completedStepsCount).toBe(1);

      // 2. Resume with approval token for step-high-2
      const resumeResult = await workflowEngine.resumeWorkflow('wf-high-risk', 'step-high-2');

      expect(resumeResult).not.toBeNull();
      expect(resumeResult?.status).toBe('COMPLETED');
      expect(resumeResult?.completedStepsCount).toBe(2);
    });
  });

  describe('Emergency Stop / Kill Switch Dominance', () => {
    it('immediately halts workflow in ABORTED_BY_KILL_SWITCH when kill switch is engaged', async () => {
      vi.spyOn(skillRegistry, 'dispatch').mockImplementation(async () => {
        // Engage kill switch mid-execution
        killSwitch.engage('Emergency Stop Activated');
        return { success: true, durationMs: 5 };
      });

      const result = await workflowEngine.startWorkflow(mockWorkflow);

      expect(result.status).toBe('ABORTED_BY_KILL_SWITCH');
      expect(result.error).toContain('Emergency Kill Switch engaged');
    });
  });

  describe('Adaptive Recovery & Rollback Integration', () => {
    it('diagnoses failure, transitions to RECOVERING, and adapts execution', async () => {
      let callCount = 0;
      vi.spyOn(skillRegistry, 'dispatch').mockImplementation(async (skillId, params) => {
        callCount++;
        if (callCount === 1) {
          // Attempt of Step 1 fails with app not frontmost
          return { success: false, error: 'Target app TextEdit is not frontmost (Active App: Finder)', durationMs: 10 };
        }
        // Subsequent calls (recovery activation + retry) succeed
        return { success: true, data: { files: ['file.txt'], summary: 'Data summary' }, durationMs: 10 };
      });

      const workflowWithZeroRetries: WorkflowDefinition = {
        ...mockWorkflow,
        steps: mockWorkflow.steps.map((s) => ({
          ...s,
          retryPolicy: { maxRetries: 0, backoffMs: 0, allowReplanOnExhaustion: true },
        })),
      };

      const milestones: string[] = [];
      const unsubscribe = workflowEngine.onMilestone((e) => milestones.push(e.type));

      const result = await workflowEngine.startWorkflow(workflowWithZeroRetries);
      unsubscribe();

      expect(result.status).toBe('COMPLETED');
      expect(milestones).toContain('RECOVERING');
    });

    it('triggers compensating rollback and transitions to FAILED on unrecoverable failure', async () => {
      const rollbackSpy = vi.spyOn(rollbackCoordinator, 'rollback').mockResolvedValue({
        success: true,
        rolledBackSteps: ['step-1'],
        failedRollbacks: [],
        skippedSteps: [],
        summary: 'Rollback finished',
      });

      vi.spyOn(skillRegistry, 'dispatch').mockImplementation(async (skillId) => {
        if (skillId === 'files_skill') {
          return { success: true, data: { files: ['test.txt'] }, durationMs: 5 };
        }
        // Step 2 fails with fatal security violation (FAIL_CLOSED)
        return { success: false, error: 'Permission denied: security policy violation', durationMs: 5 };
      });

      const result = await workflowEngine.startWorkflow(mockWorkflow);

      expect(result.status).toBe('FAILED');
      expect(rollbackSpy).toHaveBeenCalled();
      expect(result.rollbackResult?.success).toBe(true);
    });
  });

  describe('State Checkpointing', () => {
    it('checkpoints execution state into TaskContextManager after each completed step', async () => {
      const recordTurnSpy = vi.spyOn(taskContextManager, 'recordTurn');

      vi.spyOn(skillRegistry, 'dispatch').mockImplementation(async (skillId) => {
        if (skillId === 'files_skill') {
          return { success: true, data: { files: ['report.csv'] }, durationMs: 10 };
        }
        return { success: true, data: { summary: 'Done' }, durationMs: 10 };
      });

      await workflowEngine.startWorkflow(mockWorkflow);

      // Verify that each step check-pointed into taskContextManager
      expect(recordTurnSpy).toHaveBeenCalledTimes(2);
    });
  });
});
