import { describe, it, expect } from 'vitest';
import { commandRouter } from '../src/core/router';
import { checkApplicationAvailability, appAvailabilitySkill } from '../src/skills/app-availability';
import { guiControllerSkill } from '../src/skills/gui-controller';
import { youtubeAdSkipperSkill, youtubeAdSkipperDaemon } from '../src/skills/youtube-ad-skipper';
import { aiPromptAgentSkill } from '../src/skills/ai-prompt-agent';
import { resolvePlayableUrl } from '../src/skills/youtube-launcher';

describe('Application Availability Pre-Check Skill (<1ms Fastest Mode)', () => {
  it('instantly resolves known applications with fastest mode', async () => {
    const start = performance.now();
    const result = await checkApplicationAvailability('Google Chrome');
    const duration = performance.now() - start;

    expect(result.appName).toBe('Google Chrome');
    expect(result.available).toBe(true);
    expect(result.fastestMode).toBe('native_app');
    expect(duration).toBeLessThan(100); // Super fast execution
  });

  it('marks uninstalled applications as browser fallback mode', async () => {
    const result = await checkApplicationAvailability('NonExistentApp123');
    expect(result.available).toBe(false);
    expect(result.fastestMode).toBe('browser_web');
  });

  it('supports dryRun on appAvailabilitySkill', async () => {
    const res = await appAvailabilitySkill.dryRun!({ appName: 'ChatGPT' }, {
      isDryRun: true,
      userPrompt: 'check chatgpt',
      killSwitchActive: () => false,
    });
    expect(res.success).toBe(true);
    expect(res.data?.appName).toBe('ChatGPT');
  });
});

describe('Native GUI Controller Skill', () => {
  it('supports dry run for clicking buttons', async () => {
    const res = await guiControllerSkill.dryRun!(
      { action: 'click_button', appName: 'Google Chrome', target: 'Skip' },
      { isDryRun: true, userPrompt: 'click skip', killSwitchActive: () => false }
    );
    expect(res.success).toBe(true);
    expect(res.data?.target).toBe('Skip');
    expect(res.message).toContain('Would click button "Skip"');
  });

  it('executes text typing and key simulation', async () => {
    const res = await guiControllerSkill.execute(
      { action: 'type_text', appName: 'TextEdit', text: 'Hello from Janki' },
      { isDryRun: false, userPrompt: 'type Hello', killSwitchActive: () => false }
    );
    expect(res.success).toBe(true);
    expect(res.data?.executed).toBe(true);
    expect(res.data?.text).toBe('Hello from Janki');
  });

  it('respects emergency kill switch', async () => {
    const res = await guiControllerSkill.execute(
      { action: 'click_button', appName: 'Finder', target: 'Cancel' },
      { isDryRun: false, userPrompt: 'click cancel', killSwitchActive: () => true }
    );
    expect(res.success).toBe(false);
    expect(res.error).toContain('Emergency Kill Switch');
  });
});

describe('YouTube Automated Ad Skipper Skill & Daemon', () => {
  it('executes one-shot skip action', async () => {
    const res = await youtubeAdSkipperSkill.execute(
      { action: 'skip_now', pollIntervalMs: 1500 },
      { isDryRun: false, userPrompt: 'skip ad', killSwitchActive: () => false }
    );
    expect(res.success).toBe(true);
    expect(res.data?.action).toBe('skip_now');
  });

  it('controls the background watcher daemon', async () => {
    const startRes = await youtubeAdSkipperSkill.execute(
      { action: 'start_daemon', pollIntervalMs: 1500 },
      { isDryRun: false, userPrompt: 'auto skip ads', killSwitchActive: () => false }
    );
    expect(startRes.success).toBe(true);
    expect(startRes.data?.isDaemonRunning).toBe(true);
    expect(youtubeAdSkipperDaemon.getIsRunning()).toBe(true);

    const stopRes = await youtubeAdSkipperSkill.execute(
      { action: 'stop_daemon', pollIntervalMs: 1500 },
      { isDryRun: false, userPrompt: 'stop skip daemon', killSwitchActive: () => false }
    );
    expect(stopRes.success).toBe(true);
    expect(stopRes.data?.isDaemonRunning).toBe(false);
    expect(youtubeAdSkipperDaemon.getIsRunning()).toBe(false);
  });
});

describe('AI Tool Prompting Agent Skill', () => {
  it('pre-checks tool availability and prepares prompt', async () => {
    const dryRun = await aiPromptAgentSkill.dryRun!(
      { tool: 'chatgpt', prompt: 'Explain TCP vs UDP', forceBrowser: false },
      { isDryRun: true, userPrompt: 'ask chatgpt', killSwitchActive: () => false }
    );
    expect(dryRun.success).toBe(true);
    expect(dryRun.data?.tool).toBe('chatgpt');
    expect(dryRun.data?.prompt).toBe('Explain TCP vs UDP');
  });

  it('executes prompt dispatch in fastest mode', async () => {
    const res = await aiPromptAgentSkill.execute(
      { tool: 'claude', prompt: 'Write a unit test', forceBrowser: false },
      { isDryRun: false, userPrompt: 'ask claude', killSwitchActive: () => false }
    );
    expect(res.success).toBe(true);
    expect(res.data?.prompt).toBe('Write a unit test');
  });
});

