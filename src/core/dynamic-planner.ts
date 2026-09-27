import {
  DynamicPlannedStep,
  DynamicPlannedTask,
  StepPrecondition,
  RetryPolicy,
  DynamicVerificationMethod,
} from '../types/task-planning';
import { ActionItem, RiskLevel } from '../types/action-plan';
import { multilingualNLP } from './multilingual-nlp';
import { goalDecomposer } from './workflow/goal-decomposer';
import { WorkflowDefinition } from '../types/workflow';

export class DynamicPlanner {
  /**
   * Decompose a user goal prompt into typed dynamic steps with pre-conditions and verification.
   */
  public decomposeGoal(goalPrompt: string, activeApp?: string): DynamicPlannedTask | null {
    const raw = goalPrompt.trim();
    const clean = raw.toLowerCase().replace(/^(?:hey|hei|hi|hello)?\s*janki[,:.\- ]*/i, '').trim();
    const lang = multilingualNLP.detectLanguage(raw);

    // 1. Browser Search Compound Task: e.g. "Open [Browser] and search for [Query]" or "Search [Browser] for [Query]"
    const browserSearchMatch = this.matchBrowserSearch(clean, raw, activeApp);
    if (browserSearchMatch) {
      const { browser, query } = browserSearchMatch;
      const steps: DynamicPlannedStep[] = [
        {
          id: crypto.randomUUID(),
          stepNumber: 1,
          title: `Launch ${browser}`,
          skillId: 'computer_control',
          action: 'open_app',
          target: browser,
          params: { appName: browser },
          preconditions: {},
          expectedResult: `${browser} is open and frontmost`,
          verificationMethod: 'app_active',
          verificationCriteria: { appName: browser },
          riskLevel: 'LOW',
          timeoutMs: 10000,
          retryPolicy: { maxRetries: 2, backoffMs: 400, allowReplanOnExhaustion: true },
        },
        {
          id: crypto.randomUUID(),
          stepNumber: 2,
          title: `Focus Search Field in ${browser}`,
          skillId: 'computer_control',
          action: 'focus_search_field',
          target: `${browser} address bar`,
          params: { appName: browser },
          preconditions: { requiredActiveApp: browser },
          expectedResult: 'Address bar or search field is focused',
          verificationMethod: 'element_present',
          verificationCriteria: { role: 'TEXTFIELD', appName: browser },
          riskLevel: 'LOW',
          timeoutMs: 5000,
          retryPolicy: { maxRetries: 2, backoffMs: 300, allowReplanOnExhaustion: true },
        },
        {
          id: crypto.randomUUID(),
          stepNumber: 3,
          title: `Type search query "${query}" and submit`,
          skillId: 'computer_control',
          action: 'submit_search',
          target: `${browser} search`,
          params: {
            appName: browser,
            query,
            url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          },
          preconditions: { requiredActiveApp: browser },
          expectedResult: `Search results for "${query}" visible`,
          verificationMethod: 'window_title',
          verificationCriteria: { contains: query, appName: browser },
          riskLevel: 'LOW',
          timeoutMs: 15000,
          retryPolicy: { maxRetries: 2, backoffMs: 500, allowReplanOnExhaustion: true },
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
        replanCount: 0,
        maxReplans: 2,
      };
    }

    // 2. Click Result Link in Browser: e.g. "Click first result link in Safari"
    if (clean.includes('first result') || clean.includes('first link') || clean.includes('click first')) {
      const browser = activeApp || (clean.includes('chrome') ? 'Google Chrome' : 'Safari');
      const steps: DynamicPlannedStep[] = [
        {
          id: crypto.randomUUID(),
          stepNumber: 1,
          title: `Activate ${browser}`,
          skillId: 'computer_control',
          action: 'activate_app',
          target: browser,
          params: { appName: browser },
          preconditions: {},
          expectedResult: `${browser} is frontmost`,
          verificationMethod: 'app_active',
          verificationCriteria: { appName: browser },
          riskLevel: 'LOW',
          timeoutMs: 5000,
          retryPolicy: { maxRetries: 1, backoffMs: 300, allowReplanOnExhaustion: true },
        },
        {
          id: crypto.randomUUID(),
          stepNumber: 2,
          title: `Click first result link in ${browser}`,
          skillId: 'computer_control',
          action: 'semantic_click',
          target: 'first search result',
          params: { appName: browser, target: 'first search result' },
          preconditions: { requiredActiveApp: browser },
          expectedResult: 'Opened first search result',
          verificationMethod: 'command_success',
          verificationCriteria: { appName: browser },
          riskLevel: 'LOW',
          timeoutMs: 8000,
          retryPolicy: { maxRetries: 2, backoffMs: 400, allowReplanOnExhaustion: true },
        },
      ];

      return {
        id: crypto.randomUUID(),
        goal: raw,
        language: lang,
        interpretedIntent: `Open First Result in ${browser}`,
        targetApp: browser,
        steps,
        overallRisk: 'LOW',
        replanCount: 0,
        maxReplans: 2,
      };
    }

    // 3. Browser Back Navigation: e.g. "Navigate back in Safari"
    if (clean.includes('navigate back') || clean.includes('go back') || clean === 'back') {
      const browser = activeApp || (clean.includes('chrome') ? 'Google Chrome' : 'Safari');
      const steps: DynamicPlannedStep[] = [
        {
          id: crypto.randomUUID(),
          stepNumber: 1,
          title: `Navigate Back in ${browser}`,
          skillId: 'computer_control',
          action: 'key_shortcut',
          target: browser,
          params: { appName: browser, modifiers: ['cmd'], key: '[' },
          preconditions: { requiredActiveApp: browser },
          expectedResult: `Returned to previous page in ${browser}`,
          verificationMethod: 'command_success',
          verificationCriteria: { appName: browser },
          riskLevel: 'LOW',
          timeoutMs: 4000,
          retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: false },
        },
      ];

      return {
        id: crypto.randomUUID(),
        goal: raw,
        language: lang,
        interpretedIntent: `Navigate Back in ${browser}`,
        targetApp: browser,
        steps,
        overallRisk: 'LOW',
        replanCount: 0,
        maxReplans: 2,
      };
    }

    // 3.5 Switch to Next Tab: e.g. "Switch to next tab in Safari" or "next tab"
    if (clean.includes('next tab') || clean.includes('switch to next tab') || clean === 'adutha tab') {
      const browser = activeApp || (clean.includes('chrome') ? 'Google Chrome' : 'Safari');
      const steps: DynamicPlannedStep[] = [
        {
          id: crypto.randomUUID(),
          stepNumber: 1,
          title: `Switch to Next Tab in ${browser}`,
          skillId: 'computer_control',
          action: 'key_shortcut',
          target: browser,
          params: { appName: browser, modifiers: ['ctrl'], key: 'Tab' },
          preconditions: { requiredActiveApp: browser },
          expectedResult: `Switched to next tab in ${browser}`,
          verificationMethod: 'command_success',
          verificationCriteria: { appName: browser },
          riskLevel: 'LOW',
          timeoutMs: 4000,
          retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: false },
        },
      ];

      return {
        id: crypto.randomUUID(),
        goal: raw,
        language: lang,
        interpretedIntent: `Switch to Next Tab in ${browser}`,
        targetApp: browser,
        steps,
        overallRisk: 'LOW',
        replanCount: 0,
        maxReplans: 2,
      };
    }

