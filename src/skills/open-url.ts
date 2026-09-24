import { z } from 'zod';
import { SkillManifest, SkillExecutionContext, SkillExecutionResult } from '../types/skills';

export const OpenUrlInputSchema = z.object({
  url: z.string().url().refine((val) => val.startsWith('http://') || val.startsWith('https://'), {
    message: 'URL must use http:// or https:// protocol',
  }),
});
export type OpenUrlInput = z.infer<typeof OpenUrlInputSchema>;

export const openUrlSkill: SkillManifest<OpenUrlInput> = {
  id: 'open_url',
  name: 'Open URL',
  description: 'Safely opens a validated web URL in the default browser',
  riskLevel: 'LOW',
  supportsDryRun: true,
  allowedPlatforms: ['all'],
  approvalRequirement: 'none',
  inputSchema: OpenUrlInputSchema,

  dryRun: async (input: OpenUrlInput) => {
    return {
      success: true,
      message: `[DRY RUN] Would open browser URL: ${input.url}`,
      durationMs: 4,
    };
  },

  execute: async (input: OpenUrlInput, context: SkillExecutionContext): Promise<SkillExecutionResult> => {
    const start = performance.now();
    if (context.killSwitchActive()) {
      return {
        success: false,
        error: 'Execution blocked: Emergency Kill Switch is active.',
        durationMs: performance.now() - start,
      };
    }

    if (typeof window !== 'undefined') {
      try {
        window.open(input.url, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.warn('Browser window.open prevented by popup blocker:', err);
      }
    }

    return {
      success: true,
      data: { url: input.url },
      message: `Successfully opened URL: ${input.url}`,
      durationMs: performance.now() - start,
    };
  },
};
