import { describe, it, expect, beforeEach } from 'vitest';
import { checkpointManager } from '../src/core/workflow/checkpoint-manager';
import { WorkflowDefinition } from '../src/types/workflow';
import { workflowEngine } from '../src/core/workflow/workflow-engine';
import { plannerAgent, researchAgent, computerAgent, memoryAgent, verificationAgent } from '../src/core/agents/modular-agents';

describe('Phase 6: Autonomous Multi-Step Planning & Resilient Checkpoint Recovery', () => {
  beforeEach(() => {
    checkpointManager.clearCheckpoints('test-wf-101');
  });

  it('coordinates modular specialized agents under unified safety constraints', async () => {
    // 1. Planner Agent decomposes goal
    const plan = await plannerAgent.plan('Open Safari and search for latest MacBook');
    expect(plan).not.toBeNull();
    expect(plan?.steps.length).toBeGreaterThan(0);

    // 2. Computer Agent checks system
    const state = await computerAgent.getComputerState();
    expect(state.activeApp).toBeDefined();

    // 3. Memory Agent recalls context
    const mem = memoryAgent.getPreferences();
    expect(mem.defaultBrowser).toBeDefined();

    // 4. Verification Agent checks target app
    const verified = await verificationAgent.verifyActiveApp(state.activeApp);
    expect(verified).toBe(true);
  });

  it('records execution checkpoints and evaluates recovery strategy', () => {
    const mockWf: WorkflowDefinition = {
      id: 'test-wf-101',
      goal: 'Multi-step automation',
      language: 'en',
      interpretedIntent: 'Automate tasks',
      steps: [
        {
          id: 'step-1',
          stepNumber: 1,
          title: 'Step 1: Check System',
          skillId: 'system_skill',
          action: 'get_system_info',
          params: {},
          preconditions: {},
          expectedResult: 'System active',
          verificationMethod: 'command_success',
          riskLevel: 'LOW',
          timeoutMs: 5000,
          retryPolicy: { maxRetries: 1, backoffMs: 100, allowReplanOnExhaustion: false },
        },
        {
          id: 'step-2',
          stepNumber: 2,
          title: 'Step 2: Inspect Screen',
          skillId: 'screen_skill',
          action: 'inspect_screen',
          params: {},
          preconditions: {},
          expectedResult: 'Screen inspected',
          verificationMethod: 'command_success',
          riskLevel: 'LOW',
          timeoutMs: 5000,
          retryPolicy: { maxRetries: 1, backoffMs: 100, allowReplanOnExhaustion: false },
        },
      ],
      overallRisk: 'LOW',
      currentStepIndex: 1,
      status: 'RUNNING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockRecords = [
      {
        stepId: 'step-1',
        stepNumber: 1,
        title: 'Step 1: Check System',
        skillId: 'system_skill',
        action: 'get_system_info',
        resolvedParams: {},
        success: true,
        verified: true,
        durationMs: 12,
        retriesUsed: 0,
      },
    ];

    // Save checkpoint after step 1
    const ckpt = checkpointManager.saveCheckpoint(mockWf, mockRecords, 'RUNNING');
    expect(ckpt.completedStepCount).toBe(1);
    expect(ckpt.status).toBe('RUNNING');

    // Simulate step 2 failure with recovery capability
    const failureCkpt = checkpointManager.saveCheckpoint(
      mockWf,
      mockRecords,
      'FAILED',
      'step-2',
      'Window was minimized',
      true
    );

    const recovery = checkpointManager.analyzeRecovery(failureCkpt);
    expect(recovery.canResume).toBe(true);
    expect(recovery.resumeStepIndex).toBe(1);
    expect(recovery.recommendedAction).toBe('RESUME_STEP');
  });

  it('fails closed when an irrecoverable workflow failure occurs', () => {
    const mockWf: WorkflowDefinition = {
      id: 'test-wf-102',
      goal: 'Unrecoverable test',
      language: 'en',
      interpretedIntent: 'Unrecoverable',
      steps: [],
      overallRisk: 'LOW',
      currentStepIndex: 0,
      status: 'FAILED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const unrecoverableCkpt = checkpointManager.saveCheckpoint(
      mockWf,
      [],
      'FAILED',
      'step-1',
      'Permission permanently denied',
      false // Not recoverable
    );

    const recovery = checkpointManager.analyzeRecovery(unrecoverableCkpt);
    expect(recovery.canResume).toBe(false);
    expect(recovery.recommendedAction).toBe('FAIL_CLOSED');
  });
});
