import { ActionItem, ActionPlan, RiskLevel } from '../types/action-plan';
import { killSwitch } from './kill-switch';

export interface PolicyEvaluationResult {
  allowed: boolean;
  requiresApproval: boolean;
  approvalType: 'none' | 'single-click' | 'review-diff' | 'typed-phrase';
  requiredConfirmationPhrase?: string;
  rejectionReason?: string;
  riskLevel: RiskLevel;
}

export interface SecurityPolicyConfig {
  autoApproveLowRisk: boolean;
  tradingEnabled: boolean;
  tradingMode: 'OFF' | 'READ_ONLY' | 'PAPER_TRADING' | 'LIVE_SPOT_CONFIRMATION_REQUIRED';
  maxOrderInr: number;
  dailyTradingLimitInr: number;
  allowedApplications: string[];
  allowedDomains: string[];
  allowedTradingPairs: string[];
}

export const DEFAULT_POLICY_CONFIG: SecurityPolicyConfig = {
  autoApproveLowRisk: true, // Safe read and browser launcher actions run smoothly on voice command
  tradingEnabled: false,
  tradingMode: 'PAPER_TRADING',
  maxOrderInr: 1000,
  dailyTradingLimitInr: 5000,
  allowedApplications: [
    'Terminal',
    'Finder',
    'Safari',
    'Google Chrome',
    'Visual Studio Code',
    'Antigravity',
    'Claude Code',
    'Cursor',
    'Calculator',
    'TextEdit',
    'System Settings'
  ],
  allowedDomains: [
    'github.com',
    'binance.com',
    'npmjs.com',
    'stackoverflow.com',
    'developer.mozilla.org',
    'localhost'
  ],
  allowedTradingPairs: ['BTCUSDT', 'ETHUSDT'],
};

export class PolicyEngine {
  private config: SecurityPolicyConfig;

  constructor(config: Partial<SecurityPolicyConfig> = {}) {
    this.config = { ...DEFAULT_POLICY_CONFIG, ...config };
  }

  public updateConfig(newConfig: Partial<SecurityPolicyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): SecurityPolicyConfig {
    return { ...this.config };
  }

  /**
   * Determine the highest risk level in an action plan
   */
  public calculateOverallRisk(actions: ActionItem[]): RiskLevel {
    const riskPriority: Record<RiskLevel, number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };

    let highest: RiskLevel = 'LOW';
    for (const action of actions) {
      if (riskPriority[action.riskLevel] > riskPriority[highest]) {
        highest = action.riskLevel;
      }
    }
    return highest;
  }

  /**
   * Evaluate whether a single action item satisfies safety policy
   */
  public evaluateAction(action: ActionItem): PolicyEvaluationResult {
    // 1. Check emergency kill switch
    if (killSwitch.isEngaged()) {
      return {
        allowed: false,
        requiresApproval: false,
        approvalType: 'none',
        rejectionReason: `Blocked by Emergency Kill Switch: ${killSwitch.getReason()}`,
        riskLevel: action.riskLevel,
      };
    }

    // 2. Skill-specific policy checks
    switch (action.skillId) {
      case 'open_application': {
        const appName = action.params.appName as string;
        if (!this.config.allowedApplications.some(a => a.toLowerCase() === (appName || '').toLowerCase())) {
          return {
            allowed: false,
            requiresApproval: false,
            approvalType: 'none',
            rejectionReason: `Application "${appName}" is not in the approved applications allowlist.`,
            riskLevel: action.riskLevel,
          };
        }
        break;
      }

      case 'open_url': {
        const urlStr = action.params.url as string;
        try {
          const parsed = new URL(urlStr);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return {
              allowed: false,
              requiresApproval: false,
              approvalType: 'none',
              rejectionReason: `Invalid URL protocol "${parsed.protocol}". Only HTTP/HTTPS allowed.`,
              riskLevel: action.riskLevel,
            };
          }
        } catch {
          return {
            allowed: false,
            requiresApproval: false,
            approvalType: 'none',
            rejectionReason: `Malformed URL "${urlStr}".`,
            riskLevel: action.riskLevel,
          };
        }
        break;
      }

      case 'binance_spot_order': {
        if (!this.config.tradingEnabled || this.config.tradingMode === 'OFF') {
          return {
            allowed: false,
            requiresApproval: false,
            approvalType: 'none',
            rejectionReason: 'Trading module is currently turned OFF. Enable paper or spot trading in settings.',
            riskLevel: 'CRITICAL',
          };
        }
        if (this.config.tradingMode === 'READ_ONLY') {
          return {
            allowed: false,
            requiresApproval: false,
            approvalType: 'none',
            rejectionReason: 'Trading mode is set to READ_ONLY. Orders cannot be prepared or executed.',
            riskLevel: 'CRITICAL',
          };
        }

        const symbol = (action.params.symbol || '').toUpperCase();
        if (!this.config.allowedTradingPairs.includes(symbol)) {
          return {
            allowed: false,
            requiresApproval: false,
            approvalType: 'none',
            rejectionReason: `Trading pair "${symbol}" is not in the approved pairs allowlist (${this.config.allowedTradingPairs.join(', ')}).`,
            riskLevel: 'CRITICAL',
          };
        }

        const inrAmount = Number(action.params.inrAmount) || 0;
        if (inrAmount > this.config.maxOrderInr) {
          return {
            allowed: false,
            requiresApproval: false,
            approvalType: 'none',
            rejectionReason: `Order amount (₹${inrAmount}) exceeds maximum single order cap of ₹${this.config.maxOrderInr}.`,
            riskLevel: 'CRITICAL',
          };
        }

        // Critical order requires exact typed phrase
        return {
          allowed: true,
          requiresApproval: true,
          approvalType: 'typed-phrase',
          requiredConfirmationPhrase: `Confirm spot buy ${symbol} for ₹${inrAmount}`,
          riskLevel: 'CRITICAL',
        };
      }

      case 'git_workflow': {
        const op = action.params.operation as string;
        if (op === 'push' || op === 'force_push') {
          const branch = action.params.branch as string;
          const protectedBranches = ['main', 'master', 'production', 'release'];
          if (protectedBranches.includes(branch?.toLowerCase())) {
            return {
              allowed: false,
              requiresApproval: false,
              approvalType: 'none',
              rejectionReason: `Direct push to protected branch "${branch}" is strictly forbidden.`,
              riskLevel: 'CRITICAL',
            };
          }
          if (op === 'force_push') {
            return {
              allowed: false,
              requiresApproval: false,
              approvalType: 'none',
              rejectionReason: 'Force push is strictly blocked by Janki safety policy.',
              riskLevel: 'CRITICAL',
            };
          }
        }
        break;
      }

      case 'deployment': {
        const env = action.params.environment as string;
        if (env === 'production') {
          return {
            allowed: true,
            requiresApproval: true,
            approvalType: 'typed-phrase',
            requiredConfirmationPhrase: `Confirm production deployment to ${action.params.target || 'target'}`,
            riskLevel: 'CRITICAL',
          };
        }
        break;
      }
    }

    // 3. General Risk-Tier Evaluation
    switch (action.riskLevel) {
      case 'LOW':
        return {
          allowed: true,
          requiresApproval: !this.config.autoApproveLowRisk,
          approvalType: this.config.autoApproveLowRisk ? 'none' : 'single-click',
          riskLevel: 'LOW',
        };
      case 'MEDIUM':
        return {
          allowed: true,
          requiresApproval: true,
          approvalType: 'single-click',
          riskLevel: 'MEDIUM',
        };
      case 'HIGH':
        return {
          allowed: true,
          requiresApproval: true,
          approvalType: 'review-diff',
          riskLevel: 'HIGH',
        };
      case 'CRITICAL':
        return {
          allowed: true,
          requiresApproval: true,
          approvalType: 'typed-phrase',
          requiredConfirmationPhrase: action.confirmationPhrase || 'Confirm critical operation',
          riskLevel: 'CRITICAL',
        };
    }
  }

  /**
   * Evaluate complete action plan
   */
  public evaluatePlan(plan: ActionPlan): {
    canAutoExecute: boolean;
    highestRisk: RiskLevel;
    evaluations: Map<string, PolicyEvaluationResult>;
    blockedReason?: string;
  } {
    const evaluations = new Map<string, PolicyEvaluationResult>();
    let canAutoExecute = true;

    for (const action of plan.actions) {
      const result = this.evaluateAction(action);
      evaluations.set(action.id, result);

      if (!result.allowed) {
        return {
          canAutoExecute: false,
          highestRisk: plan.overallRisk,
          evaluations,
          blockedReason: result.rejectionReason,
        };
      }

      if (result.requiresApproval) {
        canAutoExecute = false;
      }
    }

    return {
      canAutoExecute,
      highestRisk: plan.overallRisk,
      evaluations,
    };
  }
}

export const defaultPolicyEngine = new PolicyEngine();
