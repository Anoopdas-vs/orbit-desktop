import { RiskLevel } from './action-plan';

export interface StepPrecondition {
  requiredActiveApp?: string;
  requiredWindowVisible?: boolean;
  requiredElementPresent?: string;
  requiredPathExists?: string;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  allowReplanOnExhaustion: boolean;
}

export type DynamicVerificationMethod =
  | 'app_active'
  | 'window_title'
  | 'element_present'
  | 'element_value'
  | 'file_exists'
  | 'file_content'
  | 'audio_state'
  | 'command_success';

export interface DynamicPlannedStep {
  id: string;
  stepNumber: number;
  title: string;
  skillId: string;
  action: string;
  target?: string;
  params: Record<string, any>;
  preconditions: StepPrecondition;
  expectedResult: string;
  verificationMethod: DynamicVerificationMethod;
  verificationCriteria: Record<string, any>;
  riskLevel: RiskLevel;
  timeoutMs: number;
  retryPolicy: RetryPolicy;
}

export interface DynamicPlannedTask {
  id: string;
  goal: string;
  language: 'en' | 'ml' | 'manglish' | 'mixed';
  interpretedIntent: string;
  targetApp?: string;
  steps: DynamicPlannedStep[];
  overallRisk: RiskLevel;
  replanCount: number;
  maxReplans: number;
}

export interface FailureDiagnosis {
  failedStepId: string;
  action: string;
  expectedState: string;
  observedState: string;
  rootCause:
    | 'APP_NOT_ACTIVE'
    | 'WINDOW_MINIMIZED'
    | 'ELEMENT_NOT_FOUND'
    | 'TIMEOUT'
    | 'PERMISSION_DENIED'
    | 'FILE_NOT_FOUND'
    | 'APP_UNRESPONSIVE'
    | 'BROWSER_TIMEOUT'
    | 'UNKNOWN';
  recoveryStrategy:
    | 'ACTIVATE_APP'
    | 'RESTORE_WINDOW'
    | 'REFOCUS'
    | 'RETRY_SCROLL'
    | 'RELOAD_TAB'
    | 'MDFIND_FALLBACK'
    | 'RESTART_APP'
    | 'COMPENSATING_ROLLBACK'
    | 'FAIL_CLOSED';
  suggestedSteps: DynamicPlannedStep[];
}