    // 4. Calculator Arithmetic
    if (clean.includes('calculator') || clean.includes('calculate')) {
      const exprMatch = clean.match(/(?:calculate|compute)?\s*([0-9\s+\-*x\/^().]+)/i);
      const expression = exprMatch && exprMatch[1] && /\d/.test(exprMatch[1])
        ? exprMatch[1].replace(/x/g, '*').trim()
        : '125 * 48';

      const steps: DynamicPlannedStep[] = [
        {
          id: crypto.randomUUID(),
          stepNumber: 1,
          title: 'Launch Calculator',
          skillId: 'computer_control',
          action: 'open_app',
          target: 'Calculator',
          params: { appName: 'Calculator' },
          preconditions: {},
          expectedResult: 'Calculator is open and frontmost',
          verificationMethod: 'app_active',
          verificationCriteria: { appName: 'Calculator' },
          riskLevel: 'LOW',
          timeoutMs: 8000,
          retryPolicy: { maxRetries: 2, backoffMs: 300, allowReplanOnExhaustion: true },
        },
        {
          id: crypto.randomUUID(),
          stepNumber: 2,
          title: `Calculate Expression "${expression}"`,
          skillId: 'computer_control',
          action: 'calculate_expression',
          target: 'Calculator',
          params: { appName: 'Calculator', expression },
          preconditions: { requiredActiveApp: 'Calculator' },
          expectedResult: 'Calculation evaluated',
          verificationMethod: 'element_present',
          verificationCriteria: { appName: 'Calculator' },
          riskLevel: 'LOW',
          timeoutMs: 5000,
          retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: true },
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
        replanCount: 0,
        maxReplans: 2,
      };
    }

