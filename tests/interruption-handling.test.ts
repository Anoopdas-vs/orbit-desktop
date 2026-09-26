import { describe, it, expect, beforeEach } from 'vitest';
import { killSwitch } from '../src/core/kill-switch';
import { commandRouter } from '../src/core/router';
import { closedLoopExecutor } from '../src/core/execution-loop';
import { actionPlanner } from '../src/core/action-planner';

describe('Phase 2 Interruption Handling & Emergency Stop', () => {
  beforeEach(() => {
    killSwitch.disengage();
  });

  it('halts multi-step task execution immediately when kill switch is engaged', async () => {
    const task = actionPlanner.plan('Open Safari and search for Oksy Healthcare')!;
    expect(task).not.toBeNull();

    // Engage kill switch before running
    killSwitch.engage('Test interruption', 'user-ui');

    const result = await closedLoopExecutor.executeTask(task);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Emergency Kill Switch');
    expect(result.completedSteps).toBe(0);
  });

  it('disarms router execution upon receiving voice command "stop"', async () => {
    const plan = await commandRouter.route('Stop', { registeredProjects: [] });
    expect(plan.status).toBe('ABORTED_BY_KILL_SWITCH');
    expect(plan.interpretedIntent).toBe('Emergency Stop Engaged');
    expect(killSwitch.isEngaged()).toBe(true);
  });

  it('disarms router execution upon receiving voice command "cancel"', async () => {
    const plan = await commandRouter.route('Cancel', { registeredProjects: [] });
    expect(plan.status).toBe('ABORTED_BY_KILL_SWITCH');
    expect(killSwitch.isEngaged()).toBe(true);
  });

  it('disarms router execution upon receiving "emergency stop"', async () => {
    const plan = await commandRouter.route('emergency stop', { registeredProjects: [] });
    expect(plan.status).toBe('ABORTED_BY_KILL_SWITCH');
    expect(killSwitch.isEngaged()).toBe(true);
  });
});
