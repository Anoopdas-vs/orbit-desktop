import { describe, it, expect } from 'vitest';
import { screenSkill } from '../src/skills/screen/screen-skill';
import { screenUnderstandingTool } from '../src/tools/screen/screen-understanding-tool';
import { nativeBridge } from '../src/adapters/native/tauri-bridge';

describe('Phase 6: Multimodal Screen / Vision Understanding', () => {
  it('captures the current screen safely to disk', async () => {
    const res = await screenSkill.execute(
      { action: 'capture_screen', outputPath: '/tmp/test_capture.png' },
      { sessionId: 'test', killSwitchActive: () => false }
    );

    expect(res.success).toBe(true);
    expect(res.data?.filePath).toContain('test_capture.png');
  });

  it('inspects visible active desktop window controls and dialog elements', async () => {
    const res = await screenSkill.execute(
      { action: 'inspect_screen', targetApp: 'Safari' },
      { sessionId: 'test', killSwitchActive: () => false }
    );

    expect(res.success).toBe(true);
    expect(res.data?.activeApp).toBe('Safari');
    expect(res.data?.elements).toBeDefined();
    expect(res.data?.summary).toContain('Safari');
  });

  it('locates specific text or invoice patterns on screen', async () => {
    const res = await screenSkill.execute(
      { action: 'find_text_on_screen', queryText: 'Search' },
      { sessionId: 'test', killSwitchActive: () => false }
    );

    expect(res.success).toBe(true);
    expect(res.data?.matchingElements?.length).toBeGreaterThan(0);
  });

  it('explains screen state clearly for user queries ("What is on my screen?")', async () => {
    const res = await screenUnderstandingTool.execute(
      { action: 'explain_screen' },
      { killSwitchActive: () => false }
    );

    expect(res.status).toBe('SUCCESS');
    expect(res.data?.summary).toContain('Safari');
    expect(res.message).toBeDefined();
  });

  it('executes the Observe -> Act -> Observe Again -> Verify loop', async () => {
    // 1. Observe initial state
    const initialObs = await nativeBridge.getComputerState();
    expect(initialObs.activeApp).toBe('Safari');

    // 2. Act: launch Google Chrome
    await nativeBridge.openApp('Google Chrome');

    // 3. Observe Again
    const postObs = await nativeBridge.getComputerState();
    expect(postObs.activeApp).toBe('Google Chrome');

    // 4. Verify
    const verifySuccess = postObs.activeApp === 'Google Chrome';
    expect(verifySuccess).toBe(true);
  });
});
