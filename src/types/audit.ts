import { RiskLevel } from './action-plan';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  source: 'voice' | 'text' | 'system';
  rawCommand: string;
  transcriptionConfidence?: number;
  interpretedIntent: string;
  actionPlanId?: string;
  overallRisk: RiskLevel;
  approvalStatus: 'NOT_REQUIRED' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED' | 'BLOCKED_BY_KILL_SWITCH';
  approvedBy?: string;
  approvalTimestamp?: string;
  actionsExecutedCount: number;
  actionsFailedCount: number;
  executionDurationMs: number;
  details: Record<string, any>;
  hasSensitiveRedactions: boolean;
}

export interface ApprovalEvent {
  id: string;
  planId: string;
  actionId?: string;
  riskLevel: RiskLevel;
  decision: 'APPROVE' | 'REJECT' | 'AUTO_APPROVE' | 'KILL_SWITCH_ABORT';
  decidedAt: string;
  typedPhraseEntered?: string;
  rejectionReason?: string;
}

export interface ExecutionLog {
  id: string;
  planId: string;
  actionId: string;
  skillId: string;
  commandExecuted?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  status: 'SUCCESS' | 'ERROR' | 'DRY_RUN' | 'ABORTED';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  error?: string;
}

export interface KillSwitchEvent {
  id: string;
  timestamp: string;
  triggeredBy: 'user-ui' | 'voice-emergency-stop' | 'policy-violation';
  reason: string;
  activeProcessesKilledCount: number;
}