describe('Command Router Integration with Pre-Checks and GUI Automation', () => {
  const dummyContext = { registeredProjects: [] };

  it('routes "skip youtube ad" to youtube_ad_skipper', async () => {
    const plan = await commandRouter.route('Hey Janki, skip youtube ad', dummyContext);
    expect(plan.interpretedIntent).toBe('Skip YouTube Ad');
    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].skillId).toBe('youtube_ad_skipper');
  });

  it('routes "ask chatgpt how to build a web server" to ai_prompt_agent', async () => {
    const plan = await commandRouter.route('Ask ChatGPT how to build a web server', dummyContext);
    expect(plan.interpretedIntent).toBe('Prompt ChatGPT');
    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].skillId).toBe('ai_prompt_agent');
    expect(plan.actions[0].params.tool).toBe('chatgpt');
    expect(plan.actions[0].params.prompt).toContain('how to build a web server');
    expect(plan.actions[0].description).toContain('Fastest execution mode');
  });

  it('routes "ask claude write a python script" to ai_prompt_agent', async () => {
    const plan = await commandRouter.route('Ask Claude write a python script', dummyContext);
    expect(plan.interpretedIntent).toBe('Prompt Claude');
    expect(plan.actions[0].skillId).toBe('ai_prompt_agent');
    expect(plan.actions[0].params.tool).toBe('claude');
  });

  it('routes "click button Submit" to gui_controller', async () => {
    const plan = await commandRouter.route('Click button Submit', dummyContext);
    expect(plan.interpretedIntent).toBe('Click Button "Submit"');
    expect(plan.actions[0].skillId).toBe('gui_controller');
    expect(plan.actions[0].params.action).toBe('click_button');
    expect(plan.actions[0].params.target).toBe('Submit');
  });

  it('routes "press enter" to gui_controller key action', async () => {
    const plan = await commandRouter.route('Press enter', dummyContext);
    expect(plan.interpretedIntent).toBe('Press Key ENTER');
    expect(plan.actions[0].skillId).toBe('gui_controller');
    expect(plan.actions[0].params.action).toBe('press_key');
    expect(plan.actions[0].params.key).toBe('enter');
  });

  it('verifies application availability before opening an app', async () => {
    const plan = await commandRouter.route('Open Google Chrome', dummyContext);
    expect(plan.interpretedIntent).toBe('Open Application Google Chrome');
    expect(plan.actions[0].description).toContain('Pre-check verified');
  });

  it('uses in-memory cache for consecutive app availability checks', async () => {
    await checkApplicationAvailability('Safari');
    const cached = await checkApplicationAvailability('Safari');
    expect(cached.available).toBe(true);
    expect(cached.cached).toBe(true);
  });
});

describe('Enhanced Abilities: Coordinate Click, Shortcuts, and Turbo Ad-Skipper', () => {
  it('supports coordinate clicking in GUI Controller', async () => {
    const res = await guiControllerSkill.execute(
      { action: 'click_coordinate', appName: 'Finder', x: 250, y: 400 },
      { isDryRun: false, userPrompt: 'click coordinate', killSwitchActive: () => false }
    );
    expect(res.success).toBe(true);
    expect(res.data?.x).toBe(250);
    expect(res.data?.y).toBe(400);
  });

  it('supports keyboard shortcuts like cmd+v in GUI Controller', async () => {
    const res = await guiControllerSkill.execute(
      { action: 'press_shortcut', appName: 'TextEdit', shortcut: 'cmd+v' },
      { isDryRun: false, userPrompt: 'paste', killSwitchActive: () => false }
    );
    expect(res.success).toBe(true);
    expect(res.data?.shortcut).toBe('cmd+v');
  });

  it('toggles Turbo Mode on YouTube Ad Skipper', async () => {
    const res = await youtubeAdSkipperSkill.execute(
      { action: 'toggle_turbo' },
      { isDryRun: false, userPrompt: 'toggle turbo', killSwitchActive: () => false }
    );
    expect(res.success).toBe(true);
    expect(res.data?.action).toBe('toggle_turbo');
    expect(typeof res.data?.turboMode).toBe('boolean');
  });
});

describe('Direct Playable Video & Fastest Mode Auto-Launch', () => {
  it('resolves generic music terms directly to playable watch URLs with autoplay', () => {
    const genericQueries = ['some music', 'music', 'songs', 'relaxing music', 'lofi'];
    for (const q of genericQueries) {
      const res = resolvePlayableUrl(q);
      expect(res.isDirectVideo).toBe(true);
      expect(res.targetUrl).toContain('/watch?v=');
      expect(res.targetUrl).toContain('autoplay=1');
      expect(res.targetUrl).not.toContain('/results');
    }
  });

  it('resolves known song titles directly to watch URLs', () => {
    const believerRes = resolvePlayableUrl('play Believer');
    expect(believerRes.isDirectVideo).toBe(true);
    expect(believerRes.targetUrl).toBe('https://www.youtube.com/watch?v=7wtfhZwyrcc&autoplay=1');

    const shapeRes = resolvePlayableUrl('play Shape of You');
    expect(shapeRes.isDirectVideo).toBe(true);
    expect(shapeRes.targetUrl).toBe('https://www.youtube.com/watch?v=JGwWNGJdvx8&autoplay=1');
  });

  it('routes music commands with forceBrowser: true when fastMode is enabled', async () => {
    const plan = await commandRouter.route('open youtube and play some music', {
      registeredProjects: [],
      fastMode: true,
    });
    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].skillId).toBe('youtube_launcher');
    expect(plan.actions[0].params.forceBrowser).toBe(true);
    expect(plan.actions[0].description).toContain('Fast Mode');
  });

  it('routes music commands with forceBrowser: false when fastMode is disabled', async () => {
    const plan = await commandRouter.route('open youtube and play some music', {
      registeredProjects: [],
      fastMode: false,
    });
    expect(plan.actions.length).toBe(1);
    expect(plan.actions[0].skillId).toBe('youtube_launcher');
    expect(plan.actions[0].params.forceBrowser).toBe(false);
  });
});

