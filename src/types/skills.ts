import { z } from 'zod';
import { RiskLevel } from './action-plan';

export type RequiredPermission =
  | 'accessibility'
  | 'fullDiskAccess'
  | 'automation'
  | 'screenRecording'
  | 'microphone'
  | 'network';

export interface SkillToolDefinition<TInput = any, TOutput = any> {
  name: string;
  description: string;
  riskLevel: RiskLevel;
  inputSchema?: z.ZodType<TInput, any, any>;
  outputSchema?: z.ZodType<TOutput, any, any>;
  execute?: (params: TInput, context: SkillExecutionContext) => Promise<SkillExecutionResult<TOutput>>;
  dryRun?: (params: TInput, context: SkillExecutionContext) => Promise<SkillExecutionResult<TOutput>>;
}

export interface SkillManifest<TInput = any, TOutput = any> {
  id: string;
  name: string;
  version?: string;
  description: string;
  capabilities?: string[];
  riskLevel: RiskLevel;
  supportsDryRun: boolean;
  allowedPlatforms: ('darwin' | 'all')[];
  approvalRequirement: 'none' | 'single-click' | 'review-diff' | 'typed-phrase';
  requiredPermissions?: RequiredPermission[];
  inputSchema: z.ZodType<TInput, any, any>;
  outputSchema?: z.ZodType<TOutput, any, any>;
  auditDataSchema?: z.ZodType<any, any, any>;
  tools?: Record<string, SkillToolDefinition>;
  execute: (input: TInput, context: SkillExecutionContext) => Promise<SkillExecutionResult<TOutput>>;
  dryRun?: (input: TInput, context: SkillExecutionContext) => Promise<SkillExecutionResult<TOutput>>;
  verifyOutcome?: (
    toolName: string,
    params: any,
    result: any
  ) => Promise<{ verified: boolean; actualState: string }>;
}

export interface SkillExecutionContext {
  sessionId?: string;
  isDryRun?: boolean;
  userPrompt?: string;
  riskTier?: RiskLevel;
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
