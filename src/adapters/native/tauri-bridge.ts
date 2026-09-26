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

export interface INativeBridgeDriver {
  openApp(appName: string, path?: string): Promise<OpenAppResult>;
  openUrl(url: string, browser?: string): Promise<OpenUrlResult>;
  checkApp(appName: string): Promise<CheckAppResult>;
  execCommand(command: string, cwd?: string): Promise<ExecCommandResult>;
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
}

export class MockNativeDriver implements INativeBridgeDriver {
  public async openApp(appName: string, path?: string): Promise<OpenAppResult> {
    return {
      success: true,
      app: appName,
      path,
      message: `[Simulated] Successfully launched application: "${appName}"`,
    };
  }

  public async openUrl(url: string, browser?: string): Promise<OpenUrlResult> {
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
}

export class NativeBridge {
  private customDriver: INativeBridgeDriver | null = null;
  private defaultMockDriver: INativeBridgeDriver = new MockNativeDriver();

  public setDriver(driver: INativeBridgeDriver | null) {
    this.customDriver = driver;
  }

  public resetDriver() {
    this.customDriver = null;
  }

  public isNative(): boolean {
    return isTauri() || (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
  }

  private isTestEnv(): boolean {
    return (
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
      (typeof process !== 'undefined' && Boolean(process.env?.VITEST))
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
    if (this.customDriver) {
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
    if (this.customDriver) {
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
    if (this.customDriver) {
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
    if (this.customDriver) {
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
    if (this.customDriver) {
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
    if (this.customDriver) {
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
    if (this.customDriver) {
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
    if (this.customDriver) {
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
}

export const nativeBridge = new NativeBridge();
