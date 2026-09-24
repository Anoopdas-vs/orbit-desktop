import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from '../src/core/policy-engine';
import { ActionItem } from '../src/types/action-plan';
import { killSwitch } from '../src/core/kill-switch';

describe('PolicyEngine Risk & Approval Evaluation', () => {
  let policy: PolicyEngine;

  beforeEach(() => {
    killSwitch.disengage();
    policy = new PolicyEngine({
      autoApproveLowRisk: false,
      tradingEnabled: true,
      tradingMode: 'PAPER_TRADING',
      allowedApplications: ['Terminal', 'Visual Studio Code', 'Safari'],
    });
  });

  it('calculates the highest overall risk among multiple actions', () => {
    const actions: ActionItem[] = [
      {
        id: '1',
        skillId: 'open_application',
        title: 'Open Terminal',
        description: '',
        riskLevel: 'LOW',
        params: { appName: 'Terminal' },
        status: 'PENDING_APPROVAL',
        requiresTypedConfirmation: false,
        expectedEffect: '',
        dryRunSupported: true,
      },
      {
        id: '2',
        skillId: 'terminal_runner',
        title: 'Run Tests',
        description: '',
        riskLevel: 'MEDIUM',
        params: { command: 'npm test' },
        status: 'PENDING_APPROVAL',
        requiresTypedConfirmation: false,
        expectedEffect: '',
        dryRunSupported: true,
      },
    ];

    expect(policy.calculateOverallRisk(actions)).toBe('MEDIUM');
  });

  it('requires single-click approval for LOW risk when auto-approve is disabled', () => {
    const action: ActionItem = {
      id: '1',
      skillId: 'open_application',
      title: 'Open Terminal',
      description: '',
      riskLevel: 'LOW',
      params: { appName: 'Terminal' },
      status: 'PENDING_APPROVAL',
      requiresTypedConfirmation: false,
      expectedEffect: '',
      dryRunSupported: true,
    };

    const evalResult = policy.evaluateAction(action);
    expect(evalResult.allowed).toBe(true);
    expect(evalResult.requiresApproval).toBe(true);
    expect(evalResult.approvalType).toBe('single-click');
  });

  it('auto-approves LOW risk when autoApproveLowRisk is explicitly enabled', () => {
    policy.updateConfig({ autoApproveLowRisk: true });

    const action: ActionItem = {
      id: '1',
      skillId: 'open_application',
      title: 'Open Terminal',
      description: '',
      riskLevel: 'LOW',
      params: { appName: 'Terminal' },
      status: 'PENDING_APPROVAL',
      requiresTypedConfirmation: false,
      expectedEffect: '',
      dryRunSupported: true,
    };

    const evalResult = policy.evaluateAction(action);
    expect(evalResult.allowed).toBe(true);
    expect(evalResult.requiresApproval).toBe(false);
    expect(evalResult.approvalType).toBe('none');
  });

  it('rejects an application that is not in the allowlist', () => {
    const action: ActionItem = {
      id: '1',
      skillId: 'open_application',
      title: 'Open Suspicious App',
      description: '',
      riskLevel: 'LOW',
      params: { appName: 'MaliciousBinary' },
      status: 'PENDING_APPROVAL',
      requiresTypedConfirmation: false,
      expectedEffect: '',
      dryRunSupported: true,
    };

    const evalResult = policy.evaluateAction(action);
    expect(evalResult.allowed).toBe(false);
    expect(evalResult.rejectionReason).toContain('not in the approved applications allowlist');
  });

  it('rejects URLs that do not use http/https protocol', () => {
    const action: ActionItem = {
      id: '1',
      skillId: 'open_url',
      title: 'Open File URL',
      description: '',
      riskLevel: 'LOW',
      params: { url: 'file:///etc/passwd' },
      status: 'PENDING_APPROVAL',
      requiresTypedConfirmation: false,
      expectedEffect: '',
      dryRunSupported: true,
    };

    const evalResult = policy.evaluateAction(action);
    expect(evalResult.allowed).toBe(false);
    expect(evalResult.rejectionReason).toContain('Only HTTP/HTTPS allowed');
  });

  it('requires typed phrase for CRITICAL actions', () => {
    const action: ActionItem = {
      id: '1',
      skillId: 'deployment',
      title: 'Deploy to Production',
      description: '',
      riskLevel: 'CRITICAL',
      params: { environment: 'production', target: 'vercel' },
      status: 'PENDING_APPROVAL',
      requiresTypedConfirmation: true,
      confirmationPhrase: 'Confirm production deployment to vercel',
      expectedEffect: 'Deploys to live production',
      dryRunSupported: true,
    };

    const evalResult = policy.evaluateAction(action);
    expect(evalResult.allowed).toBe(true);
    expect(evalResult.approvalType).toBe('typed-phrase');
    expect(evalResult.requiredConfirmationPhrase).toBe('Confirm production deployment to vercel');
  });
});
