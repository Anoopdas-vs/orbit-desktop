import { describe, it, expect } from 'vitest';
import { ActionPlanSchema, RiskLevelSchema, ActionStatusSchema } from '../src/types/action-plan';

describe('ActionPlan Schema Validation', () => {
  it('validates a well-formed ActionPlan', () => {
    const validPlan = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: new Date().toISOString(),
      userPrompt: 'Run tests',
      interpretedIntent: 'Execute Test Suite',
      overallRisk: 'MEDIUM',
      isDryRun: false,
      status: 'AWAITING_APPROVAL',
      actions: [
        {
          id: 'action-1',
          skillId: 'terminal_runner',
          title: 'Run Tests',
          description: 'npm test',
          riskLevel: 'MEDIUM',
          params: { command: 'npm test' },
          status: 'PENDING_APPROVAL',
          requiresTypedConfirmation: false,
          expectedEffect: 'Runs test suite',
          dryRunSupported: true,
        },
      ],
    };

    const parsed = ActionPlanSchema.safeParse(validPlan);
    expect(parsed.success).toBe(true);
  });

  it('rejects an invalid risk level', () => {
    const invalidRisk = 'EXTREME';
    const parsed = RiskLevelSchema.safeParse(invalidRisk);
    expect(parsed.success).toBe(false);
  });

  it('rejects an invalid action status', () => {
    const invalidStatus = 'SOME_RANDOM_STATUS';
    const parsed = ActionStatusSchema.safeParse(invalidStatus);
    expect(parsed.success).toBe(false);
  });

  it('requires a valid UUID for ActionPlan id', () => {
    const invalidPlan = {
      id: 'not-a-uuid',
      createdAt: new Date().toISOString(),
      userPrompt: 'Test',
      interpretedIntent: 'Test',
      overallRisk: 'LOW',
      isDryRun: false,
      status: 'DRAFT',
      actions: [],
    };
    const parsed = ActionPlanSchema.safeParse(invalidPlan);
    expect(parsed.success).toBe(false);
  });
});
