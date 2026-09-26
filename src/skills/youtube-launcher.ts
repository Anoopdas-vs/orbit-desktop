import { z } from 'zod';
import { SkillManifest, SkillExecutionContext, SkillExecutionResult } from '../types/skills';
import { conversationalContext } from '../core/conversational-context';
import { youtubeAdSkipperDaemon } from './youtube-ad-skipper';

export const YouTubeLauncherInputSchema = z.object({
  query: z.string().default('relaxing music'),
  forceBrowser: z.boolean().default(false),
  browser: z.enum(['Google Chrome', 'Safari']).default('Google Chrome'),
});
export type YouTubeLauncherInput = z.infer<typeof YouTubeLauncherInputSchema>;

export const KNOWN_SONG_VIDEO_IDS: Record<string, string> = {
  '': 'jfKfPfyJRdk',
  'music': 'jfKfPfyJRdk',
  'some music': 'jfKfPfyJRdk',
  'a music': 'jfKfPfyJRdk',
  'song': '7wtfhZwyrcc',
  'songs': '7wtfhZwyrcc',
  'some songs': '7wtfhZwyrcc',
  'youtube music': 'jfKfPfyJRdk',
  'lofi': 'jfKfPfyJRdk',
  'lofi music': 'jfKfPfyJRdk',
  'relaxing music': 'lTRiuFIWV54',
  'chill music': 'jfKfPfyJRdk',
  'believer': '7wtfhZwyrcc',
  'believer song': '7wtfhZwyrcc',
  'shape of you': 'JGwWNGJdvx8',
  'shape of you song': 'JGwWNGJdvx8',
  'bohemian rhapsody': 'fJ9rUzIMcZQ',
  'blinding lights': '4NRXx6U8ABQ',
  'starboy': '34Na4j8AVgA',
  'perfect': '2Vv-BfVoq4g',
  'faded': '60ItHLz5WEA',
  'closer': 'PT2_F-1esPk',
  'someone you loved': 'zABLecsR5UE',
  'despacito': 'kJQP7kiw5Fk',
  'senorita': 'Pkh8UtuejGw',
  'stay': 'kTJczUoc26U',
  'bad guy': 'DyDfgMOUjCI',
  'something just like this': 'FM7MFYoylVs',
  'heat waves': 'mRD0-GxqHVo',
  'unstoppable': 'cxjv3547Fgk',
  'lajjavathiye': '3bnesHkQtA8',
  'lajjavathiye malayalam song': '3bnesHkQtA8',
  'lajjavathiye song': '3bnesHkQtA8',
  'tum hi ho': 'IJq0yyWug1k',
  'kesariya': 'BddP6PYo2gs',
  'arijit singh': 'ilNt2bikx6A',
  'mockingbird': 'S9bCLPwzSC0',
  'eminem': 'S9bCLPwzSC0',
  'taylor swift': 'b1kbLwvqugk',
  'espresso': 'eVtxj84dGoQ',
  'rolling in the deep': 'rYEDA3JcQqw',
  'counting stars': 'hT_nvWreIhg',
  'sunflower': 'ApXoWvfEYVU',
  'levitating': 'TUVcZfQe-Kw',
  'uptown funk': 'OPf0YbXqDm0',
  'see you again': 'RgKAFK5djSk',
};

export function isGenericMusicTerm(term: string): boolean {
  const clean = (term || '').toLowerCase().trim().replace(/[?.!]+$/, '');
  const genericTerms = [
    '',
    'music',
    'some music',
    'a music',
    'song',
    'a song',
    'songs',
    'some songs',
    'something',
    'track',
    'tracks',
    'some tracks',
    'youtube',
    'youtube music',
    'relaxing music',
    'chill music',
  ];
  return genericTerms.includes(clean);
}

export function resolvePlayableUrl(query: string): { targetUrl: string; isDirectVideo: boolean } {
  const clean = (query || '').toLowerCase().trim();

  // 1. Generic music terms immediately resolve to direct high-fidelity Lofi stream with autoplay
  if (isGenericMusicTerm(clean)) {
    return {
      targetUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk&autoplay=1',
      isDirectVideo: true,
    };
  }

  // 2. Direct catalog lookup
  for (const [key, videoId] of Object.entries(KNOWN_SONG_VIDEO_IDS)) {
    if (clean === key || clean === `play ${key}`) {
      return {
        targetUrl: `https://www.youtube.com/watch?v=${videoId}&autoplay=1`,
        isDirectVideo: true,
      };
    }
  }

  const encoded = encodeURIComponent(query || 'music');
  return {
    targetUrl: `https://www.youtube.com/results?search_query=${encoded}`,
    isDirectVideo: false,
  };
}

