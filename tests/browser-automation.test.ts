import { describe, it, expect, beforeEach, vi } from 'vitest';
import { browserSkill } from '../src/skills/browser/browser-skill';
import { skillRegistry } from '../src/skills/skill-registry';
import { killSwitch } from '../src/core/kill-switch';
import { nativeBridge } from '../src/adapters/native/tauri-bridge';

describe('Phase 3 Stage 3: Browser Automation Skill', () => {
  beforeEach(() => {
    killSwitch.disengage();
    vi.restoreAllMocks();
  });

  it('has correct manifest metadata', () => {
    expect(browserSkill.id).toBe('browser_skill');
    expect(browserSkill.name).toContain('Browser');
    expect(browserSkill.capabilities).toContain('safari_automation');
    expect(browserSkill.capabilities).toContain('chrome_automation');
    expect(browserSkill.riskLevel).toBe('LOW');
    expect(skillRegistry.hasSkill('browser_skill')).toBe(true);
  });

  it('navigates to a URL in Safari by default', async () => {
    const openSpy = vi.spyOn(nativeBridge, 'openUrl').mockResolvedValue({
      success: true,
      url: 'https://news.ycombinator.com',
      browser: 'Safari',
      message: 'Opened in Safari',
    });
    const result = await skillRegistry.dispatch('browser_skill', {
      action: 'navigate',
      url: 'https://news.ycombinator.com',
      browser: 'Safari',
    }, {
      sessionId: 'session-browser-1',
      riskTier: 'LOW',
    });

    expect(result.success).toBe(true);
    expect(result.data?.action).toBe('navigate');
    expect(openSpy).toHaveBeenCalledWith('https://news.ycombinator.com', 'Safari');
  });

  it('rejects invalid or unsafe URL formats', async () => {
    const result = await skillRegistry.dispatch('browser_skill', {
      action: 'navigate',
      url: 'javascript:alert(1)',
      browser: 'Safari',
    }, {
      sessionId: 'session-browser-2',
      riskTier: 'LOW',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles tab lifecycle (open_tab, switch_tab, close_tab)', async () => {
    const controlSpy = vi.spyOn(nativeBridge, 'controlAction').mockResolvedValue({ success: true, action: 'key_shortcut' });

    // Open tab
    const openTabRes = await browserSkill.execute({
      action: 'open_tab',
      browser: 'Google Chrome',
      url: 'https://google.com',
    }, { sessionId: 'session-tab-1', riskTier: 'LOW', killSwitchActive: () => false });
    expect(openTabRes.success).toBe(true);
    expect(controlSpy).toHaveBeenCalled();

    // Switch tab
    const switchTabRes = await browserSkill.execute({
      action: 'switch_tab',
      browser: 'Google Chrome',
      tabIndex: 2,
    }, { sessionId: 'session-tab-1', riskTier: 'LOW', killSwitchActive: () => false });
    expect(switchTabRes.success).toBe(true);

    // Close tab
    const closeTabRes = await browserSkill.execute({
      action: 'close_tab',
      browser: 'Google Chrome',
    }, { sessionId: 'session-tab-1', riskTier: 'LOW', killSwitchActive: () => false });
    expect(closeTabRes.success).toBe(true);
  });

  it('performs semantic interaction (fill_field, click_link, scroll_page)', async () => {
    vi.spyOn(nativeBridge, 'getUiTree').mockResolvedValue({
      appName: 'Safari',
      windowTitle: 'Search',
      elements: [],
      totalCount: 0,
    });
    vi.spyOn(nativeBridge, 'guiAction').mockResolvedValue({
      success: true,
      action: 'click_button',
      appName: 'Safari',
      stdout: 'Clicked button',
    });
    vi.spyOn(nativeBridge, 'controlAction').mockResolvedValue({
      success: true,
      action: 'key_press',
    });

    // Fill field
    const fillRes = await browserSkill.execute({
      action: 'fill_field',
      target: 'search',
      text: 'Janki AI Automation',
      browser: 'Safari',
    }, { sessionId: 'session-interact-1', riskTier: 'LOW', killSwitchActive: () => false });
    expect(fillRes.success).toBe(true);
    expect(fillRes.data?.action).toBe('fill_field');

    // Click link
    const clickRes = await browserSkill.execute({
      action: 'click_link',
      target: 'result-link',
      browser: 'Safari',
    }, { sessionId: 'session-interact-1', riskTier: 'LOW', killSwitchActive: () => false });
    expect(clickRes.success).toBe(true);

    // Scroll page
    const scrollRes = await browserSkill.execute({
      action: 'scroll_page',
      scrollDirection: 'down',
      browser: 'Safari',
    }, { sessionId: 'session-interact-1', riskTier: 'LOW', killSwitchActive: () => false });
    expect(scrollRes.success).toBe(true);
  });

  it('observes page state and returns DOM metadata', async () => {
    vi.spyOn(nativeBridge, 'executeAppleScript').mockResolvedValue(
      JSON.stringify({
        title: 'Hacker News',
        url: 'https://news.ycombinator.com',
        linksCount: 42,
        inputsCount: 1,
      })
    );

    const result = await browserSkill.execute({
      action: 'observe_page_state',
      browser: 'Safari',
    }, { sessionId: 'session-obs-1', riskTier: 'LOW', killSwitchActive: () => false });

    expect(result.success).toBe(true);
    expect(result.data?.action).toBe('observe_page_state');
  });

  it('aborts browser actions if Emergency Stop is engaged', async () => {
    killSwitch.engage('Browser kill test', 'user-ui');

    const result = await skillRegistry.dispatch('browser_skill', {
      action: 'navigate',
      url: 'https://apple.com',
    }, {
      sessionId: 'session-kill-1',
      riskTier: 'LOW',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Emergency Kill Switch');
  });

  it('supports dry run mode without executing side-effects', async () => {
    const openSpy = vi.spyOn(nativeBridge, 'openUrl');
    const result = await browserSkill.dryRun({
      action: 'navigate',
      browser: 'Safari',
      url: 'https://example.com',
    }, {
      sessionId: 'session-dry-1',
      riskTier: 'LOW',
      killSwitchActive: () => false,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('DRY RUN');
    expect(openSpy).not.toHaveBeenCalled();
  });
});
