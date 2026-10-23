import { z } from 'zod';
import { Tool, ToolExecutionContext, ToolExecutionResult, VerificationResult } from '../../types/tools';
import { screenSkill, ScreenSkillInput, ScreenSkillOutput } from '../../skills/screen/screen-skill';

export const ScreenUnderstandingToolInputSchema = z.object({
  action: z.enum(['capture_screen', 'inspect_screen', 'find_text_on_screen', 'explain_screen']),
  queryText: z.string().optional(),
  targetApp: z.string().optional(),
  outputPath: z.string().optional(),
});

export type ScreenUnderstandingToolInput = z.infer<typeof ScreenUnderstandingToolInputSchema>;

export class ScreenUnderstandingTool implements Tool<ScreenUnderstandingToolInput, ScreenSkillOutput> {
  public name = 'screen_understanding';
  public description = 'Multimodal screen vision tool for inspecting active desktop windows, controls, text, and answering questions about on-screen state.';
  public inputSchema = ScreenUnderstandingToolInputSchema;
  public riskLevel = 'LOW' as const;
  public requiredPermissions = ['screenRecording' as const];

  public async execute(
    input: ScreenUnderstandingToolInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<ScreenSkillOutput>> {
    const startTime = performance.now();

    if (context.killSwitchActive()) {
      return {
        status: 'BLOCKED',
        success: false,
        error: 'Execution blocked: Emergency Kill Switch is engaged.',
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      const res = await screenSkill.execute(
        {
          action: input.action,
          queryText: input.queryText,
          targetApp: input.targetApp,
          outputPath: input.outputPath,
        },
        {
          sessionId: 'tool-screen-exec',
          isDryRun: false,
          killSwitchActive: () => context.killSwitchActive(),
        }
      );

      return {
        status: res.success ? 'SUCCESS' : 'FAILED',
        success: res.success,
        data: res.data,
        stdout: res.stdout,
        message: res.message,
        error: res.error,
        durationMs: res.durationMs,
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        success: false,
        error: err.message || 'Screen understanding failed',
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  public async verify(
    input: ScreenUnderstandingToolInput,
    result: ToolExecutionResult<ScreenSkillOutput>
  ): Promise<VerificationResult> {
    if (!result.success) {
      return {
        verified: false,
        actualState: result.status,
        error: result.error || 'Screen action failed',
      };
    }

    return {
      verified: true,
      actualState: `Successfully executed screen understanding: ${input.action}`,
    };
  }
}

export const screenUnderstandingTool = new ScreenUnderstandingTool();
