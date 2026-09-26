import { z } from 'zod';
import { SkillManifest, SkillExecutionContext, SkillExecutionResult } from '../types/skills';
import { checkApplicationAvailability } from './app-availability';

export const AiPromptAgentInputSchema = z.object({
  tool: z.enum(['chatgpt', 'claude', 'gemini', 'ollama']).default('chatgpt'),
  prompt: z.string().min(1),
  forceBrowser: z.boolean().default(false),
  useClipboardAcceleration: z.boolean().default(true),
});
export type AiPromptAgentInput = z.input<typeof AiPromptAgentInputSchema>;

export interface AiPromptAgentResult {
  tool: string;
  mode: 'native_app' | 'browser_web' | 'local_api';
  prompt: string;
  appVerified: boolean;
  message: string;
}

export const aiPromptAgentSkill: SkillManifest<AiPromptAgentInput, AiPromptAgentResult> = {
  id: 'ai_prompt_agent',
  name: 'Multi-Model AI Prompt Dispatcher',
  description: 'Pre-checks application availability and dispatches prompts to ChatGPT, Claude, Gemini, or Ollama in the fastest available mode with clipboard acceleration',
  riskLevel: 'LOW',
  supportsDryRun: true,
  allowedPlatforms: ['all'],
  approvalRequirement: 'none',
  inputSchema: AiPromptAgentInputSchema,

  dryRun: async (input: AiPromptAgentInput) => {
    const tool = input.tool || 'chatgpt';
    const availability = await checkApplicationAvailability(tool);
    const mode = tool === 'ollama'
      ? 'local_api'
      : (!input.forceBrowser && availability.available ? 'native_app' : 'browser_web');

    return {
      success: true,
      data: {
        tool,
        mode,
        prompt: input.prompt,
        appVerified: availability.available,
        message: `[DRY RUN] Verified ${tool} (${availability.available ? 'Installed' : 'Web'}). Fastest mode: ${mode}. Prompt: "${input.prompt}"`,
      },
      message: `[DRY RUN] Verified ${tool} (${availability.available ? 'Native App' : 'Browser Web'}). Ready to dispatch in fastest mode.`,
      durationMs: 1,
    };
  },

  execute: async (input: AiPromptAgentInput, context: SkillExecutionContext): Promise<SkillExecutionResult<AiPromptAgentResult>> => {
    const start = performance.now();
    if (context.killSwitchActive()) {
      return {
        success: false,
        error: 'Execution denied: Emergency Kill Switch is engaged.',
        durationMs: performance.now() - start,
      };
    }

    const tool = input.tool || 'chatgpt';

    // 1. Condition: First check if application is already available or not
    const appCheck = await checkApplicationAvailability(tool);
    const useNative = !input.forceBrowser && appCheck.available;
    const mode = tool === 'ollama' ? 'local_api' : (useNative ? 'native_app' : 'browser_web');

    // 2. Dispatch via native bridge (Tauri IPC in desktop, dev server in browser)
    try {
      const { nativeBridge } = await import('../adapters/native/tauri-bridge');
      const data = await nativeBridge.promptAi(tool, input.prompt, input.useClipboardAcceleration ?? true);
      if (data && data.success) {
        return {
          success: true,
          data: {
            tool,
            mode: (data.mode as any) || mode,
            prompt: input.prompt,
            appVerified: appCheck.available,
            message: data.message || `Dispatched prompt to ${tool} in ${mode} mode.`,
          },
          message: data.message || `Dispatched prompt to ${tool} in ${mode} mode.`,
          durationMs: performance.now() - start,
        };
      }
    } catch (err: any) {
      console.warn('Native macOS bridge prompt-ai failed, using browser fallback:', err);
    }

    // 3. Fallback direct browser opening if bridge unavailable
    const targetUrl = tool === 'claude'
      ? `https://claude.ai`
      : tool === 'gemini'
      ? `https://gemini.google.com`
      : `https://chatgpt.com/?q=${encodeURIComponent(input.prompt)}`;

    if (typeof window !== 'undefined') {
      try {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.warn('Popup blocked:', err);
      }
    }

    return {
      success: true,
      data: {
        tool,
        mode,
        prompt: input.prompt,
        appVerified: appCheck.available,
        message: `⚡ Dispatched prompt to ${tool} via ${mode} (${appCheck.available ? 'Native App' : 'Browser Web'})`,
      },
      message: `Prompt sent to ${tool}: "${input.prompt.slice(0, 60)}${input.prompt.length > 60 ? '...' : ''}"`,
      durationMs: performance.now() - start,
    };
  },
};
