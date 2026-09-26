import { ActionItem, RiskLevel } from '../types/action-plan';

export interface PlannedStep {
  id: string;
  stepNumber: number;
  title: string;
  action: string;
  target?: string;
  params: Record<string, any>;
  expectedResult: string;
  verificationMethod: 'app_active' | 'element_present' | 'element_value' | 'window_title' | 'audio_state' | 'command_success' | 'none';
  verificationCriteria: Record<string, any>;
  riskLevel: RiskLevel;
  timeoutMs: number;
  retryLimit: number;
}

export interface PlannedTask {
  id: string;
  goal: string;
  language: 'en' | 'ml' | 'manglish';
  interpretedIntent: string;
  targetApp?: string;
  steps: PlannedStep[];
  overallRisk: RiskLevel;
}

export class ActionPlanner {
  /**
   * Decompose a user goal prompt into structured executable steps with verification methods.
   */
  public plan(userPrompt: string): PlannedTask | null {
    const raw = userPrompt.trim();
    const clean = this.normalizeInput(raw);
    const lang = this.detectLanguage(raw);

    // 1. "Open [Browser] and search for [Query]"
    // Support: English, Malayalam, Manglish
    const browserSearchMatch = this.matchBrowserSearch(clean, raw);
    if (browserSearchMatch) {
      const { browser, query } = browserSearchMatch;
      const steps: PlannedStep[] = [
        {
          id: crypto.randomUUID(),
          stepNumber: 1,
          title: `Launch ${browser}`,
          action: 'open_app',
          target: browser,
          params: { appName: browser },
          expectedResult: `${browser} is open and frontmost`,
          verificationMethod: 'app_active',
          verificationCriteria: { appName: browser },
          riskLevel: 'LOW',
          timeoutMs: 10000,
          retryLimit: 2,
        },
        {
          id: crypto.randomUUID(),
          stepNumber: 2,
          title: `Focus Search / Address Field in ${browser}`,
          action: 'focus_search_field',
          target: `${browser} address bar`,
          params: { appName: browser },
          expectedResult: 'Address bar or search field is focused',
          verificationMethod: 'element_present',
          verificationCriteria: { role: 'TEXTFIELD', appName: browser },
          riskLevel: 'LOW',
          timeoutMs: 5000,
          retryLimit: 2,
        },
        {
          id: crypto.randomUUID(),
          stepNumber: 3,
          title: `Type search query "${query}" and submit`,
          action: 'submit_search',
          target: `${browser} search`,
          params: {
            appName: browser,
            query,
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          },
          expectedResult: `Search results for "${query}" visible`,
          verificationMethod: 'window_title',
          verificationCriteria: { contains: query, appName: browser },
          riskLevel: 'LOW',
          timeoutMs: 15000,
          retryLimit: 2,
        },
      ];

      return {
        id: crypto.randomUUID(),
        goal: raw,
        language: lang,
        interpretedIntent: `Search ${browser} for "${query}"`,
        targetApp: browser,
        steps,
        overallRisk: 'LOW',
      };
    }

    // 2. "Open Calculator and calculate [Expression]"
    const calcMatch = this.matchCalculatorArithmetic(clean);
    if (calcMatch) {
      const { expression } = calcMatch;
      const steps: PlannedStep[] = [
        {
          id: crypto.randomUUID(),
          stepNumber: 1,
          title: 'Launch Calculator',
          action: 'open_app',
          target: 'Calculator',
          params: { appName: 'Calculator' },
          expectedResult: 'Calculator is open and frontmost',
          verificationMethod: 'app_active',
          verificationCriteria: { appName: 'Calculator' },
          riskLevel: 'LOW',
          timeoutMs: 8000,
          retryLimit: 2,
        },
        {
          id: crypto.randomUUID(),
          stepNumber: 2,
          title: `Calculate Expression "${expression}"`,
          action: 'calculate_expression',
          target: 'Calculator',
          params: { appName: 'Calculator', expression },
          expectedResult: 'Calculation evaluated',
          verificationMethod: 'element_present',
          verificationCriteria: { appName: 'Calculator' },
          riskLevel: 'LOW',
          timeoutMs: 5000,
          retryLimit: 1,
        },
      ];

      return {
        id: crypto.randomUUID(),
        goal: raw,
        language: lang,
        interpretedIntent: `Calculate ${expression} in Calculator`,
        targetApp: 'Calculator',
        steps,
        overallRisk: 'LOW',
      };
    }

    // 3. "Open [Editor] and type [Text]"
    const editorTypeMatch = this.matchEditorTyping(clean, raw);
    if (editorTypeMatch) {
      const { editor, text } = editorTypeMatch;
      const steps: PlannedStep[] = [
        {
          id: crypto.randomUUID(),
          stepNumber: 1,
          title: `Launch ${editor}`,
          action: 'open_app',
          target: editor,
          params: { appName: editor },
          expectedResult: `${editor} is open and active`,
          verificationMethod: 'app_active',
          verificationCriteria: { appName: editor },
          riskLevel: 'LOW',
          timeoutMs: 8000,
          retryLimit: 2,
        },
        {
          id: crypto.randomUUID(),
          stepNumber: 2,
          title: `Type text into ${editor}`,
          action: 'key_type',
          target: editor,
          params: { appName: editor, text },
          expectedResult: `Entered "${text.slice(0, 30)}" into document`,
          verificationMethod: 'command_success',
          verificationCriteria: { appName: editor },
          riskLevel: 'MEDIUM',
          timeoutMs: 10000,
          retryLimit: 1,
        },
      ];

      return {
        id: crypto.randomUUID(),
        goal: raw,
        language: lang,
        interpretedIntent: `Type into ${editor}`,
        targetApp: editor,
        steps,
        overallRisk: 'MEDIUM',
      };
    }

    // 4. Semantic Click: "Click the [target] button" / "Click [target]"
    if (clean.startsWith('click ') || clean.startsWith('press button ')) {
      const target = clean.replace(/^(?:click|press button)\s+(?:the\s+)?/i, '').replace(/\s+button$/i, '').trim();
      return {
        id: crypto.randomUUID(),
        goal: raw,
        language: lang,
        interpretedIntent: `Click "${target}"`,
        steps: [
          {
            id: crypto.randomUUID(),
            stepNumber: 1,
            title: `Click "${target}"`,
            action: 'semantic_click',
            target,
            params: { target },
            expectedResult: `Clicked "${target}" UI element`,
            verificationMethod: 'command_success',
            verificationCriteria: { target },
            riskLevel: 'LOW',
            timeoutMs: 6000,
            retryLimit: 2,
          },
        ],
        overallRisk: 'LOW',
      };
    }

    // 5. System Audio Controls: volume, mute
    if (clean.includes('mute') || clean.includes('volume')) {
      const isMute = clean.includes('mute');
      const volMatch = clean.match(/(?:volume|set volume to)\s*([0-9]{1,3})/i);
      const volLevel = volMatch ? parseInt(volMatch[1], 10) : undefined;

      const steps: PlannedStep[] = [
        {
          id: crypto.randomUUID(),
          stepNumber: 1,
          title: isMute ? 'Toggle System Mute' : `Set Volume to ${volLevel ?? 50}%`,
          action: isMute ? 'toggle_mute' : 'set_volume',
          params: isMute ? {} : { volumeLevel: volLevel ?? 50 },
          expectedResult: isMute ? 'Audio mute toggled' : `Volume adjusted to ${volLevel}%`,
          verificationMethod: 'audio_state',
          verificationCriteria: isMute ? { isMuted: true } : { volume: volLevel },
          riskLevel: 'LOW',
          timeoutMs: 3000,
          retryLimit: 1,
        },
      ];

      return {
        id: crypto.randomUUID(),
        goal: raw,
        language: lang,
        interpretedIntent: isMute ? 'Toggle Mute' : `Set Volume to ${volLevel}%`,
        steps,
        overallRisk: 'LOW',
      };
    }

    // 6. Window manipulation: "minimize", "maximize", "zoom", "close window"
    if (clean.includes('minimize') || clean.includes('maximize') || clean.includes('zoom') || clean.includes('close window')) {
      const action = clean.includes('minimize')
        ? 'minimize_window'
        : clean.includes('close')
        ? 'close_window'
        : 'zoom_window';

      return {
        id: crypto.randomUUID(),
        goal: raw,
        language: lang,
        interpretedIntent: `Window ${action}`,
        steps: [
          {
            id: crypto.randomUUID(),
            stepNumber: 1,
            title: `Perform ${action} on active window`,
            action,
            params: {},
            expectedResult: `Window ${action} completed`,
            verificationMethod: 'command_success',
            verificationCriteria: {},
            riskLevel: 'LOW',
            timeoutMs: 4000,
            retryLimit: 1,
          },
        ],
        overallRisk: 'LOW',
      };
    }

    return null;
  }

