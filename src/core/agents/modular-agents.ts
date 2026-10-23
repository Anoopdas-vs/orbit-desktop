/**
 * JANKI AI — MODULAR SPECIALIZED AGENTS ARCHITECTURE (Phase 6)
 * 
 * Defines specialized cognitive agents:
 * 1. PlannerAgent: Decomposes compound requests into steps
 * 2. ResearchAgent: Handles web search, temporal recency, and browser navigation
 * 3. ComputerAgent: Executes macOS GUI, keyboard, and application controls
 * 4. MemoryAgent: Manages and searches structured long-term context
 * 5. VerificationAgent: Validates actual post-execution state via perception
 * 6. FinalResponseAgent: Formats dual-mode voice + UI markdown responses
 * 
 * INVARIANT: No agent has unrestricted tool access. All agents operate under
 * the exact same PolicyEngine, ToolRegistry, PermissionManager, and KillSwitch.
 */

import { toolRegistry } from '../../tools/tool-registry';
import { memoryEngine, MemoryItem } from '../memory-engine';
import { dynamicPlanner } from '../dynamic-planner';
import { knowledgeRouter } from '../knowledge-router';
import { answerGenerator, SynthesizedAnswer } from '../answer-generator';
import { promptInjectionDefense } from '../prompt-injection-defense';
import { nativeBridge, ComputerStateInfo } from '../../adapters/native/tauri-bridge';

export class PlannerAgent {
  public async plan(goal: string, activeApp?: string) {
    return dynamicPlanner.decomposeGoal(goal, activeApp);
  }
}

export class ResearchAgent {
  public async search(query: string, maxResults: number = 5) {
    const res = await toolRegistry.dispatch('web_search', { query, maxResults });
    if (!res.success) {
      return { success: false, results: [], error: res.error };
    }
    // Pass external results through prompt injection sanitizer
    const sanitized = (res.data?.results || []).map((r: any) => {
      const check = promptInjectionDefense.analyzeAndSanitize(r.snippet, `search_snippet_${r.url}`);
      return {
        ...r,
        snippet: check.sanitizedText,
        isSafe: check.isSafe,
      };
    });

    return {
      success: true,
      results: sanitized,
    };
  }

  public async researchTopic(topic: string, browser: string = 'Safari') {
    return await toolRegistry.dispatch('browser_research', { topic, browser });
  }
}

export class ComputerAgent {
  public async openApp(appName: string) {
    return await nativeBridge.openApp(appName);
  }

  public async getComputerState(): Promise<ComputerStateInfo> {
    return await nativeBridge.getComputerState();
  }

  public async inspectUiTree(appName?: string) {
    return await nativeBridge.getUiTree(appName);
  }
}

export class MemoryAgent {
  public searchRelevantContext(query: string, limit: number = 3): MemoryItem[] {
    return memoryEngine.searchRelevantMemories(query, undefined, limit);
  }

  public storeFact(key: string, value: string, isSensitive: boolean = false) {
    return memoryEngine.saveMemory('personal_fact', key, value, isSensitive);
  }

  public getPreferences() {
    return memoryEngine.getUserPreferences();
  }
}

export class VerificationAgent {
  public async verifyActiveApp(expectedApp: string): Promise<boolean> {
    const state = await nativeBridge.getComputerState();
    return state.activeApp.toLowerCase().includes(expectedApp.toLowerCase());
  }

  public async verifyScreenText(text: string): Promise<boolean> {
    const res = await toolRegistry.dispatch('screen_understanding', {
      action: 'find_text_on_screen',
      queryText: text,
    });
    return res.success && !!res.data?.matchingElements?.length;
  }
}

export class FinalResponseAgent {
  public async generateAnswer(
    query: string,
    searchResults: any[],
    language?: 'en' | 'ml' | 'manglish'
  ): Promise<SynthesizedAnswer> {
    const lang = language === 'ml' || language === 'manglish' ? 'ml' : 'en';
    return await answerGenerator.generate(query, searchResults, lang);
  }
}

export const plannerAgent = new PlannerAgent();
export const researchAgent = new ResearchAgent();
export const computerAgent = new ComputerAgent();
export const memoryAgent = new MemoryAgent();
export const verificationAgent = new VerificationAgent();
export const finalResponseAgent = new FinalResponseAgent();
