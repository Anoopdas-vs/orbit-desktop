import { describe, it, expect } from 'vitest';
import { replanningEngine } from '../src/core/replanning-engine';
import { DynamicPlannedStep, DynamicPlannedTask, FailureDiagnosis } from '../src/types/task-planning';

describe('Phase 4B: Replanning Engine Hardening & Invariants', () => {
  const sampleStep: DynamicPlannedStep = {
    id: 'step-nav-1',
    stepNumber: 1,
    title: 'Navigate to Docs',
    skillId: 'browser_skill',
    action: 'navigate',
    params: { url: 'https://docs.example.com', browser: 'Safari' },
    preconditions: { requiredActiveApp: 'Safari' },
    expectedResult: 'Docs page loaded',
    verificationMethod: 'command_success',
    verificationCriteria: {},
    riskLevel: 'LOW',
    timeoutMs: 6000,
    retryPolicy: { maxRetries: 1, backoffMs: 300, allowReplanOnExhaustion: true },
  };

  const sampleTask: DynamicPlannedTask = {
    id: 'task-rep-1',
    goal: 'Read documentation in Safari',
    language: 'en',
    interpretedIntent: 'Read docs',
    targetApp: 'Safari',
    steps: [sampleStep],
    overallRisk: 'LOW',
    replanCount: 0,
    maxReplans: 2,
  };

  describe('Integration with Recovery Catalog', () => {
    it('diagnoses browser navigation timeout and generates replanned sequence', () => {
      const diagnosis = replanningEngine.diagnoseFailure(
        sampleStep,
        'Navigation failed: page load timed out after 8000ms',
        'Safari'
      );

      expect(diagnosis.rootCause).toBe('BROWSER_TIMEOUT');
      expect(diagnosis.recoveryStrategy).toBe('RELOAD_TAB');

      const replanned = replanningEngine.replan(sampleTask, 0, diagnosis);
      expect(replanned).not.toBeNull();
      expect(replanned?.replanCount).toBe(1);
      expect(replanned?.steps.length).toBe(2);

      // Step 1: Reload tab
      expect(replanned?.steps[0].action).toBe('reload');
      expect(replanned?.steps[0].stepNumber).toBe(1);

      // Step 2: Retried navigate step
      expect(replanned?.steps[1].action).toBe('navigate');
      expect(replanned?.steps[1].stepNumber).toBe(2);
    });

    it('diagnoses file not found and generates Spotlight search recovery', () => {
      const fileStep: DynamicPlannedStep = {
        ...sampleStep,
        skillId: 'files_skill',
        action: 'open_file',
        params: { path: '/Users/test/Downloads/data.csv' },
      };
      const fileTask: DynamicPlannedTask = {
        ...sampleTask,
        steps: [fileStep],
      };

      const diagnosis = replanningEngine.diagnoseFailure(
        fileStep,
        'Error: ENOENT no such file or directory data.csv'
      );

      expect(diagnosis.rootCause).toBe('FILE_NOT_FOUND');
      expect(diagnosis.recoveryStrategy).toBe('MDFIND_FALLBACK');

      const replanned = replanningEngine.replan(fileTask, 0, diagnosis);
      expect(replanned).not.toBeNull();
      expect(replanned?.steps[0].action).toBe('find_files');
      expect(replanned?.steps[0].params.query).toBe('data.csv');
    });
  });

  describe('Strict Invariants Enforcement', () => {
    it('strictly enforces max 2 replans budget cap (fails closed)', () => {
      const maxedTask: DynamicPlannedTask = {
        ...sampleTask,
        replanCount: 2,
        maxReplans: 2,
      };

      const diagnosis = replanningEngine.diagnoseFailure(
        sampleStep,
        'Navigation failed: page load timed out',
        'Safari'
      );

      const replanned = replanningEngine.replan(maxedTask, 0, diagnosis);
      expect(replanned).toBeNull(); // Fails closed after budget exhausted
    });

    it('rejects replanning with FAIL_CLOSED recovery strategy', () => {
      const failClosedDiagnosis: FailureDiagnosis = {
        failedStepId: sampleStep.id,
        action: sampleStep.action,
        expectedState: sampleStep.expectedResult,
        observedState: 'Permission denied',
        rootCause: 'PERMISSION_DENIED',
        recoveryStrategy: 'FAIL_CLOSED',
        suggestedSteps: [],
      };

      const replanned = replanningEngine.replan(sampleTask, 0, failClosedDiagnosis);
      expect(replanned).toBeNull();
    });

    it('prohibits risk escalation in suggested recovery steps', () => {
      const escalatedDiagnosis: FailureDiagnosis = {
        failedStepId: sampleStep.id,
        action: sampleStep.action,
        expectedState: sampleStep.expectedResult,
        observedState: 'Error',
        rootCause: 'UNKNOWN',
        recoveryStrategy: 'RESTART_APP',
        suggestedSteps: [
          {
            ...sampleStep,
            id: 'escalated-step',
            riskLevel: 'HIGH', // Escalation over task's LOW risk!
          },
        ],
      };

      const replanned = replanningEngine.replan(sampleTask, 0, escalatedDiagnosis);
      expect(replanned).toBeNull();
    });

    it('prohibits blind identical retries without intervening remediation', () => {
      const blindRetryDiagnosis: FailureDiagnosis = {
        failedStepId: sampleStep.id,
        action: sampleStep.action,
        expectedState: sampleStep.expectedResult,
        observedState: 'Failed',
        rootCause: 'UNKNOWN',
        recoveryStrategy: 'RELOAD_TAB',
        // Blind retry: only 1 step, identical action, skill, and params
        suggestedSteps: [{ ...sampleStep }],
      };

      const replanned = replanningEngine.replan(sampleTask, 0, blindRetryDiagnosis);
      expect(replanned).toBeNull(); // Blind retry prohibited!
    });
  });
});