  /**
   * Convert a PlannedTask into an array of ActionItems for the ActionPlan schema.
   */
  public toActionItems(task: PlannedTask): ActionItem[] {
    return task.steps.map((step) => ({
      id: step.id,
      skillId: 'computer_control',
      title: step.title,
      description: `Action: ${step.action} -> Expected: ${step.expectedResult}`,
      riskLevel: step.riskLevel,
      params: {
        action: step.action,
        target: step.target,
        expectedResult: step.expectedResult,
        verificationMethod: step.verificationMethod,
        verificationCriteria: step.verificationCriteria,
        timeoutMs: step.timeoutMs,
        retryLimit: step.retryLimit,
        ...step.params,
      },
      status: 'PENDING_APPROVAL',
      requiresTypedConfirmation: step.riskLevel === 'CRITICAL',
      expectedEffect: step.expectedResult,
      dryRunSupported: true,
    }));
  }

  private normalizeInput(raw: string): string {
    return raw
      .toLowerCase()
      .replace(/^(?:hey|hei|hi|hello)?\s*janki[,:.\- ]*/i, '')
      .trim();
  }

  private detectLanguage(text: string): 'en' | 'ml' | 'manglish' {
    // Malayalam Unicode Range: U+0D00 to U+0D7F
    const hasMalayalamScript = /[\u0D00-\u0D7F]/.test(text);
    if (hasMalayalamScript) return 'ml';

    const manglishMarkers = [
      'open aakki',
      'open cheyyu',
      'cheytho',
      'thurannu',
      'nokku',
      'parayu',
      'cheythitu',
      'cheyyu',
      'cheyithu',
      'aakku',
      'nokk',
      'aayi',
      'thudangu',
    ];
    const lower = text.toLowerCase();
    if (manglishMarkers.some((m) => lower.includes(m))) {
      return 'manglish';
    }

    return 'en';
  }

