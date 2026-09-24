import { z } from 'zod';

export const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const ActionStatusSchema = z.enum([
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
  'DRY_RUN'
]);
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

export const ActionItemSchema = z.lazy(() => z.object({
  id: z.string(),
  skillId: z.string(),
  title: z.string(),
  description: z.string(),
  riskLevel: RiskLevelSchema,
  params: z.record(z.any()),
  status: ActionStatusSchema,
  requiresTypedConfirmation: z.boolean().default(false),
  confirmationPhrase: z.string().optional(),
  expectedEffect: z.string(),
  dryRunSupported: z.boolean().default(true),
  executionDurationMs: z.number().optional(),
  output: z.any().optional(),
  error: z.string().optional(),
}));
export type ActionItem = z.infer<typeof ActionItemSchema>;

export const ActionPlanSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  userPrompt: z.string(),
  interpretedIntent: z.string(),
  overallRisk: RiskLevelSchema,
  actions: z.array(ActionItemSchema),
  isDryRun: z.boolean().default(false),
  status: z.enum(['DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'EXECUTING', 'COMPLETED', 'REJECTED', 'ABORTED_BY_KILL_SWITCH']),
  clarificationNeeded: z.string().optional(),
  auditLogId: z.string().optional(),
});
export type ActionPlan = z.infer<typeof ActionPlanSchema>;
