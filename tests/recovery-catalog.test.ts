import { describe, it, expect } from 'vitest';
import { recoveryCatalog } from '../src/core/workflow/recovery-catalog';
import { DynamicPlannedStep } from '../src/types/task-planning';

describe('Phase 4B: Domain-Aware Recovery Catalog', () => {
  const baseStep: DynamicPlannedStep = {
    id: 'step-test-1',
    stepNumber: 1,
    title: 'Test Step',
    skillId: 'computer_control',
    action: 'click_element',
    params: { appName: 'Safari' },
    preconditions: {},
    expectedResult: 'Element clicked',
    verificationMethod: 'command_success',
    verificationCriteria: {},
    riskLevel: 'LOW',
    timeoutMs: 5000,
    retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: true },
  };

  describe('Browser Navigation & Timeout Failures', () => {
    it('diagnoses BROWSER_TIMEOUT on network or page load timeout in Safari', () => {
      const browserStep: DynamicPlannedStep = {
        ...baseStep,
        skillId: 'browser_skill',
        action: 'navigate',
        params: { url: 'https://example.com', browser: 'Safari' },
      };

      const diagnosis = recoveryCatalog.diagnose(
        browserStep,
        'Navigation failed: page load timed out after 8000ms',
        { targetApp: 'Safari' }
      );

      expect(diagnosis.rootCause).toBe('BROWSER_TIMEOUT');
      expect(diagnosis.recoveryStrategy).toBe('RELOAD_TAB');
      expect(diagnosis.suggestedSteps.length).toBe(2);

      const reloadStep = diagnosis.suggestedSteps[0];
      expect(reloadStep.skillId).toBe('browser_skill');
      expect(reloadStep.action).toBe('reload');
      expect(reloadStep.params.browser).toBe('Safari');
      expect(reloadStep.riskLevel).toBe('LOW');

      // Second step is the retried action
      expect(diagnosis.suggestedSteps[1].action).toBe('navigate');
    });

    it('diagnoses BROWSER_TIMEOUT for Chrome when navigation stalls', () => {
      const chromeStep: DynamicPlannedStep = {
        ...baseStep,
        skillId: 'browser_skill',
        action: 'fill_field',
        params: { browser: 'Google Chrome', target: 'input[name="q"]' },
      };

      const diagnosis = recoveryCatalog.diagnose(
        chromeStep,
        'Network error: connection timeout on active tab',
        { targetApp: 'Google Chrome' }
      );

      expect(diagnosis.rootCause).toBe('BROWSER_TIMEOUT');
      expect(diagnosis.recoveryStrategy).toBe('RELOAD_TAB');
      expect(diagnosis.suggestedSteps[0].params.browser).toBe('Google Chrome');
    });
  });

  describe('File Path Failures', () => {
    it('diagnoses FILE_NOT_FOUND and suggests Spotlight fallback search', () => {
      const fileStep: DynamicPlannedStep = {
        ...baseStep,
        skillId: 'files_skill',
        action: 'get_metadata',
        params: { path: '/Users/test/Downloads/Q3_Financial_Report.pdf' },
      };

      const diagnosis = recoveryCatalog.diagnose(
        fileStep,
        'Error: ENOENT no such file or directory /Users/test/Downloads/Q3_Financial_Report.pdf'
      );

      expect(diagnosis.rootCause).toBe('FILE_NOT_FOUND');
      expect(diagnosis.recoveryStrategy).toBe('MDFIND_FALLBACK');
      expect(diagnosis.suggestedSteps.length).toBe(2);

      const searchStep = diagnosis.suggestedSteps[0];
      expect(searchStep.skillId).toBe('files_skill');
      expect(searchStep.action).toBe('find_files');
      expect(searchStep.params.query).toBe('Q3_Financial_Report.pdf');
    });
  });

  describe('App Not Active & Window Minimized', () => {
    it('diagnoses APP_NOT_ACTIVE when target app is not frontmost', () => {
      const appStep: DynamicPlannedStep = {
        ...baseStep,
        params: { appName: 'TextEdit' },
      };

      const diagnosis = recoveryCatalog.diagnose(
        appStep,
        'Observed: Active App: Finder (Running: Finder, Terminal)',
        { targetApp: 'TextEdit' }
      );

      expect(diagnosis.rootCause).toBe('APP_NOT_ACTIVE');
      expect(diagnosis.recoveryStrategy).toBe('ACTIVATE_APP');
      expect(diagnosis.suggestedSteps[0].action).toBe('activate_app');
      expect(diagnosis.suggestedSteps[0].params.appName).toBe('TextEdit');
    });

    it('diagnoses WINDOW_MINIMIZED and issues restore step', () => {
      const diagnosis = recoveryCatalog.diagnose(
        baseStep,
        'Window state is minimized to Dock'
      );

      expect(diagnosis.rootCause).toBe('WINDOW_MINIMIZED');
      expect(diagnosis.recoveryStrategy).toBe('RESTORE_WINDOW');
      expect(diagnosis.suggestedSteps[0].action).toBe('zoom_window');
    });
  });

  describe('Element Selector Drift & Unresponsive Apps', () => {
    it('diagnoses ELEMENT_NOT_FOUND and suggests REFOCUS via keyboard shortcut', () => {
      const searchStep: DynamicPlannedStep = {
        ...baseStep,
        action: 'focus_search_field',
        params: { appName: 'Safari' },
      };

      const diagnosis = recoveryCatalog.diagnose(
        searchStep,
        'Cannot locate element: role TEXTFIELD not found in accessibility hierarchy',
        { targetApp: 'Safari' }
      );

      expect(diagnosis.rootCause).toBe('ELEMENT_NOT_FOUND');
      expect(diagnosis.recoveryStrategy).toBe('REFOCUS');
      expect(diagnosis.suggestedSteps[0].action).toBe('key_shortcut');
      expect(diagnosis.suggestedSteps[0].params.modifiers).toContain('cmd');
    });

    it('diagnoses RETRY_SCROLL when element is below fold', () => {
      const clickStep: DynamicPlannedStep = {
        ...baseStep,
        action: 'click_element',
        params: { appName: 'Safari' },
      };

      const diagnosis = recoveryCatalog.diagnose(
        clickStep,
        'Element selector target is below fold / requires scroll to become accessible',
        { targetApp: 'Safari' }
      );

      expect(diagnosis.rootCause).toBe('ELEMENT_NOT_FOUND');
      expect(diagnosis.recoveryStrategy).toBe('RETRY_SCROLL');
      expect(diagnosis.suggestedSteps[0].action).toBe('key_shortcut');
      expect(diagnosis.suggestedSteps[0].params.key).toBe('PageDown');
    });

    it('diagnoses APP_UNRESPONSIVE and generates reactivation step', () => {
      const docStep: DynamicPlannedStep = {
        ...baseStep,
        params: { appName: 'Pages' },
      };

      const diagnosis = recoveryCatalog.diagnose(
        docStep,
        'Application is not responding / beachball detected',
        { targetApp: 'Pages' }
      );

      expect(diagnosis.rootCause).toBe('APP_UNRESPONSIVE');
      expect(diagnosis.recoveryStrategy).toBe('RESTART_APP');
      expect(diagnosis.suggestedSteps[0].action).toBe('activate_app');
    });
  });

  describe('Security Boundaries & Fail Closed', () => {
    it('fails closed immediately without recovery on permission denied', () => {
      const diagnosis = recoveryCatalog.diagnose(
        baseStep,
        'Permission denied: access to protected location /System/Library is prohibited'
      );

      expect(diagnosis.rootCause).toBe('PERMISSION_DENIED');
      expect(diagnosis.recoveryStrategy).toBe('FAIL_CLOSED');
      expect(diagnosis.suggestedSteps.length).toBe(0);
    });

    it('fails closed on unknown or unclassifiable errors', () => {
      const diagnosis = recoveryCatalog.diagnose(
        baseStep,
        'Completely unexpected hardware failure: code 99999'
      );

      expect(diagnosis.rootCause).toBe('UNKNOWN');
      expect(diagnosis.recoveryStrategy).toBe('FAIL_CLOSED');
      expect(diagnosis.suggestedSteps.length).toBe(0);
    });

    it('strictly clamps recovery step risk to task overall risk', () => {
      const browserStep: DynamicPlannedStep = {
        ...baseStep,
        skillId: 'browser_skill',
        action: 'navigate',
        riskLevel: 'LOW',
      };

      const diagnosis = recoveryCatalog.diagnose(
        browserStep,
        'Navigation timed out',
        { targetApp: 'Safari', taskOverallRisk: 'LOW' }
      );

      for (const step of diagnosis.suggestedSteps) {
        expect(step.riskLevel).toBe('LOW');
      }
    });
  });
});