  private matchBrowserSearch(clean: string, raw: string): { browser: string; query: string } | null {
    // Must contain an actual search keyword (not just the app name "Google Chrome")
    const isSearch =
      clean.includes('search') ||
      clean.includes('search for') ||
      clean.includes('തിരയൂ') ||
      clean.includes('google ൽ') ||
      clean.includes('google-il') ||
      clean.includes('googleil');

    if (!isSearch) return null;

    let browser = 'Safari';
    if (clean.includes('chrome') || clean.includes('google chrome')) {
      browser = 'Google Chrome';
    } else if (clean.includes('safari')) {
      browser = 'Safari';
    }

    // Extract query from raw input to preserve original casing
    let query = '';

    // 1. Malayalam pattern: e.g. "Safari തുറന്ന് Google ൽ Oksy Healthcare search ചെയ്യൂ"
    const matchMl = raw.match(/(?:Google\s*ൽ|ൽ)\s+(.+?)\s+(?:search\s*ചെയ്യൂ|തിരയൂ|search\s*cheyyu)/i);
    if (matchMl && matchMl[1]) {
      query = matchMl[1].trim();
    }

    // 2. Manglish pattern: "Safari open cheythitu Oksy Healthcare search cheyyu"
    if (!query) {
      const matchManglish = raw.match(/(?:open\s+cheythitu|open\s+cheythu|cheythitu)\s+(.+?)\s+(?:search\s*cheyyu|search)/i);
      if (matchManglish && matchManglish[1]) {
        query = matchManglish[1].trim();
      }
    }

    // 3. English "search for [Query]" or "search [Query]"
    if (!query) {
      const matchEn = raw.match(/(?:search\s+for|search)\s+(.+)$/i);
      if (matchEn && matchEn[1]) {
        query = matchEn[1]
          .replace(/\b(?:in\s+safari|in\s+chrome|on\s+safari|on\s+chrome|please|search\s*cheyyu|cheyyu)\b/gi, '')
          .trim();
      }
    }

    // 4. Fallback cleanup
    if (!query) {
      query = raw
        .replace(/^(?:open|launch)?\s*(?:safari|chrome|google chrome)?\s*(?:and)?\s*(?:search for|search)?/i, '')
        .trim();
    }

    if (!query || query.toLowerCase() === 'safari' || query.toLowerCase() === 'chrome') {
      query = 'Kerala News';
    }

    query = query.replace(/[.,;!?]+$/, '').trim();

    return { browser, query };
  }

