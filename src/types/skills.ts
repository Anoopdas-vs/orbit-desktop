import { z } from 'zod';
import { RiskLevel } from './action-plan';

export interface SkillManifest<TInput = any, TOutput = any> {
  id: string;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  supportsDryRun: boolean;
  allowedPlatforms: ('darwin' | 'all')[];
  approvalRequirement: 'none' | 'single-click' | 'review-diff' | 'typed-phrase';
  inputSchema: z.ZodType<TInput, any, any>;
  auditDataSchema?: z.ZodType<any, any, any>;
  execute: (input: TInput, context: SkillExecutionContext) => Promise<SkillExecutionResult<TOutput>>;
  dryRun?: (input: TInput, context: SkillExecutionContext) => Promise<SkillExecutionResult<TOutput>>;
}

export interface SkillExecutionContext {
  isDryRun: boolean;
  userPrompt: string;
  auditLogId?: string;
  killSwitchActive: () => boolean;
}

export interface SkillExecutionResult<T = any> {
  success: boolean;
  data?: T;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
  message?: string;
  durationMs: number;
}
