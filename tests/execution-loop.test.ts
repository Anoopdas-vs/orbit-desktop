import { describe, it, expect, beforeEach } from 'vitest';
import { closedLoopExecutor } from '../src/core/execution-loop';
import { actionPlanner } from '../src/core/action-planner';
import { nativeBridge, INativeBridgeDriver } from '../src/adapters/native/tauri-bridge';
import { useComputerStateStore } from '../src/state/useComputerStateStore';

describe('Phase 2F & 2G: Closed-Loop Execution Loop & Failure Recovery', () => {
  beforeEach(() => {
    nativeBridge.resetDriver();
    useComputerStateStore.getState().reset();
  });

  it('executes a multi-step task and verifies every step outcome', async () => {
    const task = actionPlanner.plan('Open Safari and search for Oksy Healthcare')!;
    expect(task).not.toBeNull();

    const result = await closedLoopExecutor.executeTask(task);
    expect(result.success).toBe(true);
    expect(result.completedSteps).toBe(3);
    expect(result.stepResults.every((s) => s.verified)).toBe(true);

    const memory = useComputerStateStore.getState();
    expect(memory.isVerified).toBe(true);
  });

  it('never falsely claims success when an impossible condition fails to verify', async () => {
    // Inject a driver where the active window never matches the expected title
    nativeBridge.setDriver({
      getComputerState: async () => ({
        activeApp: 'Safari',
        activeWindow: 'Error 404: Not Found',
        runningApps: ['Safari', 'Finder'],
        volume: 50,
        isMuted: false,
      }),
    });

    const impossibleStep = {
      id: 'step_impossible',
      stepNumber: 1,
      title: 'Verify Impossible Target',
      action: 'check_state',
      params: {},
      expectedResult: 'Contains Specific Secret Token',
      verificationMethod: 'window_title' as const,
      verificationCriteria: { contains: 'Specific Secret Token', appName: 'Safari' },
      riskLevel: 'LOW' as const,
      timeoutMs: 1000,
      retryLimit: 2,
    };

    const result = await closedLoopExecutor.executeStepWithRecovery(impossibleStep, 'Safari');
    // Must truthfully report failure
    expect(result.verified).toBe(false);
    expect(result.success).toBe(false);
    expect(result.retriesUsed).toBe(2);
    expect(result.error).toContain('Could not verify');
  });

  it('attempts controlled recovery when initial verification fails', async () => {
    let callCount = 0;
    // Driver fails on 1st check, succeeds on 2nd check after recovery
    nativeBridge.setDriver({
      getComputerState: async () => {
        callCount++;
        return {
          activeApp: callCount > 2 ? 'TargetApp' : 'WrongApp',
          activeWindow: 'Main Window',
          runningApps: ['TargetApp', 'Finder'],
          volume: 50,
          isMuted: false,
        };
      },
      controlAction: async (params) => ({
        success: true,
        action: params.action,
      }),
    });

    const step = {
      id: 'step_recoverable',
      stepNumber: 1,
      title: 'Ensure Target App Active',
      action: 'activate_app',
      params: { appName: 'TargetApp' },
      expectedResult: 'TargetApp active',
      verificationMethod: 'app_active' as const,
      verificationCriteria: { appName: 'TargetApp' },
      riskLevel: 'LOW' as const,
      timeoutMs: 3000,
      retryLimit: 3,
    };

    const result = await closedLoopExecutor.executeStepWithRecovery(step, 'TargetApp');
    expect(result.verified).toBe(true);
    expect(result.retriesUsed).toBeGreaterThan(0);
  });
});
