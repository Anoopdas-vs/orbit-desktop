import { describe, it, expect } from 'vitest';
import { dynamicPlanner } from '../src/core/dynamic-planner';
import { replanningEngine } from '../src/core/replanning-engine';
import { DynamicPlannedStep, DynamicPlannedTask } from '../src/types/task-planning';

describe('Phase 3 Stage 2: Dynamic Task Planning & Adaptive Re-Planning', () => {
  describe('Dynamic Task Planner', () => {
    it('decomposes browser search into typed executable steps with pre/post-conditions', () => {
      const task = dynamicPlanner.decomposeGoal('Open Safari and search for Oksy Healthcare');

      expect(task).not.toBeNull();
      expect(task?.steps.length).toBe(3);
      expect(task?.overallRisk).toBe('LOW');

      // Step 1: Open app
      const step1 = task!.steps[0];
      expect(step1.action).toBe('open_app');
      expect(step1.verificationMethod).toBe('app_active');
      expect(step1.retryPolicy.maxRetries).toBe(2);

      // Step 2: Focus search field
      const step2 = task!.steps[1];
      expect(step2.action).toBe('focus_search_field');
      expect(step2.preconditions.requiredActiveApp).toBe('Safari');
      expect(step2.verificationMethod).toBe('element_present');

      // Step 3: Submit search
      const step3 = task!.steps[2];
      expect(step3.action).toBe('submit_search');
      expect(step3.params.query).toBe('Oksy Healthcare');
      expect(step3.verificationMethod).toBe('window_title');
    });

    it('converts dynamic planned task to backward-compatible ActionItems', () => {
      const task = dynamicPlanner.decomposeGoal('Calculate 125 * 48 in Calculator');
      expect(task).not.toBeNull();

      const actionItems = dynamicPlanner.toActionItems(task!);
      expect(actionItems.length).toBe(2);
      expect(actionItems[0].skillId).toBe('computer_control');
      expect(actionItems[0].status).toBe('PENDING_APPROVAL');
      expect(actionItems[1].params.action).toBe('calculate_expression');
    });

    it('decomposes contextual first result click task', () => {
      const task = dynamicPlanner.decomposeGoal('Click first result link in Safari', 'Safari');
      expect(task).not.toBeNull();
      expect(task?.steps.length).toBe(2);
      expect(task?.steps[1].action).toBe('semantic_click');
    });
  });

  describe('Adaptive Re-Planning Engine', () => {
    const mockStep: DynamicPlannedStep = {
      id: 'step-123',
      stepNumber: 1,
      title: 'Focus Address Bar',
      skillId: 'computer_control',
      action: 'focus_search_field',
      target: 'Safari address bar',
      params: { appName: 'Safari' },
      preconditions: { requiredActiveApp: 'Safari' },
      expectedResult: 'Address bar focused',
      verificationMethod: 'element_present',
      verificationCriteria: { role: 'TEXTFIELD' },
      riskLevel: 'LOW',
      timeoutMs: 5000,
      retryPolicy: { maxRetries: 2, backoffMs: 300, allowReplanOnExhaustion: true },
    };

    const mockTask: DynamicPlannedTask = {
      id: 'task-123',
      goal: 'Search in Safari',
      language: 'en',
      interpretedIntent: 'Search Safari',
      targetApp: 'Safari',
      steps: [mockStep],
      overallRisk: 'LOW',
      replanCount: 0,
      maxReplans: 2,
    };

    it('diagnoses APP_NOT_ACTIVE when observed state does not contain target app', () => {
      const diagnosis = replanningEngine.diagnoseFailure(
        mockStep,
        'Active App: Finder (Running: Finder, Terminal)',
        'Safari'
      );

      expect(diagnosis.rootCause).toBe('APP_NOT_ACTIVE');
      expect(diagnosis.recoveryStrategy).toBe('ACTIVATE_APP');
      expect(diagnosis.suggestedSteps.length).toBe(2);
      expect(diagnosis.suggestedSteps[0].action).toBe('activate_app');
    });

    it('re-plans task by inserting recovery activation steps', () => {
      const diagnosis = replanningEngine.diagnoseFailure(
        mockStep,
        'Active App: Finder',
        'Safari'
      );

      const replanned = replanningEngine.replan(mockTask, 0, diagnosis);
      expect(replanned).not.toBeNull();
      expect(replanned?.replanCount).toBe(1);
      expect(replanned?.steps.length).toBe(2);
      expect(replanned?.steps[0].action).toBe('activate_app');
      expect(replanned?.steps[0].stepNumber).toBe(1);
      expect(replanned?.steps[1].stepNumber).toBe(2);
    });

    it('strictly limits dynamic re-planning to maximum 2 iterations (fails closed)', () => {
      const maxedTask: DynamicPlannedTask = {
        ...mockTask,
        replanCount: 2,
        maxReplans: 2,
      };

      const diagnosis = replanningEngine.diagnoseFailure(
        mockStep,
        'Active App: Unknown',
        'Safari'
      );

      const replanned = replanningEngine.replan(maxedTask, 0, diagnosis);
      expect(replanned).toBeNull(); // Fails closed after 2 replans
    });

    it('prohibits risk escalation during autonomous re-planning', () => {
      const lowRiskTask: DynamicPlannedTask = {
        ...mockTask,
        overallRisk: 'LOW',
      };

      // An escalated recovery step with HIGH risk
      const escalatedDiagnosis = {
        failedStepId: mockStep.id,
        action: mockStep.action,
        expectedState: mockStep.expectedResult,
        observedState: 'Failed',
        rootCause: 'UNKNOWN' as const,
        recoveryStrategy: 'FAIL_CLOSED' as const,
        suggestedSteps: [
          {
            ...mockStep,
            riskLevel: 'HIGH' as const, // Prohibited escalation!
          },
        ],
      };

      const replanned = replanningEngine.replan(lowRiskTask, 0, escalatedDiagnosis);
      expect(replanned).toBeNull();
    });
  });
});
