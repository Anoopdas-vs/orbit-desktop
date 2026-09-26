/**
 * Multilingual NLP Module for Janki AI
 * Supports English, Malayalam (U+0D00-U+0D7F), Manglish (Malayalam transliterated in Latin script),
 * and Mixed-language instructions with sub-millisecond deterministic tokenization.
 */

export interface ParsedTokens {
  language: 'en' | 'ml' | 'manglish' | 'mixed';
  actionVerb?: string;
  targetApp?: string;
  targetObject?: string;
  queryText?: string;
  isFollowUp: boolean;
  rawTokens: string[];
}

export class MultilingualNLP {
  // Malayalam script Unicode regex
  private readonly MALAYALAM_SCRIPT_REGEX = /[\u0D00-\u0D7F]/;

  // Common Manglish lexical markers
  private readonly MANGLISH_MARKERS = [
    'cheyyu',
    'cheytho',
    'cheyithu',
    'cheythitu',
    'thurannu',
    'thurakku',
    'nokku',
    'nokki',
    'aakku',
    'aakki',
    'aayi',
    'ezhuthu',
    'parayu',
    'thudangu',
    'ithu',
    'athil',
    'pinneyum',
    'aduthatheth',
    'aadyathe',
    'thirayoo',
    'mathi',
    'veendum',
  ];

  // Common Follow-up & Anaphora markers across languages
  private readonly FOLLOW_UP_MARKERS = [
    // English
    'now',
    'then',
    'next',
    'after that',
    'again',
    'do it again',
    'same thing',
    'first result',
    'second result',
    '1st result',
    '2nd result',
    'first link',
    'go back',
    'back',
    'it',
    'that',
    // Manglish
    'ini',
    'athil',
    'pinne',
    'aduthatheth',
    'aadyathe',
    'aadyatheth',
    'veendum',
    'ithu thanne',
    'thirike',
    'backil',
    // Malayalam
    'ഇനി',
    'അടുത്തത്',
    'ആദ്യത്തെ',
    'തിരികെ',
    'വീണ്ടും',
    'അതിൽ',
  ];

  /**
   * Detect the language category of the input prompt.
   */
  public detectLanguage(text: string): 'en' | 'ml' | 'manglish' | 'mixed' {
    if (!text || text.trim().length === 0) return 'en';

    const hasMalayalamScript = this.MALAYALAM_SCRIPT_REGEX.test(text);
    const lower = text.toLowerCase();
    const hasEnglishWords = /[a-zA-Z]{3,}/.test(text);

    const hasManglishWords = this.MANGLISH_MARKERS.some((marker) =>
      new RegExp(`\\b${marker}\\b`, 'i').test(lower)
    );

    if (hasMalayalamScript && hasEnglishWords) {
      return 'mixed';
    }

    if (hasMalayalamScript) {
      return 'ml';
    }

    if (hasManglishWords && hasEnglishWords) {
      // e.g. "Safari open cheythitu search cheyyu"
      return 'manglish';
    }

    if (hasManglishWords) {
      return 'manglish';
    }

    return 'en';
  }

  /**
   * Check if a prompt indicates a follow-up or contextual reference.
   */
  public isFollowUpCommand(text: string): boolean {
    const lower = text.toLowerCase().trim();
    return this.FOLLOW_UP_MARKERS.some((marker) => {
      if (marker.length <= 3) {
        return new RegExp(`^${marker}\\b|\\b${marker}$`, 'i').test(lower);
      }
      return lower.includes(marker);
    });
  }

  /**
   * Parse token slots (action verb, application target, object, query text)
   * while normalizing multilingual verbs.
   */
  public parseIntentTokens(rawPrompt: string): ParsedTokens {
    const language = this.detectLanguage(rawPrompt);
    const isFollowUp = this.isFollowUpCommand(rawPrompt);
    const clean = rawPrompt
      .replace(/^(?:hey|hei|hi|hello)?\s*janki[,:.\- ]*/i, '')
      .replace(/[\u0D00-\u0D7F]/g, (match) => match) // preserve Malayalam Unicode
      .trim();

    const tokens = clean.split(/\s+/).filter((t) => t.length > 0);
    const lower = clean.toLowerCase();

    // 1. Identify Target App
    let targetApp: string | undefined;
    const knownApps = [
      'Safari',
      'Google Chrome',
      'Chrome',
      'Calculator',
      'TextEdit',
      'Finder',
      'Terminal',
      'System Settings',
      'Notes',
      'Binance',
    ];

    for (const app of knownApps) {
      if (new RegExp(`\\b${app}\\b`, 'i').test(clean)) {
        targetApp = app.toLowerCase() === 'chrome' ? 'Google Chrome' : app;
        break;
      }
    }

    // 2. Identify Action Verb (normalized to canonical English verbs: open, search, click, type, calculate, back, again)
    let actionVerb: string | undefined;
    if (
      lower.includes('open') ||
      lower.includes('launch') ||
      lower.includes('thurannu') ||
      lower.includes('thurakku') ||
      clean.includes('തുറക്കൂ') ||
      clean.includes('തുറന്ന്')
    ) {
      actionVerb = 'open';
    } else if (
      lower.includes('search') ||
      lower.includes('find') ||
      lower.includes('nokku') ||
      lower.includes('thirayoo') ||
      clean.includes('തിരയൂ') ||
      lower.includes('google ൽ')
    ) {
      actionVerb = 'search';
    } else if (
      lower.includes('click') ||
      lower.includes('press') ||
      lower.includes('select') ||
      lower.includes('amarthu') ||
      clean.includes('അമർത്തൂ')
    ) {
      actionVerb = 'click';
    } else if (
      lower.includes('type') ||
      lower.includes('write') ||
      lower.includes('ezhuthu') ||
      clean.includes('എഴുതൂ')
    ) {
      actionVerb = 'type';
    } else if (
      lower.includes('calculate') ||
      lower.includes('compute') ||
      lower.includes('kanakkaakku') ||
      clean.includes('കണക്കുകൂട്ടൂ')
    ) {
      actionVerb = 'calculate';
    } else if (
      lower.includes('go back') ||
      lower === 'back' ||
      lower.includes('thirike') ||
      clean.includes('തിരികെ')
    ) {
      actionVerb = 'back';
    } else if (
      lower.includes('again') ||
      lower.includes('do it again') ||
      lower.includes('veendum') ||
      clean.includes('വീണ്ടും')
    ) {
      actionVerb = 'again';
    }

    // 3. Extract query/object
    let queryText: string | undefined;
    let targetObject: string | undefined;

    if (actionVerb === 'search') {
      const searchMatch = clean.match(/(?:search\s+for|search|തിരയൂ|Google\s*ൽ)\s+(.+)$/i);
      if (searchMatch && searchMatch[1]) {
        queryText = searchMatch[1]
          .replace(/\b(?:in\s+safari|in\s+chrome|on\s+safari|on\s+chrome|please|search\s*cheyyu|cheyyu)\b/gi, '')
          .replace(/[.,;!?]+$/, '')
          .trim();
      }
    } else if (
      lower.includes('first result') ||
      lower.includes('1st result') ||
      lower.includes('aadyathe') ||
      clean.includes('ആദ്യത്തെ')
    ) {
      targetObject = 'first_result';
    } else if (
      lower.includes('second result') ||
      lower.includes('2nd result') ||
      lower.includes('randamathe')
    ) {
      targetObject = 'second_result';
    }

    return {
      language,
      actionVerb,
      targetApp,
      targetObject,
      queryText,
      isFollowUp,
      rawTokens: tokens,
    };
  }
}

export const multilingualNLP = new MultilingualNLP();
