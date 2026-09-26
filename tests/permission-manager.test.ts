import { describe, it, expect, beforeEach } from 'vitest';
import { permissionManager } from '../src/core/permission-manager';
import { nativeBridge } from '../src/adapters/native/tauri-bridge';

describe('Phase 2J: Permission Management', () => {
  beforeEach(() => {
    nativeBridge.resetDriver();
  });

  it('queries macOS permission status through the bridge', async () => {
    const status = await permissionManager.getStatus();
    expect(status).toHaveProperty('accessibilityGranted');
    expect(status).toHaveProperty('automationGranted');
    expect(status).toHaveProperty('screenRecordingGranted');
    expect(typeof status.message).toBe('string');
  });

  it('verifies that autonomous control is ready when accessibility is granted', async () => {
    const ready = await permissionManager.isAutonomousControlReady();
    expect(ready).toBe(true);
  });

  it('reports missing permission and required user action when accessibility is false', async () => {
    nativeBridge.setDriver({
      checkPermissions: async () => ({
        accessibilityGranted: false,
        screenRecordingGranted: false,
        automationGranted: false,
        microphoneGranted: true,
        message: 'macOS Accessibility permission is not granted.',
        actionRequired: 'Open System Settings > Privacy & Security > Accessibility and enable Janki.',
      }),
    });

    const status = await permissionManager.getStatus();
    expect(status.accessibilityGranted).toBe(false);
    expect(status.actionRequired).toContain('System Settings');

    const ready = await permissionManager.isAutonomousControlReady();
    expect(ready).toBe(false);
  });
});
