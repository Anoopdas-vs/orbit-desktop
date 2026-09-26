import { z } from 'zod';
import { RiskLevel, RiskLevelSchema } from './action-plan';
import {
  StepPrecondition,
  RetryPolicy,
  DynamicVerificationMethod,
} from './task-planning';

export type WorkflowStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'RUNNING'
  | 'PAUSED_FOR_APPROVAL'
  | 'RECOVERING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABORTED_BY_KILL_SWITCH';

export const WorkflowStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'RUNNING',
  'PAUSED_FOR_APPROVAL',
  'RECOVERING',
  'COMPLETED',
  'FAILED',
  'ABORTED_BY_KILL_SWITCH',
]);

export interface WorkflowVariableBinding {
  targetParam: string;
  sourceStepId: string;
  sourcePath: string;
  fallbackValue?: any;
}

export const WorkflowVariableBindingSchema = z.object({
  targetParam: z.string(),
  sourceStepId: z.string(),
  sourcePath: z.string(),
  fallbackValue: z.any().optional(),
});

export const StepPreconditionSchema = z.object({
  requiredActiveApp: z.string().optional(),
  requiredWindowVisible: z.boolean().optional(),
  requiredElementPresent: z.string().optional(),
  requiredPathExists: z.string().optional(),
});

export const RetryPolicySchema = z.object({
  maxRetries: z.number().default(1),
  backoffMs: z.number().default(300),
  allowReplanOnExhaustion: z.boolean().default(false),
});

export const DynamicVerificationMethodSchema = z.enum([
  'app_active',
  'window_title',
  'element_present',
  'element_value',
  'file_exists',
  'file_content',
  'audio_state',
  'command_success',
]);

export interface CompensatingAction {
  id: string;
  stepId: string;
  title: string;
  skillId: string;
  action: string;
  params: Record<string, any>;
  isReversible: boolean;
  riskLevel: RiskLevel;
}

export const CompensatingActionSchema = z.object({
  id: z.string(),
  stepId: z.string(),
  title: z.string(),
  skillId: z.string(),
  action: z.string(),
  params: z.record(z.any()),
  isReversible: z.boolean(),
  riskLevel: RiskLevelSchema,
});

export interface RollbackResult {
  success: boolean;
  rolledBackSteps: string[];
  failedRollbacks: Array<{ stepId: string; error: string }>;
  skippedSteps: string[];
  summary: string;
}

export interface WorkflowStep {
  id: string;
  stepNumber: number;
  title: string;
  skillId: string;
  action: string;
  params: Record<string, any>;
  dependencies?: string[];
  variableBindings?: WorkflowVariableBinding[];
  compensatingAction?: CompensatingAction;
  preconditions: StepPrecondition;
  expectedResult: string;
  verificationMethod: DynamicVerificationMethod;
  verificationCriteria?: Record<string, any>;
  riskLevel: RiskLevel;
  timeoutMs: number;
  retryPolicy: RetryPolicy;
}

export const WorkflowStepSchema = z.object({
  id: z.string(),
  stepNumber: z.number(),
  title: z.string(),
  skillId: z.string(),
  action: z.string(),
  params: z.record(z.any()),
  dependencies: z.array(z.string()).optional(),
  variableBindings: z.array(WorkflowVariableBindingSchema).optional(),
  compensatingAction: CompensatingActionSchema.optional(),
  preconditions: StepPreconditionSchema.default({}),
  expectedResult: z.string(),
  verificationMethod: DynamicVerificationMethodSchema.default('command_success'),
  verificationCriteria: z.record(z.any()).optional(),
  riskLevel: RiskLevelSchema,
  timeoutMs: z.number().default(8000),
  retryPolicy: RetryPolicySchema.default({
    maxRetries: 1,
    backoffMs: 300,
    allowReplanOnExhaustion: false,
  }),
});

export interface WorkflowDefinition {
  id: string;
  goal: string;
  language: 'en' | 'ml' | 'manglish' | 'mixed';
  interpretedIntent: string;
  targetApp?: string;
  steps: WorkflowStep[];
  overallRisk: RiskLevel;
  currentStepIndex: number;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
}

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  goal: z.string(),
  language: z.enum(['en', 'ml', 'manglish', 'mixed']),
  interpretedIntent: z.string(),
  targetApp: z.string().optional(),
  steps: z.array(WorkflowStepSchema).min(1),
  overallRisk: RiskLevelSchema,
  currentStepIndex: z.number().default(0),
  status: WorkflowStatusSchema.default('PENDING_APPROVAL'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export interface StepExecutionRecord {
  stepId: string;
  stepNumber: number;
  title: string;
  skillId: string;
  action: string;
  resolvedParams: Record<string, any>;
  success: boolean;
  verified: boolean;
  actualState?: string;
  output?: any;
  error?: string;
  durationMs: number;
  retriesUsed: number;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  goal: string;
  status: WorkflowStatus;
  completedStepsCount: number;
  totalStepsCount: number;
  stepRecords: StepExecutionRecord[];
  rollbackResult?: RollbackResult;
  error?: string;
  totalDurationMs: number;
}

export type WorkflowMilestoneType =
  | 'WORKFLOW_STARTED'
  | 'STEP_STARTED'
  | 'STEP_COMPLETED'
  | 'AWAITING_APPROVAL'
  | 'RECOVERING'
  | 'WORKFLOW_COMPLETED'
  | 'WORKFLOW_FAILED'
  | 'WORKFLOW_ABORTED';

export interface WorkflowMilestoneEvent {
  type: WorkflowMilestoneType;
  workflowId: string;
  goal: string;
  stepIndex?: number;
  totalSteps?: number;
  stepTitle?: string;
  error?: string;
  timestamp: string;
}

