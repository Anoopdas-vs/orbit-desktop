import { describe, it, expect, beforeEach } from 'vitest';
import { killSwitch } from '../src/core/kill-switch';
import { terminalRunnerSkill } from '../src/skills/terminal-runner';
import { openApplicationSkill } from '../src/skills/open-application';

describe('Emergency Kill Switch Behavior', () => {
  beforeEach(() => {
    killSwitch.disengage();
  });

  it('starts in disengaged state', () => {
    expect(killSwitch.isEngaged()).toBe(false);
  });

  it('aborts registered running processes when engaged', () => {
    const abort1 = new AbortController();
    const abort2 = new AbortController();

    killSwitch.registerProcess('p1', 'npm run dev', abort1);
    killSwitch.registerProcess('p2', 'vitest watch', abort2);

    expect(killSwitch.getRunningProcessCount()).toBe(2);

    const killedCount = killSwitch.engage('Emergency stop test');

    expect(killedCount).toBe(2);
    expect(abort1.signal.aborted).toBe(true);
    expect(abort2.signal.aborted).toBe(true);
    expect(killSwitch.isEngaged()).toBe(true);
  });

  it('blocks skill execution when kill switch is active', async () => {
    killSwitch.engage('Safety lockdown');

    const context = {
      isDryRun: false,
      userPrompt: 'npm test',
      killSwitchActive: () => killSwitch.isEngaged(),
    };

    const termResult = await terminalRunnerSkill.execute({ command: 'npm test', timeoutMs: 1000 }, context);
    expect(termResult.success).toBe(false);
    expect(termResult.error).toContain('Kill Switch is engaged');

    const appResult = await openApplicationSkill.execute({ appName: 'Terminal' }, context);
    expect(appResult.success).toBe(false);
    expect(appResult.error).toContain('Kill Switch is engaged');
  });

  it('allows actions again after disengaging', async () => {
    killSwitch.engage('Temporary test');
    expect(killSwitch.isEngaged()).toBe(true);

    killSwitch.disengage();
    expect(killSwitch.isEngaged()).toBe(false);

    const context = {
      isDryRun: false,
      userPrompt: 'npm test',
      killSwitchActive: () => killSwitch.isEngaged(),
    };

    const appResult = await openApplicationSkill.execute({ appName: 'Terminal' }, context);
    expect(appResult.success).toBe(true);
  });
});
