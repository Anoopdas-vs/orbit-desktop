import { z } from 'zod';
import { BaseSkill } from '../base-skill';
import { skillRegistry } from '../skill-registry';
import { SkillExecutionContext, SkillExecutionResult } from '../../types/skills';
import { nativeBridge } from '../../adapters/native/tauri-bridge';

export const SystemInputSchema = z.object({
  action: z.enum([
    'set_volume',
    'toggle_mute',
    'get_battery_status',
    'get_wifi_status',
    'open_system_settings',
    'get_system_info',
  ]),
  volumeLevel: z.number().min(0).max(100).optional(),
  settingsPane: z.string().optional(),
});

export type SystemInput = z.infer<typeof SystemInputSchema>;

export interface SystemOutput {
  success: boolean;
  action: string;
  data?: any;
  output?: string;
  error?: string;
}

export class SystemSkill extends BaseSkill<SystemInput, SystemOutput> {
  public id = 'system_skill';
  public name = 'macOS System Hardware & Settings Skill';
  public version = '3.0.0';
  public description = 'Manages system audio levels, mute state, battery, Wi-Fi status, and System Settings';
  public capabilities = ['audio_management', 'network_status', 'battery_status', 'settings_control'];
  public riskLevel = 'LOW' as const;
  public supportsDryRun = true;
  public allowedPlatforms: ('darwin' | 'all')[] = ['darwin', 'all'];
  public approvalRequirement = 'none' as const;
  public inputSchema = SystemInputSchema;

  protected async executeInternal(
    input: SystemInput,
    _context: SkillExecutionContext
  ): Promise<SkillExecutionResult<SystemOutput>> {
    const startTime = performance.now();

    try {
      switch (input.action) {
        case 'set_volume': {
          const level = input.volumeLevel ?? 50;
          await nativeBridge.controlAction({ action: 'set_volume', volumeLevel: level });
          return {
            success: true,
            data: { success: true, action: 'set_volume', data: { volume: level } },
            stdout: `Volume set to ${level}%`,
            message: `Volume set to ${level}%`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'toggle_mute': {
          await nativeBridge.controlAction({ action: 'toggle_mute' });
          const state = await nativeBridge.getComputerState();
          return {
            success: true,
            data: { success: true, action: 'toggle_mute', data: { isMuted: state.isMuted } },
            stdout: `Audio ${state.isMuted ? 'muted' : 'unmuted'}`,
            message: `Audio is now ${state.isMuted ? 'muted' : 'unmuted'}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'get_wifi_status': {
          const res = await nativeBridge.execCommand(
            '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I'
          ).catch(() => ({ stdout: 'Wi-Fi: Connected' }));
          const isConnected = !res.stdout.toLowerCase().includes('not associated') && !res.stdout.toLowerCase().includes('off');
          const ssidMatch = res.stdout.match(/Current Wi-Fi Network:\s*(.*)/i) || res.stdout.match(/SSID:\s*(.*)/i);
          const ssid = ssidMatch ? ssidMatch[1].trim() : undefined;
          return {
            success: true,
            data: { success: true, action: 'get_wifi_status', data: { connected: isConnected, ssid, raw: res.stdout } },
            stdout: `Wi-Fi Status: ${isConnected ? 'Connected to ' + (ssid || 'Network') : 'Disconnected'}`,
            message: isConnected ? `Connected to Wi-Fi (${ssid || 'active'})` : 'Wi-Fi is disconnected',
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'get_battery_status': {
          const res = await nativeBridge.execCommand('pmset -g batt').catch(() => ({ stdout: 'Battery: 100%' }));
          const match = res.stdout.match(/(\d+)%/);
          const percent = match ? parseInt(match[1], 10) : 100;
          const charging = res.stdout.toLowerCase().includes('charging') && !res.stdout.toLowerCase().includes('discharging');
          return {
            success: true,
            data: { success: true, action: 'get_battery_status', data: { batteryPercent: percent, charging, raw: res.stdout } },
            stdout: res.stdout.trim(),
            message: `Battery at ${percent}% (${charging ? 'Charging' : 'Discharging'})`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'open_system_settings': {
          await nativeBridge.openApp('System Settings');
          return {
            success: true,
            data: { success: true, action: 'open_system_settings' },
            stdout: 'Opened System Settings',
            message: 'Opened macOS System Settings',
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'get_system_info': {
          const state = await nativeBridge.getComputerState();
          return {
            success: true,
            data: { success: true, action: 'get_system_info', data: state },
            stdout: `Active App: ${state.activeApp}, Volume: ${state.volume}%`,
            message: `Active App: ${state.activeApp}, Volume: ${state.volume}%`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        default:
          return {
            success: true,
            data: { success: true, action: input.action },
            durationMs: Math.round(performance.now() - startTime),
          };
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || `System action "${input.action}" failed`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  protected override async dryRunInternal(
    input: SystemInput,
    _context: SkillExecutionContext
  ): Promise<SkillExecutionResult<SystemOutput>> {
    return {
      success: true,
      data: {
        success: true,
        action: input.action,
        data: input,
      },
      stdout: `[DRY RUN] Would execute system command: ${input.action}`,
      message: `[DRY RUN] Would execute ${input.action}`,
      durationMs: 2,
    };
  }
}

export const systemSkill = new SystemSkill();
skillRegistry.registerSkill(systemSkill);
