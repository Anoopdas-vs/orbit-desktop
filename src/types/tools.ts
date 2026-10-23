import { z } from 'zod';
import { RiskLevel } from './action-plan';
import { RequiredPermission } from './skills';

export type ToolExecutionStatus =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'BLOCKED'
  | 'NEEDS_CONFIRMATION'
  | 'UNAVAILABLE';

export interface ToolExecutionContext {
  sessionId?: string;
  isDryRun?: boolean;
  userPrompt?: string;
  preferredLanguage?: 'en' | 'ml' | 'manglish' | 'mixed';
  confirmedByUser?: boolean;
  killSwitchActive: () => boolean;
}

export interface VerificationResult {
  verified: boolean;
  actualState?: string;
  error?: string;
}

export interface ToolExecutionResult<TOutput = any> {
  status: ToolExecutionStatus;
  success: boolean;
  data?: TOutput;
  stdout?: string;
  stderr?: string;
  error?: string;
  message?: string;
  durationMs: number;
  verification?: VerificationResult;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
}

export interface Tool<TInput = any, TOutput = any> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput, any, any>;
  riskLevel: RiskLevel;
  requiredPermissions?: RequiredPermission[];
  execute: (input: TInput, context: ToolExecutionContext) => Promise<ToolExecutionResult<TOutput>>;
  verify: (input: TInput, result: ToolExecutionResult<TOutput>, context: ToolExecutionContext) => Promise<VerificationResult>;
}

export type IntentCategory =
  | 'KNOWLEDGE_RESEARCH'
  | 'COMPUTER_ACTION'
  | 'EXTERNAL_WORKFLOW'
  | 'HYBRID_WORKFLOW';

export interface IntentClassification {
  category: IntentCategory;
  interpretedIntent: string;
  confidence: number;
  extractedQuery?: string;
  targetApp?: string;
  targetTool?: string;
  isLanguageMalayalam: boolean;
  subIntents?: string[];
}