  private matchCalculatorArithmetic(clean: string): { expression: string } | null {
    if (!clean.includes('calculator') && !clean.includes('calculate')) return null;

    // Pattern: "calculate 125 * 48" or "125 x 48"
    const exprMatch = clean.match(/(?:calculate|compute)?\s*([0-9\s+\-*x\/^().]+)/i);
    if (exprMatch && exprMatch[1] && /\d/.test(exprMatch[1])) {
      const expr = exprMatch[1].replace(/x/g, '*').trim();
      return { expression: expr };
    }

    return { expression: '125 * 48' };
  }

  private matchEditorTyping(clean: string, raw: string): { editor: string; text: string } | null {
    const isEditor = clean.includes('textedit') || clean.includes('text editor') || clean.includes('notes');
    const isType =
      clean.includes('type') ||
      clean.includes('write') ||
      clean.includes('enter') ||
      clean.includes('ezhuthu') ||
      clean.includes('എഴുതൂ');

    if (!isEditor || !isType) return null;

    const editor = clean.includes('notes') ? 'Notes' : 'TextEdit';
    let text = '';

    // 1. Manglish / Malayalam post-position: "TextEdit open cheythu [text] type cheyyu / ezhuthu"
    const matchPost = raw.match(
      /(?:open\s+cheythu|open\s+cheythitu|open\s+aakki|thurannu|തുറന്ന്)\s+(.+?)\s+(?:type\s*cheyyu|type\s*ചെയ്യൂ|ezhuthu|എഴുതൂ|type)/i
    );
    if (matchPost && matchPost[1]) {
      text = matchPost[1].trim();
    }

    // 2. English prefix: "type [text]" or "write [text]"
    if (!text) {
      const textMatch = raw.match(/(?:type|write|enter)\s+(?:this\s+message[: ]*)?(.+)$/i);
      if (textMatch && textMatch[1]) {
        text = textMatch[1]
          .replace(/\b(?:cheyyu|type\s*cheyyu|type\s*ചെയ്യൂ|ezhuthu|എഴുതൂ)\b/gi, '')
          .trim();
      }
    }

    if (!text) {
      text = 'Hello from Janki Autonomous Control';
    }

    text = text.replace(/[.,;!?]+$/, '').trim();

    return { editor, text };
  }
}

export const actionPlanner = new ActionPlanner();
