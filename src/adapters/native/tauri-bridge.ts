/**
 * Unified Native Bridge Adapter for Janki
 * Routes system operations through Tauri v2 IPC when running in desktop mode,
 * with fallback to local Vite dev server (127.0.0.1) during browser development,
 * and explicit mock driver support for headless test suites.
 */

import { invoke, isTauri } from '@tauri-apps/api/core';

export { isTauri };

export const isTauriAvailable = (): boolean => {
  return isTauri() || (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
};

export interface OpenAppResult {
  success: boolean;
  app: string;
  path?: string;
  message: string;
}

export interface OpenUrlResult {
  success: boolean;
  url: string;
  browser: string;
  message: string;
}

export interface CheckAppResult {
  appName: string;
  available: boolean;
  isRunning: boolean;
  appPath?: string;
  fastestMode: string;
  message: string;
}

export interface ExecCommandResult {
  success: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

export interface GuiActionResult {
  success: boolean;
  action: string;
  appName: string;
  stdout: string;
  error?: string;
}

export interface SkipAdResult {
  success: boolean;
  skipped: boolean;
  status: string;
  message: string;
}

export interface ResolveYouTubeResult {
  success: boolean;
  videoId: string;
  targetUrl: string;
  isDirectVideo: boolean;
}

export interface PromptAiResult {
  success: boolean;
  tool: string;
  mode: string;
  message: string;
}

export interface ControlParams {
  action:
    | 'activate_app'
    | 'quit_app'
    | 'focus_window'
    | 'minimize_window'
    | 'zoom_window'
    | 'close_window'
    | 'resize_window'
    | 'move_window'
    | 'mouse_click'
    | 'mouse_double_click'
    | 'mouse_right_click'
    | 'mouse_scroll'
    | 'key_type'
    | 'key_press'
    | 'key_shortcut'
    | 'set_volume'
    | 'toggle_mute'
    | 'media_control';
  appName?: string;
  windowTitle?: string;
  text?: string;
  key?: string;
  modifiers?: string[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  deltaY?: number;
  volumeLevel?: number;
  force?: boolean;
}

export interface ControlResult {
  success: boolean;
  action: string;
  target?: string;
  output?: string;
  error?: string;
}

export interface ComputerStateInfo {
  activeApp: string;
  activeWindow: string;
  runningApps: string[];
  volume: number;
  isMuted: boolean;
}

export interface UiElementInfo {
  id: string;
  role: string;
  title: string;
  description?: string;
  value?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
  focused: boolean;
}

export interface UiTreeResult {
  appName: string;
  windowTitle: string;
  elements: UiElementInfo[];
  totalCount: number;
  error?: string;
}

export interface PermissionStatus {
  accessibilityGranted: boolean;
  screenRecordingGranted: boolean;
  automationGranted: boolean;
  microphoneGranted: boolean;
  message: string;
  actionRequired?: string;
}

export interface FileMetadataResult {
  path: string;
  name: string;
  is_dir: boolean;
  size_bytes: number;
  extension: string;
  is_protected: boolean;
  modified_timestamp?: number;
}

export interface INativeBridgeDriver {
  openApp(appName: string, path?: string): Promise<OpenAppResult>;
  openUrl(url: string, browser?: string): Promise<OpenUrlResult>;
  checkApp(appName: string): Promise<CheckAppResult>;
  execCommand(command: string, cwd?: string): Promise<ExecCommandResult>;
  executeAppleScript?(script: string): Promise<string>;
  guiAction(params: {
    action: string;
    appName?: string;
    target?: string;
    text?: string;
    key?: string;
    shortcut?: string;
    x?: number;
    y?: number;
  }): Promise<GuiActionResult>;
  youtubeSkipAd(): Promise<SkipAdResult>;
  resolveYouTube(query: string): Promise<ResolveYouTubeResult>;
  promptAi(tool: string, prompt: string, useClipboard?: boolean): Promise<PromptAiResult>;
  controlAction(params: ControlParams): Promise<ControlResult>;
  getComputerState(): Promise<ComputerStateInfo>;
  getUiTree(targetApp?: string): Promise<UiTreeResult>;
  checkPermissions(): Promise<PermissionStatus>;
  getFileMetadata?(path: string): Promise<FileMetadataResult>;
  readFile?(path: string, maxBytes?: number): Promise<string>;
  createFile?(path: string, content: string, overwrite?: boolean): Promise<boolean>;
  moveToTrash?(path: string): Promise<boolean>;
}

export class MockNativeDriver implements INativeBridgeDriver {
  private simulatedState: ComputerStateInfo = {
    activeApp: 'Safari',
    activeWindow: 'Safari - Google Search',
    runningApps: ['Safari', 'Finder', 'Google Chrome', 'Calculator'],
    volume: 50,
    isMuted: false,
  };

  public reset(): void {
    this.simulatedState = {
      activeApp: 'Safari',
      activeWindow: 'Safari - Google Search',
      runningApps: ['Safari', 'Finder', 'Google Chrome', 'Calculator'],
      volume: 50,
      isMuted: false,
    };
  }

  public async openApp(appName: string, path?: string): Promise<OpenAppResult> {
    this.simulatedState.activeApp = appName;
    if (!this.simulatedState.runningApps.includes(appName)) {
      this.simulatedState.runningApps.push(appName);
    }
    return {
      success: true,
      app: appName,
      path,
      message: `[Simulated] Successfully launched application: "${appName}"`,
    };
  }

  public async openUrl(url: string, browser?: string): Promise<OpenUrlResult> {
    if (browser) {
      this.simulatedState.activeApp = browser;
    }
    this.simulatedState.activeWindow = decodeURIComponent(url);
    return {
      success: true,
      url,
      browser: browser || 'default',
      message: `[Simulated] Opened URL: "${url}"`,
    };
  }

  public async checkApp(appName: string): Promise<CheckAppResult> {
    const isUninstalled = appName.toLowerCase().includes('nonexistent') || appName === 'NonExistentApp123';
    return {
      appName,
      available: !isUninstalled,
      isRunning: false,
      appPath: !isUninstalled ? `/Applications/${appName}.app` : undefined,
      fastestMode: !isUninstalled ? 'native_app' : 'browser_web',
      message: !isUninstalled ? `Application ${appName} is available.` : `Application ${appName} is not installed.`,
    };
  }

  public async execCommand(command: string, _cwd?: string): Promise<ExecCommandResult> {
    return {
      success: true,
      command,
      stdout: `[Simulated] Command executed successfully: ${command}`,
      stderr: '',
      exitCode: 0,
    };
  }

  public async executeAppleScript(_script: string): Promise<string> {
    return 'ok';
  }

  public async guiAction(params: {
    action: string;
    appName?: string;
    target?: string;
    text?: string;
    key?: string;
    shortcut?: string;
    x?: number;
    y?: number;
  }): Promise<GuiActionResult> {
    return {
      success: true,
      action: params.action,
      appName: params.appName || '',
      stdout: `[Simulated] GUI ${params.action} performed successfully.`,
    };
  }

  public async youtubeSkipAd(): Promise<SkipAdResult> {
    return {
      success: true,
      skipped: true,
      status: 'skipped',
      message: '[Simulated] YouTube ad skipped successfully.',
    };
  }

  public async resolveYouTube(query: string): Promise<ResolveYouTubeResult> {
    return {
      success: true,
      videoId: 'mock_video_id',
      targetUrl: `https://www.youtube.com/watch?v=mock_video_id`,
      isDirectVideo: true,
    };
  }

  public async promptAi(tool: string, prompt: string, _useClipboard = true): Promise<PromptAiResult> {
    return {
      success: true,
      tool,
      mode: 'simulated',
      message: `[Simulated] Dispatched prompt to ${tool}: "${prompt.slice(0, 50)}"`,
    };
  }

  public async controlAction(params: ControlParams): Promise<ControlResult> {
    if (params.appName) {
      this.simulatedState.activeApp = params.appName;
      if (!this.simulatedState.runningApps.includes(params.appName)) {
        this.simulatedState.runningApps.push(params.appName);
      }
    }
    if (params.action === 'set_volume' && params.volumeLevel !== undefined) {
      this.simulatedState.volume = params.volumeLevel;
    } else if (params.action === 'toggle_mute') {
      this.simulatedState.isMuted = !this.simulatedState.isMuted;
    } else if (params.action === 'key_type' && params.text) {
      this.simulatedState.activeWindow = params.text;
    }
    return {
      success: true,
      action: params.action,
      target: params.appName,
      output: `[Simulated] ${params.action} executed on ${params.appName || 'system'}.`,
    };
  }

  public async getComputerState(): Promise<ComputerStateInfo> {
    return { ...this.simulatedState };
  }

  public async getUiTree(targetApp?: string): Promise<UiTreeResult> {
    const app = targetApp || 'Safari';
    return {
      appName: app,
      windowTitle: `${app} Window`,
      elements: [
        {
          id: 'el_button_0',
          role: 'BUTTON',
          title: 'Send',
          description: 'Send button',
          x: 400,
          y: 300,
          width: 80,
          height: 32,
          enabled: true,
          focused: false,
        },
        {
          id: 'el_button_1',
          role: 'BUTTON',
          title: 'Search',
          description: 'Search button',
          x: 500,
          y: 300,
          width: 80,
          height: 32,
          enabled: true,
          focused: false,
        },
        {
          id: 'el_textfield_0',
          role: 'TEXTFIELD',
          title: 'Search query or URL',
          description: 'Address and search bar',
          value: '',
          x: 200,
          y: 100,
          width: 600,
          height: 28,
          enabled: true,
          focused: true,
        },
      ],
      totalCount: 3,
    };
  }

  public async checkPermissions(): Promise<PermissionStatus> {
    return {
      accessibilityGranted: true,
      screenRecordingGranted: true,
      automationGranted: true,
      microphoneGranted: true,
      message: 'All core macOS permissions are granted in mock driver.',
    };
  }

  public async getFileMetadata(path: string): Promise<FileMetadataResult> {
    const isProtected = path.toLowerCase().includes('/system') || path.toLowerCase().includes('/etc') || path.includes('.env');
    return {
      path,
      name: path.split('/').pop() || 'file',
      is_dir: false,
      size_bytes: 1024,
      extension: path.split('.').pop() || '',
      is_protected: isProtected,
    };
  }

  public async readFile(path: string, _maxBytes?: number): Promise<string> {
    if (path.toLowerCase().includes('/system') || path.includes('.env')) {
      throw new Error(`Access to path "${path}" is forbidden by safety policy.`);
    }
    return `[Mock Content of ${path}]`;
  }

  public async createFile(path: string, _content: string, _overwrite?: boolean): Promise<boolean> {
    if (path.toLowerCase().includes('/system') || path.includes('.env')) {
      throw new Error(`Cannot create file in protected location "${path}"`);
    }
    return true;
  }

  public async moveToTrash(path: string): Promise<boolean> {
    if (path.toLowerCase().includes('/system') || path.includes('.env')) {
      throw new Error(`Cannot trash protected path "${path}"`);
    }
    return true;
  }
}

export class NativeBridge {
  private customDriver: Partial<INativeBridgeDriver> | null = null;
  private defaultMockDriver: INativeBridgeDriver = new MockNativeDriver();

  public setDriver(driver: Partial<INativeBridgeDriver> | null) {
    this.customDriver = driver;
  }

  public resetDriver() {
    this.customDriver = null;
    this.defaultMockDriver = new MockNativeDriver();
  }

  public isNative(): boolean {
    return isTauri() || (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }

  private isTestEnv(): boolean {
    return (
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
      (typeof process !== 'undefined' && Boolean(process.env?.VITEST)) ||
      (typeof process !== 'undefined' && Boolean(process.env?.JANKI_TEST_RUNNER)) ||
      (typeof window === 'undefined' && !this.isNative())
    );
  }

  private isBrowserDev(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.location !== 'undefined' &&
      Boolean(window.location.origin) &&
      window.location.protocol.startsWith('http') &&
      !this.isNative()
    );
  }

  private getDevUrl(path: string): string {
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://127.0.0.1:5173';
    return `${origin}${path}`;
  }

  public async openApp(appName: string, path?: string): Promise<OpenAppResult> {
    if (this.customDriver && this.customDriver.openApp) {
      return await this.customDriver.openApp(appName, path);
    }
    if (this.isTestEnv()) {
      return await this.defaultMockDriver.openApp(appName, path);
    }
    if (this.isNative()) {
      return await invoke<OpenAppResult>('cmd_open_app', { appName, path });
    }
    if (this.isBrowserDev()) {
      const res = await fetch(this.getDevUrl('/api/macos/open-app'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName, path }),
      });
      return await res.json();
    }
    throw new Error('Native bridge unavailable: not running in Tauri desktop, browser dev, or test environment.');
  }

  public async openUrl(url: string, browser?: string): Promise<OpenUrlResult> {
    if (this.customDriver && this.customDriver.openUrl) {
      return await this.customDriver.openUrl(url, browser);
    }
    if (this.isTestEnv()) {
      return await this.defaultMockDriver.openUrl(url, browser);
    }
    if (this.isNative()) {
      return await invoke<OpenUrlResult>('cmd_open_url', { url, browser });
    }
    if (this.isBrowserDev()) {
      const res = await fetch(this.getDevUrl('/api/macos/open-url'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, browser }),
      });
      return await res.json();
    }
    throw new Error('Native bridge unavailable: not running in Tauri desktop, browser dev, or test environment.');
  }

  public async checkApp(appName: string): Promise<CheckAppResult> {
    if (this.customDriver?.checkApp) {
      return await this.customDriver.checkApp(appName);
    }
    if (this.isTestEnv()) {
      return await this.defaultMockDriver.checkApp(appName);
    }
    if (this.isNative()) {
      const data = await invoke<any>('cmd_check_app', { appName });
      return {
        appName: data.app_name || data.appName,
        available: data.available,
        isRunning: data.is_running ?? data.isRunning ?? false,
        appPath: data.app_path || data.appPath,
        fastestMode: data.fastest_mode || data.fastestMode || 'browser_web',
        message: data.message,
      };
    }
    if (this.isBrowserDev()) {
      const res = await fetch(this.getDevUrl('/api/macos/check-app'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName }),
      });
      return await res.json();
    }
    throw new Error('Native bridge unavailable: not running in Tauri desktop, browser dev, or test environment.');
  }

  public async execCommand(command: string, cwd?: string): Promise<ExecCommandResult> {
    if (this.customDriver?.execCommand) {
      return await this.customDriver.execCommand(command, cwd);
    }
    if (this.isTestEnv()) {
      return await this.defaultMockDriver.execCommand(command, cwd);
    }
    if (this.isNative()) {
      const data = await invoke<any>('cmd_exec_command', { command, cwd });
      return {
        success: data.success,
        command: data.command,
        stdout: data.stdout,
        stderr: data.stderr,
        exitCode: data.exit_code ?? data.exitCode ?? 0,
        error: data.error,
      };
    }
    if (this.isBrowserDev()) {
      const res = await fetch(this.getDevUrl('/api/macos/exec-command'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, cwd }),
      });
      return await res.json();
    }
    throw new Error('Native bridge unavailable: not running in Tauri desktop, browser dev, or test environment.');
  }

  public async guiAction(params: {
    action: string;
    appName?: string;
    target?: string;
    text?: string;
    key?: string;
    shortcut?: string;
    x?: number;
    y?: number;
  }): Promise<GuiActionResult> {
    if (this.customDriver?.guiAction) {
      return await this.customDriver.guiAction(params);
    }
    if (this.isTestEnv()) {
      return await this.defaultMockDriver.guiAction(params);
    }
    if (this.isNative()) {
      const data = await invoke<any>('cmd_gui_action', {
        action: params.action,
        appName: params.appName,
        target: params.target,
        text: params.text,
        key: params.key,
        shortcut: params.shortcut,
        x: params.x,
        y: params.y,
      });
      return {
        success: data.success,
        action: data.action,
        appName: data.app_name || data.appName,
        stdout: data.stdout,
        error: data.error,
      };
    }
    if (this.isBrowserDev()) {
      const res = await fetch(this.getDevUrl('/api/macos/gui-action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return await res.json();
    }
    throw new Error('Native bridge unavailable: not running in Tauri desktop, browser dev, or test environment.');
  }

  public async youtubeSkipAd(): Promise<SkipAdResult> {
    if (this.customDriver?.youtubeSkipAd) {
      return await this.customDriver.youtubeSkipAd();
    }
    if (this.isTestEnv()) {
      return await this.defaultMockDriver.youtubeSkipAd();
    }
    if (this.isNative()) {
      return await invoke<SkipAdResult>('cmd_youtube_skip_ad');
    }
    if (this.isBrowserDev()) {
      const res = await fetch(this.getDevUrl('/api/macos/youtube-skip-ad'), { method: 'POST' });
      return await res.json();
    }
    throw new Error('Native bridge unavailable: not running in Tauri desktop, browser dev, or test environment.');
  }

  public async resolveYouTube(query: string): Promise<ResolveYouTubeResult> {
    if (this.customDriver?.resolveYouTube) {
      return await this.customDriver.resolveYouTube(query);
    }
    if (this.isTestEnv()) {
      return await this.defaultMockDriver.resolveYouTube(query);
    }
    if (this.isNative()) {
      const data = await invoke<any>('cmd_resolve_youtube', { query });
      return {
        success: data.success,
        videoId: data.video_id || data.videoId,
        targetUrl: data.target_url || data.targetUrl,
        isDirectVideo: data.is_direct_video ?? data.isDirectVideo ?? true,
      };
    }
    if (this.isBrowserDev()) {
      const res = await fetch(this.getDevUrl('/api/macos/resolve-youtube'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      return await res.json();
    }
    throw new Error('Native bridge unavailable: not running in Tauri desktop, browser dev, or test environment.');
  }

  public async promptAi(tool: string, prompt: string, useClipboard = true): Promise<PromptAiResult> {
    if (this.customDriver?.promptAi) {
      return await this.customDriver.promptAi(tool, prompt, useClipboard);
    }
    if (this.isTestEnv()) {
      return await this.defaultMockDriver.promptAi(tool, prompt, useClipboard);
    }
    if (this.isNative()) {
      return await invoke<PromptAiResult>('cmd_prompt_ai', { tool, prompt, useClipboard });
    }
    if (this.isBrowserDev()) {
      const res = await fetch(this.getDevUrl('/api/macos/prompt-ai'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, prompt, useClipboardAcceleration: useClipboard }),
      });
      return await res.json();
    }
    throw new Error('Native bridge unavailable: not running in Tauri desktop, browser dev, or test environment.');
  }

  public async controlAction(params: ControlParams): Promise<ControlResult> {
    if (this.customDriver?.controlAction) return await this.customDriver.controlAction(params);
    if (this.isTestEnv()) return await this.defaultMockDriver.controlAction(params);
    if (this.isNative()) {
      const res = await invoke<any>('cmd_control_action', {
        action: params.action,
        appName: params.appName,
        windowTitle: params.windowTitle,
        text: params.text,
        key: params.key,
        modifiers: params.modifiers,
        x: params.x,
        y: params.y,
        width: params.width,
        height: params.height,
        deltaY: params.deltaY,
        volumeLevel: params.volumeLevel,
        force: params.force,
      });
      return {
        success: res.success,
        action: res.action,
        target: res.target,
        output: res.output,
        error: res.error,
      };
    }
    if (this.isBrowserDev()) {
      const res = await fetch(this.getDevUrl('/api/macos/control'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return await res.json();
    }
    throw new Error('Native bridge unavailable: not running in Tauri desktop, browser dev, or test environment.');
  }

  public async getComputerState(): Promise<ComputerStateInfo> {
    if (this.customDriver?.getComputerState) return await this.customDriver.getComputerState();
    if (this.isTestEnv()) return await this.defaultMockDriver.getComputerState();
    if (this.isNative()) {
      const res = await invoke<any>('cmd_get_computer_state');
      return {
        activeApp: res.active_app || res.activeApp || 'Unknown',
        activeWindow: res.active_window || res.activeWindow || '',
        runningApps: res.running_apps || res.runningApps || [],
        volume: res.volume ?? 50,
        isMuted: res.is_muted ?? res.isMuted ?? false,
      };
    }
    if (this.isBrowserDev()) {
      const res = await fetch(this.getDevUrl('/api/macos/computer-state'));
      return await res.json();
    }
    throw new Error('Native bridge unavailable: not running in Tauri desktop, browser dev, or test environment.');
  }

  public async getUiTree(targetApp?: string): Promise<UiTreeResult> {
    if (this.customDriver?.getUiTree) return await this.customDriver.getUiTree(targetApp);
    if (this.isTestEnv()) return await this.defaultMockDriver.getUiTree(targetApp);
    if (this.isNative()) {
      const res = await invoke<any>('cmd_get_ui_tree', { targetApp });
      return {
        appName: res.app_name || res.appName || targetApp || 'Unknown',
        windowTitle: res.window_title || res.windowTitle || '',
        elements: (res.elements || []).map((el: any) => ({
          id: el.id,
          role: el.role,
          title: el.title,
          description: el.description,
          value: el.value,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          enabled: el.enabled,
          focused: el.focused,
        })),
        totalCount: res.total_count ?? res.totalCount ?? 0,
        error: res.error,
      };
    }
    if (this.isBrowserDev()) {
      const res = await fetch(this.getDevUrl('/api/macos/ui-tree'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetApp }),
      });
      return await res.json();
    }
    throw new Error('Native bridge unavailable: not running in Tauri desktop, browser dev, or test environment.');
  }

  public async checkPermissions(): Promise<PermissionStatus> {
    if (this.customDriver?.checkPermissions) return await this.customDriver.checkPermissions();
    if (this.isTestEnv()) return await this.defaultMockDriver.checkPermissions();
    if (this.isNative()) {
      const res = await invoke<any>('cmd_check_permissions');
      return {
        accessibilityGranted: res.accessibility_granted ?? res.accessibilityGranted ?? false,
        screenRecordingGranted: res.screen_recording_granted ?? res.screenRecordingGranted ?? false,
        automationGranted: res.automation_granted ?? res.automationGranted ?? false,
        microphoneGranted: res.microphone_granted ?? res.microphoneGranted ?? false,
        message: res.message || '',
        actionRequired: res.action_required || res.actionRequired,
      };
    }
    if (this.isBrowserDev()) {
      const res = await fetch(this.getDevUrl('/api/macos/permissions'));
      return await res.json();
    }
    return await this.defaultMockDriver.checkPermissions();
  }

  public async getFileMetadata(path: string): Promise<FileMetadataResult> {
    if (this.customDriver && this.customDriver.getFileMetadata) return await this.customDriver.getFileMetadata(path);
    if (this.isTestEnv()) return await this.defaultMockDriver.getFileMetadata!(path);
    if (this.isNative()) return await invoke<FileMetadataResult>('cmd_get_file_metadata', { path });
    return await this.defaultMockDriver.getFileMetadata!(path);
  }

  public async readFile(path: string, maxBytes?: number): Promise<string> {
    if (this.customDriver && this.customDriver.readFile) return await this.customDriver.readFile(path, maxBytes);
    if (this.isTestEnv()) return await this.defaultMockDriver.readFile!(path, maxBytes);
    if (this.isNative()) return await invoke<string>('cmd_read_file', { path, maxBytes });
    return await this.defaultMockDriver.readFile!(path, maxBytes);
  }

  public async createFile(path: string, content: string, overwrite?: boolean): Promise<boolean> {
    if (this.customDriver && this.customDriver.createFile) return await this.customDriver.createFile(path, content, overwrite);
    if (this.isTestEnv()) return await this.defaultMockDriver.createFile!(path, content, overwrite);
    if (this.isNative()) return await invoke<boolean>('cmd_create_file', { path, content, overwrite });
    return await this.defaultMockDriver.createFile!(path, content, overwrite);
  }

  public async moveToTrash(path: string): Promise<boolean> {
    if (this.customDriver && this.customDriver.moveToTrash) return await this.customDriver.moveToTrash(path);
    if (this.isTestEnv()) return await this.defaultMockDriver.moveToTrash!(path);
    if (this.isNative()) return await invoke<boolean>('cmd_move_to_trash', { path });
    return await this.defaultMockDriver.moveToTrash!(path);
  }

  public async executeAppleScript(script: string): Promise<string> {
    if (this.customDriver && this.customDriver.executeAppleScript) {
      return await this.customDriver.executeAppleScript(script);
    }
    if (this.isTestEnv()) {
      return await this.defaultMockDriver.executeAppleScript!(script);
    }
    const res = await this.execCommand(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
    return res.stdout;
  }
}

export const nativeBridge = new NativeBridge();
