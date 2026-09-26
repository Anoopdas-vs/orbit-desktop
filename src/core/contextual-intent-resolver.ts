import { TaskContextManager, taskContextManager } from '../context/task-context-manager';
import { multilingualNLP, MultilingualNLP } from './multilingual-nlp';

export interface ResolvedContextualIntent {
  isContextual: boolean;
  canonicalPrompt: string;
  resolvedApp?: string;
  resolvedEntity?: string;
  actionType?: string;
  originalPrompt: string;
  language: 'en' | 'ml' | 'manglish' | 'mixed';
}

export class ContextualIntentResolver {
  private nlp: MultilingualNLP;

  constructor(nlp: MultilingualNLP = multilingualNLP) {
    this.nlp = nlp;
  }

  /**
   * Resolve an incoming prompt against the active multi-turn task context.
   * Handles anaphora ("it", "that", "the first result"), relative navigation ("go back"),
   * repetition ("again"), and implicit target applications.
   */
  public resolve(
    prompt: string,
    context: TaskContextManager = taskContextManager
  ): ResolvedContextualIntent {
    const rawTrimmed = prompt.trim();
    const cleanPrompt = rawTrimmed.replace(/^(?:hey|hei|hi|hello)?\s*janki[,:.\- ]*/i, '').trim();
    const tokens = this.nlp.parseIntentTokens(cleanPrompt);
    const lower = cleanPrompt.toLowerCase();

    const activeApp = context.getActiveApp() || undefined;
    const session = context.getActiveSession();
    const lastTurn = session && session.turns.length > 0 ? session.turns[session.turns.length - 1] : null;

    // 1. "Go back" / "Back" / "Thirike" (Browser Navigation)
    if (
      lower === 'go back' ||
      lower === 'back' ||
      lower === 'navigate back' ||
      lower === 'thirike' ||
      lower === 'thirike pooku' ||
      cleanPrompt === 'തിരികെ'
    ) {
      const targetBrowser = activeApp || 'Safari';
      return {
        isContextual: true,
        canonicalPrompt: `Navigate back in ${targetBrowser}`,
        resolvedApp: targetBrowser,
        actionType: 'browser_back',
        originalPrompt: rawTrimmed,
        language: tokens.language,
      };
    }

    // 1.5. "Next tab" / "Switch to next tab" / "Adutha tab"
    if (
      lower === 'next tab' ||
      lower === 'switch to next tab' ||
      lower === 'go to next tab' ||
      lower === 'adutha tab' ||
      lower === 'aduthathe tab' ||
      cleanPrompt === 'അടുത്ത ടാബ്'
    ) {
      const targetBrowser = activeApp || 'Safari';
      return {
        isContextual: true,
        canonicalPrompt: `Switch to next tab in ${targetBrowser}`,
        resolvedApp: targetBrowser,
        actionType: 'switch_tab',
        originalPrompt: rawTrimmed,
        language: tokens.language,
      };
    }

    // 2. "Open the first result" / "Click the first result" / "1st result"
    if (
      lower.includes('first result') ||
      lower.includes('1st result') ||
      lower.includes('first link') ||
      lower.includes('aadyathe result') ||
      lower.includes('aadyathe link') ||
      cleanPrompt.includes('ആദ്യത്തെ ലിങ്ക്') ||
      cleanPrompt.includes('ആദ്യത്തെ ഫലം')
    ) {
      const targetBrowser = activeApp || 'Safari';
      return {
        isContextual: true,
        canonicalPrompt: `Click first result link in ${targetBrowser}`,
        resolvedApp: targetBrowser,
        resolvedEntity: 'first_result',
        actionType: 'click_result',
        originalPrompt: rawTrimmed,
        language: tokens.language,
      };
    }

    // 3. "Do the same thing again" / "Again" / "Repeat" / "Veendum cheyyu"
    if (
      lower === 'again' ||
      lower === 'do it again' ||
      lower === 'do the same thing again' ||
      lower === 'repeat' ||
      lower === 'veendum' ||
      lower === 'veendum cheyyu' ||
      cleanPrompt === 'വീണ്ടും ചെയ്യൂ'
    ) {
      if (lastTurn && lastTurn.userPrompt) {
        return {
          isContextual: true,
          canonicalPrompt: lastTurn.userPrompt,
          resolvedApp: activeApp,
          actionType: 'repeat_last_turn',
          originalPrompt: rawTrimmed,
          language: tokens.language,
        };
      }
    }

    // 4. Follow-up search without repeating application:
    // e.g. "Now search for Oksy Healthcare" or "Search for Oksy Healthcare" when Safari is already active
    if (
      (tokens.actionVerb === 'search' || lower.includes('search') || lower.includes('തിരയൂ')) &&
      !tokens.targetApp &&
      activeApp
    ) {
      let query = tokens.queryText || '';
      if (!query) {
        const match = cleanPrompt.match(/(?:search\s+for|search|തിരയൂ)\s+(.+)$/i);
        if (match && match[1]) {
          query = match[1].replace(/[.,;!?]+$/, '').trim();
        }
      }

      if (query) {
        return {
          isContextual: true,
          canonicalPrompt: `Search ${activeApp} for "${query}"`,
          resolvedApp: activeApp,
          resolvedEntity: query,
          actionType: 'contextual_search',
          originalPrompt: rawTrimmed,
          language: tokens.language,
        };
      }
    }

    // 5. Follow-up typing without repeating application:
    // e.g. "Now type Hello world" when TextEdit is already active
    if (
      (tokens.actionVerb === 'type' || lower.startsWith('type ') || lower.startsWith('write ')) &&
      !tokens.targetApp &&
      activeApp
    ) {
      const textMatch = cleanPrompt.match(/(?:type|write|enter)\s+(.+)$/i);
      const text = textMatch && textMatch[1] ? textMatch[1].trim() : 'note';
      return {
        isContextual: true,
        canonicalPrompt: `Type into ${activeApp}: "${text}"`,
        resolvedApp: activeApp,
        resolvedEntity: text,
        actionType: 'contextual_type',
        originalPrompt: rawTrimmed,
        language: tokens.language,
      };
    }

    // 6. Explicit application launch or self-contained command (Not contextual)
    if (tokens.targetApp) {
      context.setActiveApp(tokens.targetApp);
    }

    return {
      isContextual: false,
      canonicalPrompt: rawTrimmed,
      resolvedApp: tokens.targetApp || activeApp,
      originalPrompt: rawTrimmed,
      language: tokens.language,
    };
  }
}

export const contextualIntentResolver = new ContextualIntentResolver();
