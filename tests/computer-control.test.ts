import { describe, it, expect } from 'vitest';
import { computerTool, computerControlSkill } from '../src/skills/computer-control';
import { nativeBridge } from '../src/adapters/native/tauri-bridge';

describe('Phase 2B: Computer Control Engine', () => {
  it('activates and controls applications', async () => {
    const res = await computerTool.activateApp('Safari');
    expect(res.success).toBe(true);
    expect(res.action).toBe('activate_app');
  });

  it('manages windows: focus, minimize, zoom, resize, and move', async () => {
    const focusRes = await computerTool.focusWindow('Google Search', 'Safari');
    expect(focusRes.success).toBe(true);

    const minRes = await computerTool.minimizeWindow('Safari');
    expect(minRes.success).toBe(true);

    const zoomRes = await computerTool.zoomWindow('Safari');
    expect(zoomRes.success).toBe(true);

    const resizeRes = await computerTool.resizeWindow('Safari', 1280, 800);
    expect(resizeRes.success).toBe(true);

    const moveRes = await computerTool.moveWindow('Safari', 100, 100);
    expect(moveRes.success).toBe(true);
  });

  it('simulates mouse clicking and scrolling', async () => {
    const leftClick = await computerTool.click(500, 300, 'left');
    expect(leftClick.success).toBe(true);

    const doubleClick = await computerTool.doubleClick(500, 300);
    expect(doubleClick.success).toBe(true);

    const rightClick = await computerTool.click(500, 300, 'right');
    expect(rightClick.success).toBe(true);

    const scrollRes = await computerTool.scroll(5);
    expect(scrollRes.success).toBe(true);
  });

  it('simulates keyboard typing and shortcuts', async () => {
    const typeRes = await computerTool.type('Hello from Janki Autonomous Control', 'TextEdit');
    expect(typeRes.success).toBe(true);

    const keyRes = await computerTool.keyPress('return', 'TextEdit');
    expect(keyRes.success).toBe(true);

    const shortcutRes = await computerTool.shortcut(['cmd'], 'c', 'TextEdit');
    expect(shortcutRes.success).toBe(true);
  });

  it('controls system audio volume and mute', async () => {
    const volRes = await computerTool.setVolume(75);
    expect(volRes.success).toBe(true);

    const muteRes = await computerTool.toggleMute();
    expect(muteRes.success).toBe(true);

    const mediaRes = await computerTool.mediaControl('playpause');
    expect(mediaRes.success).toBe(true);
  });

  it('supports dry run execution via computerControlSkill', async () => {
    const dryRun = await computerControlSkill.dryRun!(
      { action: 'activate_app', appName: 'Safari' },
      { isDryRun: true, userPrompt: 'activate safari', killSwitchActive: () => false }
    );
    expect(dryRun.success).toBe(true);
    expect(dryRun.data?.action).toBe('activate_app');
    expect(dryRun.message).toContain('[DRY RUN]');
  });

  it('blocks execution when Emergency Kill Switch is engaged', async () => {
    const res = await computerControlSkill.execute(
      { action: 'mouse_click', x: 200, y: 200 },
      { isDryRun: false, userPrompt: 'click', killSwitchActive: () => true }
    );
    expect(res.success).toBe(false);
    expect(res.error).toContain('Emergency Kill Switch');
  });
});
