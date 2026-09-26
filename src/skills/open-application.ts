import { z } from 'zod';
import { SkillManifest, SkillExecutionContext, SkillExecutionResult } from '../types/skills';
import { nativeBridge } from '../adapters/native/tauri-bridge';

export const OpenAppInputSchema = z.object({
  appName: z.string().min(1),
  path: z.string().optional(),
});
export type OpenAppInput = z.infer<typeof OpenAppInputSchema>;

export const openApplicationSkill: SkillManifest<OpenAppInput> = {
  id: 'open_application',
  name: 'Open Application',
  description: 'Safely launches an approved macOS application from the system allowlist',
  riskLevel: 'LOW',
  supportsDryRun: true,
  allowedPlatforms: ['darwin'],
  approvalRequirement: 'none',
  inputSchema: OpenAppInputSchema,

  dryRun: async (input: OpenAppInput) => {
    return {
      success: true,
      message: `[DRY RUN] Would open macOS application: "${input.appName}"${input.path ? ` with path "${input.path}"` : ''}`,
      durationMs: 5,
    };
  },

  execute: async (input: OpenAppInput, context: SkillExecutionContext): Promise<SkillExecutionResult> => {
    const start = performance.now();
    if (context.killSwitchActive()) {
      return {
        success: false,
        error: 'Execution blocked: Emergency Kill Switch is engaged.',
        durationMs: performance.now() - start,
      };
    }

    try {
      const res = await nativeBridge.openApp(input.appName, input.path);
      return {
        success: res.success,
        data: { app: res.app || input.appName, path: input.path },
        message: res.message || `Successfully launched macOS application: "${res.app || input.appName}"`,
        stdout: `open -a "${res.app || input.appName}" ${input.path || ''}`.trim(),
        durationMs: performance.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || `Failed to open application: ${input.appName}`,
        durationMs: performance.now() - start,
      };
    }
  },
};