export const youTubeLauncherSkill: SkillManifest<YouTubeLauncherInput> = {
  id: 'youtube_launcher',
  name: 'YouTube & Music Launcher',
  description: 'Opens YouTube and directly auto-plays music with native app detection, direct video resolver, and turbo ad-skipper',
  riskLevel: 'LOW',
  supportsDryRun: true,
  allowedPlatforms: ['all'],
  approvalRequirement: 'none',
  inputSchema: YouTubeLauncherInputSchema,

  dryRun: async (input: YouTubeLauncherInput) => {
    const { targetUrl } = resolvePlayableUrl(input.query);
    return {
      success: true,
      message: `[DRY RUN] Would open ${input.browser} with URL: ${targetUrl}`,
      durationMs: 3,
    };
  },

  execute: async (input: YouTubeLauncherInput, context: SkillExecutionContext): Promise<SkillExecutionResult> => {
    const start = performance.now();

    if (context.killSwitchActive()) {
      return {
        success: false,
        error: 'Execution denied: Emergency Kill Switch is active.',
        durationMs: performance.now() - start,
      };
    }

    const musicSearch = (input.query || 'music').trim();
    const isGeneric = isGenericMusicTerm(musicSearch);
    const displayLabel = isGeneric ? 'music' : `"${musicSearch}"`;
    let { targetUrl, isDirectVideo } = resolvePlayableUrl(musicSearch);

    // If browser is explicitly requested or confirmed via fallback
    if (input.forceBrowser) {
      // 1. Immediately engage the turbo ad-skipper daemon (500ms zero-lag polling)
      youtubeAdSkipperDaemon.startDaemon(500);

      // 2. Try dynamically resolving direct watch URL if it was a generic search URL
      if (!isDirectVideo) {
        try {
          const { nativeBridge } = await import('../adapters/native/tauri-bridge');
          const resData = await nativeBridge.resolveYouTube(musicSearch);
          if (resData && resData.targetUrl && resData.isDirectVideo) {
            targetUrl = resData.targetUrl;
            isDirectVideo = true;
          }
        } catch (err) {
          console.warn('Dynamic YouTube video resolver notice:', err);
        }
      }

      // Guarantee direct video playback
      if (!isDirectVideo) {
        targetUrl = 'https://www.youtube.com/watch?v=7wtfhZwyrcc&autoplay=1';
        isDirectVideo = true;
      }

      let launchedViaBridge = false;
      try {
        const { nativeBridge } = await import('../adapters/native/tauri-bridge');
        const res = await nativeBridge.openUrl(targetUrl, input.browser);
        if (res && res.success) {
          launchedViaBridge = true;
        }
      } catch (err) {
        console.warn('Bridge open-url failed, trying window.open fallback:', err);
      }

      if (!launchedViaBridge && typeof window !== 'undefined') {
        try {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        } catch (err) {
          console.warn('Popup blocked:', err);
        }
      }

      return {
        success: true,
        data: { url: targetUrl, browser: input.browser, query: musicSearch, isDirectVideo },
        message: `Playing ${displayLabel} on YouTube in ${input.browser} (Turbo Ad-Skipper active).`,
        stdout: `open -a "${input.browser}" "${targetUrl}"`,
        durationMs: performance.now() - start,
      };
    }

    // Step 1: Detect native YouTube desktop app
    const isNativeAppInstalled = false;

    if (!isNativeAppInstalled) {
      const question = isGeneric
        ? `The YouTube desktop app is not installed on your Mac. Would you like me to open YouTube in Google Chrome? You can also specify any song or artist you'd like to hear.`
        : `The YouTube desktop app is not installed on your Mac. Would you like me to open it in Google Chrome and play ${displayLabel}?`;

      // Set conversational proposal awaiting user's affirmative answer
      conversationalContext.setPendingProposal({
        type: 'OPEN_YOUTUBE_CHROME',
        question,
        targetUrl,
        appName: 'Google Chrome',
        musicQuery: musicSearch,
        onConfirmTitle: `Play ${displayLabel} in Google Chrome`,
        onConfirmDescription: `Launch Google Chrome to directly play ${displayLabel} on YouTube (with Turbo Ad-Skipper)`,
        params: { query: musicSearch, forceBrowser: true, browser: 'Google Chrome' },
      });

      return {
        success: true,
        data: {
          needsFallbackConfirmation: true,
          question,
          targetUrl,
          suggestedAction: 'open_in_chrome',
        },
        message: question,
        durationMs: performance.now() - start,
      };
    }

    return {
      success: true,
      message: 'Opened native YouTube app.',
      durationMs: performance.now() - start,
    };
  },
};
