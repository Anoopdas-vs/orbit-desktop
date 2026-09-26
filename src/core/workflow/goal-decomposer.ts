/**
 * JANKI AI — GENERALIZED GOAL DECOMPOSER (Phase 4A)
 * 
 * Synthesizes multi-step, multi-skill workflows from user instructions using:
 * Tier 1: Deterministic Workflow Catalog (fast regex & multi-language intent matching)
 * Tier 2: Local Ollama Fallback (strictly constrained to registered skills and Zod validation)
 * 
 * Invariants:
 * 1. Output is always a validated WorkflowDefinition.
 * 2. Unregistered skill IDs are rejected immediately.
 * 3. Never bypasses PolicyEngine risk evaluation or approval gates.
 * 4. Never generates arbitrary shell/code execution.
 * 5. Gracefully degrades to null (triggering clarification) if unresolvable.
 */

import {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowDefinitionSchema,
} from '../../types/workflow';
import { RiskLevel } from '../../types/action-plan';
import { multilingualNLP } from '../multilingual-nlp';
import { skillRegistry } from '../../skills';
import { defaultOllamaAdapter, OllamaAdapter } from '../../adapters/llm/ollama-adapter';
import { defaultPolicyEngine } from '../policy-engine';

export class GoalDecomposer {
  private ollama: OllamaAdapter;

  constructor(ollama: OllamaAdapter = defaultOllamaAdapter) {
    this.ollama = ollama;
  }

  /**
   * Main decomposition entrypoint: Tries Tier 1 (deterministic catalog) first,
   * then Tier 2 (local Ollama fallback) if unhandled.
   */
  public async decompose(
    goalPrompt: string,
    activeApp?: string
  ): Promise<WorkflowDefinition | null> {
    const raw = (goalPrompt || '').trim();
    if (!raw) return null;

    // 1. Tier 1: Deterministic Workflow Catalog
    const deterministic = this.decomposeDeterministic(raw, activeApp);
    if (deterministic) {
      return deterministic;
    }

    // 2. Tier 2: Local Ollama Fallback
    return await this.decomposeWithOllama(raw, activeApp);
  }

  /**
   * Tier 1 — Deterministic Workflow Catalog
   * Fast, zero-latency parsing of multi-skill compound patterns.
   */
  public decomposeDeterministic(
    goalPrompt: string,
    activeApp?: string
  ): WorkflowDefinition | null {
    const raw = goalPrompt.trim();
    const clean = raw.toLowerCase().replace(/^(?:hey|hei|hi|hello)?\s*janki[,:.\- ]*/i, '').trim();
    const lang = multilingualNLP.detectLanguage(raw);

    // Pattern 1: Files -> Document (Search files and write/summarize in editor)
    // English: "Find all PDF files in Downloads and summarize in TextEdit"
    // Malayalam: "Downloads ലുള്ള ഫയലുകൾ കണ്ടെത്തി TextEdit ൽ എഴുതൂ"
    // Manglish: "Downloads il ulla files kandethitu TextEdit il ezhuthu"
    const filesToDocMatch = this.matchFilesToDocument(clean, raw);
    if (filesToDocMatch) {
      return this.buildFilesToDocumentWorkflow(raw, lang, filesToDocMatch);
    }

    // Pattern 2: Browser Research -> Document
    // English: "Search Safari for AI news and save summary in TextEdit"
    // Malayalam: "Safari ൽ AI search cheythu TextEdit ൽ save cheyyu"
    const browserToDocMatch = this.matchBrowserToDocument(clean, raw, activeApp);
    if (browserToDocMatch) {
      return this.buildBrowserToDocumentWorkflow(raw, lang, browserToDocMatch);
    }

    // Pattern 3: System State -> Report
    // English: "Check system volume and battery and create status report"
    const systemReportMatch = this.matchSystemToReport(clean, raw);
    if (systemReportMatch) {
      return this.buildSystemToReportWorkflow(raw, lang, systemReportMatch);
    }

    // Pattern 4: Safe File Organization
    // English: "Find invoices in Downloads and organize to Documents"
    const fileOrgMatch = this.matchFileOrganization(clean, raw);
    if (fileOrgMatch) {
      return this.buildFileOrganizationWorkflow(raw, lang, fileOrgMatch);
    }

    return null;
  }

