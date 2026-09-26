/**
 * Phonetic Preprocessor for Janki Multilingual TTS
 * Normalizes English, Malayalam script, and Manglish into smooth spoken text.
 * Strips URLs, GUIDs, and file paths to avoid unnatural robotic readout.
 */

export interface PhoneticCleanOptions {
  stripUrls?: boolean;
  stripFilePaths?: boolean;
  stripGuids?: boolean;
  normalizeManglishColloquial?: boolean;
  languageHint?: 'en' | 'ml' | 'mixed';
}

const MANGLISH_PHONETIC_REPLACEMENTS: Record<string, string> = {
  'pattu vekkoo': 'paattu vekkunnu',
  'paatu vekk': 'paattu play cheyyunnu',
  'ganam kelkkanam': 'paattu play cheyyunnu',
  'close aakku': 'adakkunnu',
  'open aakku': 'thurakkunnu',
  'parayu': 'parayoo',
  'enthanu': 'enthaanu',
  'nanni': 'nandhi',
  'sheriyanu': 'sheriyaanu',
};

const NUMBER_MAP: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
  '10': 'ten',
};

export class PhoneticPreprocessor {
  /**
   * Preprocesses text into clean, phonetically natural TTS tokens.
   */
  public cleanForSpeech(text: string, options: PhoneticCleanOptions = {}): string {
    if (!text || typeof text !== 'string') return '';

    const {
      stripUrls = true,
      stripFilePaths = true,
      stripGuids = true,
      normalizeManglishColloquial = true,
    } = options;

    let result = text;

    // 1. Remove markdown formatting (*, `, ~, #, >) but preserve underscores in filenames
    result = result.replace(/[`~#>]/g, '');
    result = result.replace(/\*+/g, '');
    result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Keep link text, strip markdown URL

    // 2. Strip raw URLs into conversational phrases
    if (stripUrls) {
      result = result.replace(/https?:\/\/(www\.)?([^\s/]+)[^\s]*/gi, (_match, _www, domain) => {
        return `the ${domain} webpage`;
      });
    }

    // 3. Strip long UUIDs / GUIDs (e.g. 8d6c8271-b6b3-4290-94aa-85d65d26ae9b)
    if (stripGuids) {
      result = result.replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        'item'
      );
    }

    // 4. Strip deep UNIX / macOS file paths (e.g. /Users/anoop/Documents/foo.txt -> foo.txt)
    if (stripFilePaths) {
      result = result.replace(/(?:\/[\w.-]+)+\/([\w.-]+)/g, '$1');
    }

    // 5. Normalize Manglish colloquialisms
    if (normalizeManglishColloquial) {
      const lower = result.toLowerCase();
      for (const [key, replacement] of Object.entries(MANGLISH_PHONETIC_REPLACEMENTS)) {
        if (lower.includes(key)) {
          const regex = new RegExp(`\\b${key}\\b`, 'gi');
          result = result.replace(regex, replacement);
        }
      }
    }

    // 6. Clean up bracketed technical codes or logs
    result = result.replace(/\([A-Z0-9_-]{6,}\)/g, '');

    // 7. Collapse multiple whitespaces and trim
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  /**
   * Identifies whether the given text is English, Malayalam, or Mixed.
   */
  public detectScript(text: string): 'ml' | 'en' | 'mixed' {
    const hasMalayalam = /[\u0D00-\u0D7F]/.test(text);
    const hasLatin = /[a-zA-Z]/.test(text);

    if (hasMalayalam && hasLatin) return 'mixed';
    if (hasMalayalam) return 'ml';
    return 'en';
  }
}

export const phoneticPreprocessor = new PhoneticPreprocessor();
