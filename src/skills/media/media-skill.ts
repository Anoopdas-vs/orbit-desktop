import { z } from 'zod';
import { BaseSkill } from '../base-skill';
import { skillRegistry } from '../skill-registry';
import { SkillExecutionContext, SkillExecutionResult } from '../../types/skills';
import { nativeBridge } from '../../adapters/native/tauri-bridge';

export const MediaInputSchema = z.object({
  action: z.enum([
    'play_pause',
    'next_track',
    'previous_track',
    'set_volume',
    'play_youtube',
    'open_media_app',
  ]),
  appName: z.enum(['Music', 'Spotify', 'QuickTime Player', 'Safari', 'Chrome']).optional(),
  volumeLevel: z.number().min(0).max(100).optional(),
  query: z.string().optional(),
});

export type MediaInput = z.infer<typeof MediaInputSchema>;

export interface MediaOutput {
  success: boolean;
  action: string;
  data?: any;
  message?: string;
  error?: string;
}

export class MediaSkill extends BaseSkill<MediaInput, MediaOutput> {
  public id = 'media_skill';
  public name = 'macOS Media Control & YouTube Skill';
  public version = '3.0.0';
  public description = 'Controls media playback, volume, music applications, and YouTube video/music streaming';
  public capabilities = ['playback_control', 'youtube_streaming', 'music_app_control'];
  public riskLevel = 'LOW' as const;
  public supportsDryRun = true;
  public allowedPlatforms: ('darwin' | 'all')[] = ['darwin', 'all'];
  public approvalRequirement = 'none' as const;
  public inputSchema = MediaInputSchema;

  protected async executeInternal(
    input: MediaInput,
    _context: SkillExecutionContext
  ): Promise<SkillExecutionResult<MediaOutput>> {
    const startTime = performance.now();

    try {
      switch (input.action) {
        case 'play_pause': {
          const app = input.appName || 'Music';
          const script = `
            try
              tell application "${app}" to playpause
            on error
              tell application "System Events" to key code 49
            end try
          `;
          await nativeBridge.executeAppleScript(script);
          return {
            success: true,
            data: { success: true, action: 'play_pause', message: `Toggled playback for ${app}` },
            stdout: `Toggled playback for ${app}`,
            message: `Toggled playback for ${app}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'next_track': {
          const app = input.appName || 'Music';
          const script = `
            try
              tell application "${app}" to next track
            on error
              -- fallback
            end try
          `;
          await nativeBridge.executeAppleScript(script);
          return {
            success: true,
            data: { success: true, action: 'next_track', message: `Skipped to next track in ${app}` },
            stdout: `Skipped to next track in ${app}`,
            message: `Skipped to next track in ${app}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'previous_track': {
          const app = input.appName || 'Music';
          const script = `
            try
              tell application "${app}" to previous track
            on error
              -- fallback
            end try
          `;
          await nativeBridge.executeAppleScript(script);
          return {
            success: true,
            data: { success: true, action: 'previous_track', message: `Skipped to previous track in ${app}` },
            stdout: `Skipped to previous track in ${app}`,
            message: `Skipped to previous track in ${app}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'set_volume': {
          const level = input.volumeLevel ?? 50;
          await nativeBridge.controlAction({ action: 'set_volume', volumeLevel: level });
          return {
            success: true,
            data: { success: true, action: 'set_volume', data: { volume: level } },
            stdout: `Media volume set to ${level}%`,
            message: `Media volume set to ${level}%`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'play_youtube': {
          const query = input.query || 'lofi hip hop';
          const encoded = encodeURIComponent(query);
          const youtubeUrl = query.startsWith('http://') || query.startsWith('https://')
            ? query
            : `https://www.youtube.com/results?search_query=${encoded}`;

          await nativeBridge.openUrl(youtubeUrl);
          return {
            success: true,
            data: { success: true, action: 'play_youtube', data: { query, url: youtubeUrl } },
            stdout: `Opened YouTube for query: "${query}"`,
            message: `Playing "${query}" on YouTube`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'open_media_app': {
          const app = input.appName || 'Music';
          await nativeBridge.openApp(app);
          return {
            success: true,
            data: { success: true, action: 'open_media_app', data: { app } },
            stdout: `Opened ${app}`,
            message: `Opened media application ${app}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        default:
          return {
            success: false,
            error: `Unsupported media action: ${(input as any).action}`,
            durationMs: Math.round(performance.now() - startTime),
          };
      }
    } catch (err: any) {
      return {
        success: false,
        error: `Media execution failed: ${err.message}`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }
}

export const mediaSkill = new MediaSkill();
skillRegistry.registerSkill(mediaSkill);