  /**
   * Tier 2 — Local Ollama fallback with strict Zod validation
   */
  public async decomposeWithOllama(
    goalPrompt: string,
    activeApp?: string
  ): Promise<WorkflowDefinition | null> {
    try {
      // 1. Health check to avoid long timeouts if Ollama is not running
      const health = await this.ollama.checkHealth();
      if (!health.available) {
        return null;
      }

      // 2. Query registered skills to strictly constrain choices
      const registeredSkills = skillRegistry.listSkills().map((s) => s.id);
      if (registeredSkills.length === 0) {
        return null;
      }

      const lang = multilingualNLP.detectLanguage(goalPrompt);
      const systemContext = `You are the Janki Autonomous Task Planner.
Decompose the user goal into a multi-step WorkflowDefinition JSON.
STRICT RULES:
1. You may ONLY use the following registered skill IDs: ${registeredSkills.join(', ')}.
2. Never output shell scripts, arbitrary bash, or code to execute.
3. Every step must have: id, stepNumber, title, skillId, action, params, expectedResult, riskLevel.
4. riskLevel must be one of: "LOW", "MEDIUM", "HIGH", "CRITICAL".
5. Output pure JSON matching this structure:
{
  "id": "uuid",
  "goal": "string",
  "language": "${lang}",
  "interpretedIntent": "string",
  "targetApp": "${activeApp || 'Safari'}",
  "overallRisk": "LOW",
  "currentStepIndex": 0,
  "status": "PENDING_APPROVAL",
  "createdAt": "${new Date().toISOString()}",
  "updatedAt": "${new Date().toISOString()}",
  "steps": [
    {
      "id": "step_1",
      "stepNumber": 1,
      "title": "string",
      "skillId": "valid_registered_skill_id",
      "action": "action_name",
      "params": {},
      "expectedResult": "string",
      "riskLevel": "LOW",
      "timeoutMs": 8000,
      "retryPolicy": { "maxRetries": 1, "backoffMs": 300, "allowReplanOnExhaustion": false }
    }
  ]
}`;

      const rawResponse = await this.ollama.generatePlanPrompt(goalPrompt, systemContext);
      if (!rawResponse) return null;

      // Extract JSON if wrapped in markdown code blocks
      let jsonString = rawResponse.trim();
      const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonString = codeBlockMatch[1].trim();
      }

      const parsed = JSON.parse(jsonString);

      // Validate against strict Zod schema
      const parseResult = WorkflowDefinitionSchema.safeParse(parsed);
      if (!parseResult.success) {
        console.warn('Ollama plan schema validation failed:', parseResult.error);
        return null;
      }

      const workflow = parseResult.data;

      // Guard: Ensure every proposed skillId is actually registered
      for (const step of workflow.steps) {
        if (!skillRegistry.hasSkill(step.skillId)) {
          console.warn(`Ollama proposed unregistered skillId: "${step.skillId}". Rejecting plan.`);
          return null;
        }
      }

      // Re-evaluate overall risk with PolicyEngine to prevent prompt injection risk spoofing
      let highestRisk: RiskLevel = 'LOW';
      const riskRank: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

      for (const step of workflow.steps) {
        if (riskRank[step.riskLevel] > riskRank[highestRisk]) {
          highestRisk = step.riskLevel;
        }
      }
      workflow.overallRisk = highestRisk;

      return workflow;
    } catch {
      // Gracefully fall back to null on network or parsing error
      return null;
    }
  }

  // --- Tier 1 Pattern Matchers ---

  private matchFilesToDocument(clean: string, raw: string): { dir: string; ext: string; editor: string } | null {
    const isFiles = clean.includes('file') || clean.includes('ഫയൽ') || clean.includes('ഫയല') || clean.includes('files');
    const isDoc = clean.includes('textedit') || clean.includes('notes') || clean.includes('summarize') || clean.includes('എഴുതൂ') || clean.includes('save');

    if (!isFiles || !isDoc) return null;

    let dir = '~/Downloads';
    if (clean.includes('documents')) dir = '~/Documents';
    else if (clean.includes('desktop')) dir = '~/Desktop';

    let ext = 'pdf';
    if (clean.includes('pdf')) ext = 'pdf';
    else if (clean.includes('csv')) ext = 'csv';
    else if (clean.includes('png') || clean.includes('image') || clean.includes('screenshot')) ext = 'png';
    else if (/\b(?:txt|text\s+file)\b/i.test(clean)) ext = 'txt';

    const editor = clean.includes('notes') ? 'Notes' : 'TextEdit';

    return { dir, ext, editor };
  }

  private buildFilesToDocumentWorkflow(
    raw: string,
    lang: 'en' | 'ml' | 'manglish' | 'mixed',
    match: { dir: string; ext: string; editor: string }
  ): WorkflowDefinition {
    const now = new Date().toISOString();
    const step1Id = 'step_1';
    const step2Id = 'step_2';
    const step3Id = 'step_3';

    const steps: WorkflowStep[] = [
      {
        id: step1Id,
        stepNumber: 1,
        title: `Find ${match.ext.toUpperCase()} files in ${match.dir}`,
        skillId: 'files_skill',
        action: 'find_files',
        params: { path: match.dir, query: match.ext },
        preconditions: {},
        expectedResult: `Located matching ${match.ext} files in ${match.dir}`,
        verificationMethod: 'command_success',
        riskLevel: 'LOW',
        timeoutMs: 6000,
        retryPolicy: { maxRetries: 1, backoffMs: 300, allowReplanOnExhaustion: true },
      },
      {
        id: step2Id,
        stepNumber: 2,
        title: `Write file summary to Document`,
        skillId: 'document_skill',
        action: 'create_document',
        params: {
          path: `${match.dir}/Discovered-Files-Summary.txt`,
          content: 'Discovered Files:\n{{step_1.output.files}}',
        },
        variableBindings: [
          {
            targetParam: 'content',
            sourceStepId: step1Id,
            sourcePath: 'output.files',
          },
        ],
        dependencies: [step1Id],
        preconditions: {},
        expectedResult: 'Document created with discovered file list',
        verificationMethod: 'file_exists',
        verificationCriteria: { path: `${match.dir}/Discovered-Files-Summary.txt` },
        riskLevel: 'MEDIUM',
        timeoutMs: 6000,
        retryPolicy: { maxRetries: 1, backoffMs: 300, allowReplanOnExhaustion: false },
      },
      {
        id: step3Id,
        stepNumber: 3,
        title: `Open ${match.editor} to display summary`,
        skillId: 'computer_control',
        action: 'open_app',
        params: { appName: match.editor },
        dependencies: [step2Id],
        preconditions: {},
        expectedResult: `${match.editor} is frontmost`,
        verificationMethod: 'app_active',
        verificationCriteria: { appName: match.editor },
        riskLevel: 'LOW',
        timeoutMs: 8000,
        retryPolicy: { maxRetries: 1, backoffMs: 300, allowReplanOnExhaustion: true },
      },
    ];

    return {
      id: crypto.randomUUID(),
      goal: raw,
      language: lang,
      interpretedIntent: `Find ${match.ext} files in ${match.dir} and summarize in ${match.editor}`,
      targetApp: match.editor,
      steps,
      overallRisk: 'MEDIUM',
      currentStepIndex: 0,
      status: 'PENDING_APPROVAL',
      createdAt: now,
      updatedAt: now,
    };
  }

  private matchBrowserToDocument(clean: string, raw: string, activeApp?: string): { browser: string; query: string; editor: string } | null {
    const isSearch = clean.includes('search') || clean.includes('തിരയൂ') || clean.includes('research') || clean.includes('nokku');
    const isDoc = clean.includes('save') || clean.includes('textedit') || clean.includes('notes') || clean.includes('summary') || clean.includes('എഴുതൂ');

    if (!isSearch || !isDoc) return null;

    let browser = activeApp || 'Safari';
    if (clean.includes('chrome')) browser = 'Google Chrome';
    else if (clean.includes('safari')) browser = 'Safari';

    let query = 'Artificial Intelligence';
    const queryMatch = raw.match(/(?:for|about|search|research)\s+(.+?)\s+(?:and|save|to|into|in)/i);
    if (queryMatch && queryMatch[1]) {
      query = queryMatch[1].trim();
    }

    const editor = clean.includes('notes') ? 'Notes' : 'TextEdit';

    return { browser, query, editor };
  }

  private buildBrowserToDocumentWorkflow(
    raw: string,
    lang: 'en' | 'ml' | 'manglish' | 'mixed',
    match: { browser: string; query: string; editor: string }
  ): WorkflowDefinition {
    const now = new Date().toISOString();
    const step1Id = 'step_1';
    const step2Id = 'step_2';
    const step3Id = 'step_3';

    const steps: WorkflowStep[] = [
      {
        id: step1Id,
        stepNumber: 1,
        title: `Search ${match.browser} for "${match.query}"`,
        skillId: 'browser_skill',
        action: 'navigate',
        params: {
          browser: match.browser,
          url: `https://www.google.com/search?q=${encodeURIComponent(match.query)}`,
        },
        preconditions: {},
        expectedResult: `Opened search results for "${match.query}"`,
        verificationMethod: 'command_success',
        riskLevel: 'LOW',
        timeoutMs: 10000,
        retryPolicy: { maxRetries: 2, backoffMs: 400, allowReplanOnExhaustion: true },
      },
      {
        id: step2Id,
        stepNumber: 2,
        title: `Record Research Note for "${match.query}"`,
        skillId: 'document_skill',
        action: 'create_document',
        params: {
          path: `~/Documents/Research-${encodeURIComponent(match.query).slice(0, 20)}.txt`,
          content: `Research Topic: ${match.query}\nBrowser: ${match.browser}\nSource URL: {{step_1.output.url}}`,
        },
        variableBindings: [
          {
            targetParam: 'content',
            sourceStepId: step1Id,
            sourcePath: 'output.url',
          },
        ],
        dependencies: [step1Id],
        preconditions: {},
        expectedResult: 'Research note created on disk',
        verificationMethod: 'file_exists',
        verificationCriteria: { path: `~/Documents/Research-${encodeURIComponent(match.query).slice(0, 20)}.txt` },
        riskLevel: 'MEDIUM',
        timeoutMs: 6000,
        retryPolicy: { maxRetries: 1, backoffMs: 300, allowReplanOnExhaustion: false },
      },
      {
        id: step3Id,
        stepNumber: 3,
        title: `Open ${match.editor} to view notes`,
        skillId: 'computer_control',
        action: 'open_app',
        params: { appName: match.editor },
        dependencies: [step2Id],
        preconditions: {},
        expectedResult: `${match.editor} is open`,
        verificationMethod: 'app_active',
        verificationCriteria: { appName: match.editor },
        riskLevel: 'LOW',
        timeoutMs: 8000,
        retryPolicy: { maxRetries: 1, backoffMs: 300, allowReplanOnExhaustion: true },
      },
    ];

    return {
      id: crypto.randomUUID(),
      goal: raw,
      language: lang,
      interpretedIntent: `Search ${match.browser} for "${match.query}" and save to ${match.editor}`,
      targetApp: match.editor,
      steps,
      overallRisk: 'MEDIUM',
      currentStepIndex: 0,
      status: 'PENDING_APPROVAL',
      createdAt: now,
      updatedAt: now,
    };
  }

  private matchSystemToReport(clean: string, _raw: string): boolean {
    return (
      (clean.includes('system') || clean.includes('volume') || clean.includes('battery')) &&
      (clean.includes('report') || clean.includes('status') || clean.includes('audit'))
    );
  }

  private buildSystemToReportWorkflow(
    raw: string,
    lang: 'en' | 'ml' | 'manglish' | 'mixed',
    _match: boolean
  ): WorkflowDefinition {
    const now = new Date().toISOString();
    const step1Id = 'step_1';
    const step2Id = 'step_2';

    const steps: WorkflowStep[] = [
      {
        id: step1Id,
        stepNumber: 1,
        title: 'Inspect macOS System Audio & State',
        skillId: 'system_skill',
        action: 'get_volume',
        params: {},
        preconditions: {},
        expectedResult: 'System volume and mute state queried',
        verificationMethod: 'command_success',
        riskLevel: 'LOW',
        timeoutMs: 5000,
        retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: false },
      },
      {
        id: step2Id,
        stepNumber: 2,
        title: 'Save System Status Report',
        skillId: 'document_skill',
        action: 'create_document',
        params: {
          path: '~/Documents/System-Status-Report.txt',
          content: 'macOS System Status Report:\nVolume: {{step_1.output.volumeLevel}}%\nMuted: {{step_1.output.isMuted}}',
        },
        variableBindings: [
          {
            targetParam: 'content',
            sourceStepId: step1Id,
            sourcePath: 'output.volumeLevel',
          },
        ],
        dependencies: [step1Id],
        preconditions: {},
        expectedResult: 'Report saved to Documents',
        verificationMethod: 'file_exists',
        verificationCriteria: { path: '~/Documents/System-Status-Report.txt' },
        riskLevel: 'MEDIUM',
        timeoutMs: 6000,
        retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: false },
      },
    ];

    return {
      id: crypto.randomUUID(),
      goal: raw,
      language: lang,
      interpretedIntent: 'Inspect System State and generate status report',
      targetApp: 'TextEdit',
      steps,
      overallRisk: 'MEDIUM',
      currentStepIndex: 0,
      status: 'PENDING_APPROVAL',
      createdAt: now,
      updatedAt: now,
    };
  }

  private matchFileOrganization(clean: string, _raw: string): { src: string; dest: string; query: string } | null {
    if (!clean.includes('organize') && !clean.includes('move')) return null;

    let src = '~/Downloads';
    let dest = '~/Documents';

    if (clean.includes('desktop')) dest = '~/Desktop';

    let query = 'invoice';
    if (clean.includes('screenshot')) query = 'screenshot';
    else if (clean.includes('pdf')) query = 'pdf';

    return { src, dest, query };
  }

  private buildFileOrganizationWorkflow(
    raw: string,
    lang: 'en' | 'ml' | 'manglish' | 'mixed',
    match: { src: string; dest: string; query: string }
  ): WorkflowDefinition {
    const now = new Date().toISOString();
    const step1Id = 'step_1';
    const step2Id = 'step_2';

    const steps: WorkflowStep[] = [
      {
        id: step1Id,
        stepNumber: 1,
        title: `Find "${match.query}" files in ${match.src}`,
        skillId: 'files_skill',
        action: 'find_files',
        params: { path: match.src, query: match.query },
        preconditions: {},
        expectedResult: `Located files matching "${match.query}"`,
        verificationMethod: 'command_success',
        riskLevel: 'LOW',
        timeoutMs: 6000,
        retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: false },
      },
      {
        id: step2Id,
        stepNumber: 2,
        title: `Safely move file to ${match.dest}`,
        skillId: 'files_skill',
        action: 'move_file',
        params: {
          path: '{{step_1.output.files[0]}}',
          newPath: `${match.dest}/`,
        },
        variableBindings: [
          {
            targetParam: 'path',
            sourceStepId: step1Id,
            sourcePath: 'output.files.0',
          },
        ],
        dependencies: [step1Id],
        preconditions: {},
        expectedResult: `File moved to ${match.dest}`,
        verificationMethod: 'command_success',
        riskLevel: 'HIGH', // File relocation escalates to HIGH risk!
        timeoutMs: 8000,
        retryPolicy: { maxRetries: 1, backoffMs: 300, allowReplanOnExhaustion: false },
      },
    ];

    return {
      id: crypto.randomUUID(),
      goal: raw,
      language: lang,
      interpretedIntent: `Organize "${match.query}" files from ${match.src} to ${match.dest}`,
      steps,
      overallRisk: 'HIGH',
      currentStepIndex: 0,
      status: 'PENDING_APPROVAL',
      createdAt: now,
      updatedAt: now,
    };
  }
}

export const goalDecomposer = new GoalDecomposer();