    // 5. Tier 1 Catalog Decomposition via GoalDecomposer (Phase 4A)
    const compoundWorkflow = goalDecomposer.decomposeDeterministic(raw, activeApp);
    if (compoundWorkflow) {
      return this.workflowToDynamicTask(compoundWorkflow);
    }

    // 6. Editor Typing (TextEdit / Notes)
    if (clean.includes('textedit') || clean.includes('notes') || (activeApp && (clean.startsWith('type ') || clean.startsWith('write ')))) {
      const editor = activeApp || (clean.includes('notes') ? 'Notes' : 'TextEdit');
      const textMatch = raw.match(/(?:type|write|enter)\s+(?:into\s+[a-zA-Z\s]+:?\s*)?(?:this\s+message[: ]*)?(.+)$/i);
      const text = textMatch && textMatch[1] ? textMatch[1].replace(/[.,;!?]+$/, '').trim() : 'Hello from Janki';

      const steps: DynamicPlannedStep[] = [
        {
          id: crypto.randomUUID(),
          stepNumber: 1,
          title: `Launch ${editor}`,
          skillId: 'computer_control',
          action: 'open_app',
          target: editor,
          params: { appName: editor },
          preconditions: {},
          expectedResult: `${editor} is open and active`,
          verificationMethod: 'app_active',
          verificationCriteria: { appName: editor },
          riskLevel: 'LOW',
          timeoutMs: 8000,
          retryPolicy: { maxRetries: 2, backoffMs: 300, allowReplanOnExhaustion: true },
        },
        {
          id: crypto.randomUUID(),
          stepNumber: 2,
          title: `Type text into ${editor}`,
          skillId: 'computer_control',
          action: 'key_type',
          target: editor,
          params: { appName: editor, text },
          preconditions: { requiredActiveApp: editor },
          expectedResult: `Entered "${text.slice(0, 30)}" into document`,
          verificationMethod: 'command_success',
          verificationCriteria: { appName: editor },
          riskLevel: 'MEDIUM',
          timeoutMs: 10000,
          retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: false },
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
        replanCount: 0,
        maxReplans: 2,
      };
    }

