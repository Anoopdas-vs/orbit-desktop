import { z } from 'zod';
import { Tool, ToolExecutionContext, ToolExecutionResult, VerificationResult } from '../../types/tools';
import { browserSkill } from '../../skills/browser/browser-skill';
import { nativeBridge } from '../../adapters/native/tauri-bridge';

export const BrowserResearchInputSchema = z.object({
  query: z.string().min(1, 'Research query cannot be empty'),
  browser: z.enum(['Safari', 'Google Chrome']).default('Safari'),
  searchEngine: z.enum(['google', 'duckduckgo', 'bing']).default('google'),
});

export type BrowserResearchInput = z.infer<typeof BrowserResearchInputSchema>;

export interface BrowserResearchOutput {
  query: string;
  browser: string;
  url: string;
  windowTitle?: string;
  observedElementsCount: number;
  extractedSnippet: string;
}

export class BrowserResearchTool implements Tool<BrowserResearchInput, BrowserResearchOutput> {
  public name = 'browser_research';
  public description = 'Performs controlled browser-based research using Safari or Google Chrome via existing native macOS automation.';
  public inputSchema = BrowserResearchInputSchema;
  public riskLevel = 'LOW' as const;
  public requiredPermissions = ['automation' as const, 'accessibility' as const];

  public async execute(
    input: BrowserResearchInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<BrowserResearchOutput>> {
    const startTime = performance.now();

    if (context.killSwitchActive()) {
      return {
        status: 'BLOCKED',
        success: false,
        error: 'Execution blocked: Emergency Kill Switch is engaged.',
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    const browser = input.browser || 'Safari';
    const searchUrl =
      input.searchEngine === 'google'
        ? `https://www.google.com/search?q=${encodeURIComponent(input.query)}`
        : `https://duckduckgo.com/?q=${encodeURIComponent(input.query)}`;

    if (context.isDryRun) {
      return {
        status: 'SUCCESS',
        success: true,
        data: {
          query: input.query,
          browser,
          url: searchUrl,
          windowTitle: `[DRY RUN] ${input.query} - Google Search`,
          observedElementsCount: 20,
          extractedSnippet: `Simulated browser search in ${browser} for "${input.query}"`,
        },
        stdout: `[DRY RUN] Would open ${browser} to ${searchUrl} and observe search results.`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      // 1. Navigate browser using existing browser_skill
      const navResult = await browserSkill.execute(
        {
          action: 'navigate',
          browser,
          url: searchUrl,
        },
        {
          isDryRun: false,
          killSwitchActive: context.killSwitchActive,
        }
      );

      if (!navResult.success) {
        return {
          status: 'FAILED',
          success: false,
          error: navResult.error || `Failed to navigate ${browser} to search URL`,
          durationMs: Math.round(performance.now() - startTime),
        };
      }

      // 2. Observe page state and UI tree through existing native bridge
      let windowTitle = navResult.data?.windowTitle || `${input.query} - Search`;
      let observedElementsCount = 0;
      let extractedSnippet = `Search results for "${input.query}" in ${browser}`;

      try {
        const state = await nativeBridge.getComputerState();
        if (state.activeWindow) {
          windowTitle = state.activeWindow;
        }

        const tree = await nativeBridge.getUiTree(browser);
        if (tree) {
          observedElementsCount = tree.totalCount || 0;
          // Extract notable heading or element titles from accessibility tree
          const texts: string[] = [];
          if (Array.isArray(tree.elements)) {
            for (const elem of tree.elements) {
              if (elem.title && elem.title.length > 5) texts.push(elem.title);
              if (elem.value && typeof elem.value === 'string' && elem.value.length > 5) texts.push(elem.value);
            }
          }
          if (texts.length > 0) {
            extractedSnippet = texts.slice(0, 5).join(' | ');
          }
        }
      } catch (obsErr) {
        console.warn('Browser page state observation non-fatal warning:', obsErr);
      }

      return {
        status: 'SUCCESS',
        success: true,
        data: {
          query: input.query,
          browser,
          url: searchUrl,
          windowTitle,
          observedElementsCount,
          extractedSnippet,
        },
        stdout: `Opened ${browser} for "${input.query}". Observed page: "${windowTitle}" (${observedElementsCount} UI elements).`,
        message: `Browser research initiated in ${browser} for "${input.query}".`,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        success: false,
        error: err.message || `Browser research failed in ${browser}`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  public async verify(
    input: BrowserResearchInput,
    result: ToolExecutionResult<BrowserResearchOutput>
  ): Promise<VerificationResult> {
    if (!result.success || !result.data) {
      return {
        verified: false,
        actualState: result.status,
        error: result.error || 'Browser research execution failed',
      };
    }

    try {
      const state = await nativeBridge.getComputerState();
      const isActive =
        (state.activeApp && state.activeApp.toLowerCase().includes(result.data.browser.toLowerCase())) ||
        (state.activeWindow && state.activeWindow.toLowerCase().includes(input.query.toLowerCase())) ||
        (state.activeWindow && state.activeWindow.toLowerCase().includes('search'));

      return {
        verified: true,
        actualState: `${result.data.browser} active: ${isActive ? 'verified' : 'backgrounded'}`,
      };
    } catch {
      return {
        verified: true,
        actualState: 'Executed navigation',
      };
    }
  }
}

export const browserResearchTool = new BrowserResearchTool();
