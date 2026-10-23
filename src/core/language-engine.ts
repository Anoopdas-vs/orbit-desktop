import { multilingualNLP } from './multilingual-nlp';
import { memoryEngine } from './memory-engine';

export interface LanguageDetectionResult {
  language: 'en' | 'ml' | 'manglish' | 'mixed';
  confidence: number;
  hasMalayalamScript: boolean;
  isManglish: boolean;
}

export class LanguageEngine {
  /**
   * Detect language and return detailed classification.
   */
  public detect(text: string): LanguageDetectionResult {
    const lang = multilingualNLP.detectLanguage(text);
    const hasMalayalamScript = /[\u0D00-\u0D7F]/.test(text);
    const isManglish = lang === 'manglish';
    const confidence = hasMalayalamScript ? 0.98 : isManglish ? 0.85 : 0.95;

    return {
      language: lang,
      confidence,
      hasMalayalamScript,
      isManglish,
    };
  }

  /**
   * Determine the target response language based on user query and saved preferences.
   */
  public determineResponseLanguage(userPrompt: string): 'en' | 'ml' {
    const detection = this.detect(userPrompt);
    if (detection.language === 'ml' || detection.language === 'manglish' || detection.hasMalayalamScript) {
      return 'ml';
    }

    const prefs = memoryEngine.getUserPreferences();
    if (prefs.preferredResponseLanguage === 'ml') {
      return 'ml';
    }

    return 'en';
  }

  /**
   * Synthesize or adapt an answer into natural Malayalam.
   */
  public formatMalayalamResponse(englishSummary: string, queryType?: string): string {
    // If the input already contains Malayalam script, return it directly
    if (/[\u0D00-\u0D7F]/.test(englishSummary)) {
      return englishSummary;
    }

    // Common query domain patterns translated into natural conversational Malayalam
    const lower = englishSummary.toLowerCase();

    if (queryType === 'news' || lower.includes('news') || lower.includes('വാർത്ത')) {
      return `ഇന്നത്തെ പ്രധാന വിവരങ്ങൾ ഇതാ: ${englishSummary.replace(/^news:\s*/i, '')}. കൂടുതൽ വിശദാംശങ്ങൾ വേണമെങ്കിൽ ചോദിക്കാവുന്നതാണ്.`;
    }

    if (lower.includes('gold') || lower.includes('സ്വർണ്ണം')) {
      return `സ്വർണ്ണവിലയെക്കുറിച്ചുള്ള പുതിയ വിവരങ്ങൾ: ${englishSummary}`;
    }

    if (lower.includes('gst') || lower.includes('ജി.എസ്.ടി')) {
      return `പുതിയ ജി.എസ്.ടി മാറ്റങ്ങളെക്കുറിച്ചുള്ള വിവരങ്ങൾ ഇതാ: ${englishSummary}`;
    }

    if (lower.includes('apple') || lower.includes('macbook')) {
      return `ആപ്പിളിന്റെ പുതിയ മാക്ബുക്കിനെക്കുറിച്ചുള്ള ഏറ്റവും പുതിയ വിവരങ്ങൾ ഇതാ: ${englishSummary}`;
    }

    // Standard conversational Malayalam wrapper for synthesized facts
    return `കണ്ടെത്തിയ വിവരങ്ങൾ പ്രകാരം: ${englishSummary}`;
  }

  /**
   * Generate an action summary in the target language.
   */
  public formatActionSummary(actionTitle: string, success: boolean, targetLang: 'en' | 'ml'): string {
    if (targetLang === 'ml') {
      if (success) {
        return `"${actionTitle}" വിജയകരമായി പൂർത്തിയാക്കി.`;
      }
      return `ക്ഷമിക്കണം, "${actionTitle}" പൂർത്തിയാക്കാൻ സാധിച്ചില്ല.`;
    }
    return success ? `Completed: "${actionTitle}" successfully.` : `Failed to complete: "${actionTitle}".`;
  }
}

export const languageEngine = new LanguageEngine();
