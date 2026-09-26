import { nativeBridge, PermissionStatus } from '../adapters/native/tauri-bridge';

export class PermissionManager {
  private lastStatus: PermissionStatus | null = null;

  public async getStatus(): Promise<PermissionStatus> {
    try {
      const status = await nativeBridge.checkPermissions();
      this.lastStatus = status;
      return status;
    } catch (err: any) {
      const fallback: PermissionStatus = {
        accessibilityGranted: false,
        screenRecordingGranted: false,
        automationGranted: false,
        microphoneGranted: true,
        message: `Failed to query permissions: ${err.message}`,
        actionRequired: 'Ensure Janki is running with standard desktop privileges.',
      };
      this.lastStatus = fallback;
      return fallback;
    }
  }

  public async isAutonomousControlReady(): Promise<boolean> {
    const status = await this.getStatus();
    return status.accessibilityGranted;
  }

  public getLastCachedStatus(): PermissionStatus | null {
    return this.lastStatus;
  }
}

export const permissionManager = new PermissionManager();