    return null;
  }

  /**
   * Asynchronous goal decomposition supporting Tier 2 Ollama fallback.
   */
  public async decomposeGoalAsync(goalPrompt: string, activeApp?: string): Promise<DynamicPlannedTask | null> {
    const syncResult = this.decomposeGoal(goalPrompt, activeApp);
    if (syncResult) return syncResult;

    const asyncWorkflow = await goalDecomposer.decompose(goalPrompt, activeApp);
    if (asyncWorkflow) {
      return this.workflowToDynamicTask(asyncWorkflow);
    }
    return null;
  }

  /**
   * Convert Phase 4A WorkflowDefinition into DynamicPlannedTask.
   */
  public workflowToDynamicTask(workflow: WorkflowDefinition): DynamicPlannedTask {
    return {
      id: workflow.id,
      goal: workflow.goal,
      language: workflow.language,
      interpretedIntent: workflow.interpretedIntent,
      targetApp: workflow.targetApp,
      steps: workflow.steps.map((s) => ({
        id: s.id,
        stepNumber: s.stepNumber,
        title: s.title,
        skillId: s.skillId,
        action: s.action,
        target: s.params.target || s.params.path || s.params.appName,
        params: {
          ...s.params,
          variableBindings: s.variableBindings,
          dependencies: s.dependencies,
        },
        preconditions: s.preconditions,
        expectedResult: s.expectedResult,
        verificationMethod: s.verificationMethod,
        verificationCriteria: s.verificationCriteria || {},
        riskLevel: s.riskLevel,
        timeoutMs: s.timeoutMs,
        retryPolicy: s.retryPolicy,
      })),
      overallRisk: workflow.overallRisk,
      replanCount: 0,
      maxReplans: 2,
    };
  }

  /**
   * Convert dynamic steps into ActionItem array for ActionPlan compatibility.
   */
  public toActionItems(task: DynamicPlannedTask): ActionItem[] {
    return task.steps.map((step) => ({
      id: step.id,
      skillId: step.skillId,
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
        retryPolicy: step.retryPolicy,
        preconditions: step.preconditions,
        ...step.params,
      },
      status: 'PENDING_APPROVAL',
      requiresTypedConfirmation: step.riskLevel === 'CRITICAL',
      expectedEffect: step.expectedResult,
      dryRunSupported: true,
    }));
  }

  private matchBrowserSearch(clean: string, raw: string, activeApp?: string): { browser: string; query: string } | null {
    const isSearch =
      clean.includes('search') ||
      clean.includes('seach') ||
      clean.includes('serach') ||
      clean.includes('തിരയൂ') ||
      clean.includes('google ൽ') ||
      clean.includes('googleil');

    if (!isSearch) return null;

    let browser = activeApp || 'Safari';
    if (clean.includes('chrome') || clean.includes('google chrome')) {
      browser = 'Google Chrome';
    } else if (clean.includes('safari')) {
      browser = 'Safari';
    }

    let query = '';
    const matchMl = raw.match(/(?:Google\s*ൽ|ൽ)\s+(.+?)\s+(?:search\s*ചെയ്യൂ|തിരയൂ|search\s*cheyyu)/i);
    if (matchMl && matchMl[1]) query = matchMl[1].trim();

    if (!query) {
      const matchManglish = raw.match(/(?:open\s+cheythitu|open\s+cheythu|cheythitu)\s+(.+?)\s+(?:search\s*cheyyu|search)/i);
      if (matchManglish && matchManglish[1]) query = matchManglish[1].trim();
    }

    if (!query) {
      const matchEn = raw.match(/(?:search\s+for|search|seach\s+for|seach)\s+(.+)$/i);
      if (matchEn && matchEn[1]) {
        query = matchEn[1]
          .replace(/\b(?:in\s+safari|in\s+chrome|on\s+safari|on\s+chrome|please|search\s*cheyyu|cheyyu)\b/gi, '')
          .replace(/[.,;!?]+$/, '')
          .trim();
      }
    }

    if (!query || query.toLowerCase() === 'safari' || query.toLowerCase() === 'chrome') {
      query = 'Kerala News';
    }

    return { browser, query };
  }
}

export const dynamicPlanner = new DynamicPlanner();
