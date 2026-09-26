import {
  DynamicPlannedStep,
  FailureDiagnosis,
} from '../../types/task-planning';
import { RiskLevel } from '../../types/action-plan';

export interface DiagnosisContext {
  targetApp?: string;
  activeApp?: string;
  taskOverallRisk?: RiskLevel;
}

export class RecoveryCatalog {
  /**
   * Diagnoses execution and verification failures against observed domain states.
   * Produces a structured FailureDiagnosis with remediation steps or a strict FAIL_CLOSED directive.
   */
  public diagnose(
    failedStep: DynamicPlannedStep,
    observedState: string,
    context: DiagnosisContext = {}
  ): FailureDiagnosis {
    const lowerObserved = (observedState || '').toLowerCase();
    const app = context.targetApp || failedStep.params?.appName || context.activeApp;
    const taskRisk = context.taskOverallRisk || failedStep.riskLevel;

    // Security & Permission Violation: Strict immediate fail-closed
    if (
      lowerObserved.includes('permission denied') ||
      lowerObserved.includes('forbidden') ||
      lowerObserved.includes('protected location') ||
      lowerObserved.includes('security policy') ||
      lowerObserved.includes('kill switch')
    ) {
      return {
        failedStepId: failedStep.id,
        action: failedStep.action,
        expectedState: failedStep.expectedResult,
        observedState,
        rootCause: 'PERMISSION_DENIED',
        recoveryStrategy: 'FAIL_CLOSED',
        suggestedSteps: [],
      };
    }

    // 1. Window Minimized or Hidden
    if (lowerObserved.includes('minimized') || lowerObserved.includes('hidden')) {
      const zoomStep: DynamicPlannedStep = {
        id: crypto.randomUUID(),
        stepNumber: failedStep.stepNumber,
        title: `Restore Window for ${app || 'Active App'}`,
        skillId: 'computer_control',
        action: 'zoom_window',
        target: app,
        params: { appName: app },
        preconditions: {},
        expectedResult: 'Window restored and visible',
        verificationMethod: 'command_success',
        verificationCriteria: {},
        riskLevel: this.clampRisk('LOW', taskRisk),
        timeoutMs: 4000,
        retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: false },
      };

      return {
        failedStepId: failedStep.id,
        action: failedStep.action,
        expectedState: failedStep.expectedResult,
        observedState,
        rootCause: 'WINDOW_MINIMIZED',
        recoveryStrategy: 'RESTORE_WINDOW',
        suggestedSteps: [zoomStep, { ...failedStep }],
      };
    }

    // 2. Application Unresponsive / Hang
    if (
      lowerObserved.includes('unresponsive') ||
      lowerObserved.includes('frozen') ||
      lowerObserved.includes('not responding') ||
      lowerObserved.includes('beachball')
    ) {
      const restartStep: DynamicPlannedStep = {
        id: crypto.randomUUID(),
        stepNumber: failedStep.stepNumber,
        title: `Re-activate unresponsive application ${app || 'Active App'}`,
        skillId: 'computer_control',
        action: 'activate_app',
        params: { appName: app },
        preconditions: {},
        expectedResult: `${app} restored to responding state`,
        verificationMethod: 'command_success',
        verificationCriteria: {},
        riskLevel: this.clampRisk('LOW', taskRisk),
        timeoutMs: 6000,
        retryPolicy: { maxRetries: 1, backoffMs: 500, allowReplanOnExhaustion: false },
      };

      return {
        failedStepId: failedStep.id,
        action: failedStep.action,
        expectedState: failedStep.expectedResult,
        observedState,
        rootCause: 'APP_UNRESPONSIVE',
        recoveryStrategy: 'RESTART_APP',
        suggestedSteps: [restartStep, { ...failedStep }],
      };
    }

    // 3. Browser Navigation / Page Timeout
    const isBrowserContext =
      failedStep.skillId === 'browser_skill' ||
      ['Safari', 'Google Chrome'].includes(app || '') ||
      ['navigate', 'reload', 'open_tab', 'switch_tab', 'fill_field', 'click_link'].includes(
        failedStep.action
      );

    if (
      isBrowserContext &&
      (lowerObserved.includes('timeout') ||
        lowerObserved.includes('timed out') ||
        lowerObserved.includes('network') ||
        lowerObserved.includes('slow') ||
        lowerObserved.includes('navigation failed') ||
        lowerObserved.includes('page not loaded'))
    ) {
      const browserApp = app === 'Google Chrome' ? 'Google Chrome' : 'Safari';
      const reloadStep: DynamicPlannedStep = {
        id: crypto.randomUUID(),
        stepNumber: failedStep.stepNumber,
        title: `Reload tab in ${browserApp}`,
        skillId: 'browser_skill',
        action: 'reload',
        params: { browser: browserApp },
        preconditions: { requiredActiveApp: browserApp },
        expectedResult: `${browserApp} page reloaded`,
        verificationMethod: 'command_success',
        verificationCriteria: {},
        riskLevel: this.clampRisk('LOW', taskRisk),
        timeoutMs: 6000,
        retryPolicy: { maxRetries: 1, backoffMs: 400, allowReplanOnExhaustion: false },
      };

      return {
        failedStepId: failedStep.id,
        action: failedStep.action,
        expectedState: failedStep.expectedResult,
        observedState,
        rootCause: 'BROWSER_TIMEOUT',
        recoveryStrategy: 'RELOAD_TAB',
        suggestedSteps: [reloadStep, { ...failedStep }],
      };
    }

    // 4. File Path Not Found Failure
    const isFileContext =
      failedStep.skillId === 'files_skill' ||
      failedStep.skillId === 'document_skill' ||
      typeof failedStep.params?.path === 'string';

    if (
      isFileContext &&
      (lowerObserved.includes('not found') ||
        lowerObserved.includes('no such file') ||
        lowerObserved.includes('does not exist') ||
        lowerObserved.includes('enoent') ||
        lowerObserved.includes('cannot find file'))
    ) {
      const originalPath = failedStep.params?.path || failedStep.params?.query || 'file';
      const pathParts = originalPath.split(/[\/\\]/);
      const filename = pathParts[pathParts.length - 1] || originalPath;

      const mdfindStep: DynamicPlannedStep = {
        id: crypto.randomUUID(),
        stepNumber: failedStep.stepNumber,
        title: `Locate "${filename}" via Spotlight`,
        skillId: 'files_skill',
        action: 'find_files',
        params: { query: filename },
        preconditions: {},
        expectedResult: `Search results for ${filename}`,
        verificationMethod: 'command_success',
        verificationCriteria: {},
        riskLevel: this.clampRisk('LOW', taskRisk),
        timeoutMs: 4000,
        retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: false },
      };

      return {
        failedStepId: failedStep.id,
        action: failedStep.action,
        expectedState: failedStep.expectedResult,
        observedState,
        rootCause: 'FILE_NOT_FOUND',
        recoveryStrategy: 'MDFIND_FALLBACK',
        suggestedSteps: [mdfindStep, { ...failedStep }],
      };
    }

    // 5. App Not Active / Focused
    if (
      app &&
      (lowerObserved.includes('not active') ||
        lowerObserved.includes('not frontmost') ||
        lowerObserved.includes('inactive') ||
        (lowerObserved.includes('active app') && !lowerObserved.includes(app.toLowerCase())))
    ) {
      const activateStep: DynamicPlannedStep = {
        id: crypto.randomUUID(),
        stepNumber: failedStep.stepNumber,
        title: `Activate ${app}`,
        skillId: 'computer_control',
        action: 'activate_app',
        target: app,
        params: { appName: app },
        preconditions: {},
        expectedResult: `${app} is frontmost`,
        verificationMethod: 'app_active',
        verificationCriteria: { appName: app },
        riskLevel: this.clampRisk('LOW', taskRisk),
        timeoutMs: 5000,
        retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: false },
      };

      return {
        failedStepId: failedStep.id,
        action: failedStep.action,
        expectedState: failedStep.expectedResult,
        observedState,
        rootCause: 'APP_NOT_ACTIVE',
        recoveryStrategy: 'ACTIVATE_APP',
        suggestedSteps: [activateStep, { ...failedStep }],
      };
    }

    // 6. Element Not Found / Selector Drift / Focus Lost
    const isElementError =
      lowerObserved.includes('element') ||
      lowerObserved.includes('selector') ||
      lowerObserved.includes('cannot locate') ||
      lowerObserved.includes('not focused') ||
      lowerObserved.includes('textfield') ||
      lowerObserved.includes('below fold');

    const isElementAction =
      failedStep.verificationMethod === 'element_present' ||
      failedStep.verificationMethod === 'element_value' ||
      ['focus_search_field', 'submit_search'].includes(failedStep.action);

    if (isElementError || isElementAction) {
      if (lowerObserved.includes('scroll') || lowerObserved.includes('below fold')) {
        const scrollStep: DynamicPlannedStep = {
          id: crypto.randomUUID(),
          stepNumber: failedStep.stepNumber,
          title: `Scroll down in ${app || 'active window'} to reveal target`,
          skillId: 'computer_control',
          action: 'key_shortcut',
          target: app,
          params: { appName: app, key: 'PageDown' },
          preconditions: {},
          expectedResult: 'Scrolled down view',
          verificationMethod: 'command_success',
          verificationCriteria: {},
          riskLevel: this.clampRisk('LOW', taskRisk),
          timeoutMs: 3000,
          retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: false },
        };

        return {
          failedStepId: failedStep.id,
          action: failedStep.action,
          expectedState: failedStep.expectedResult,
          observedState,
          rootCause: 'ELEMENT_NOT_FOUND',
          recoveryStrategy: 'RETRY_SCROLL',
          suggestedSteps: [scrollStep, { ...failedStep }],
        };
      }

      const refocusStep: DynamicPlannedStep = {
        id: crypto.randomUUID(),
        stepNumber: failedStep.stepNumber,
        title: `Re-focus search via shortcut in ${app || 'application'}`,
        skillId: 'computer_control',
        action: 'key_shortcut',
        target: 'search bar',
        params: { appName: app, modifiers: ['cmd'], key: 'l' },
        preconditions: {},
        expectedResult: 'Element focused',
        verificationMethod: 'command_success',
        verificationCriteria: {},
        riskLevel: this.clampRisk('LOW', taskRisk),
        timeoutMs: 3000,
        retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: false },
      };

      return {
        failedStepId: failedStep.id,
        action: failedStep.action,
        expectedState: failedStep.expectedResult,
        observedState,
        rootCause: 'ELEMENT_NOT_FOUND',
        recoveryStrategy: 'REFOCUS',
        suggestedSteps: [refocusStep, { ...failedStep }],
      };
    }

    // Default: Fail closed
    return {
      failedStepId: failedStep.id,
      action: failedStep.action,
      expectedState: failedStep.expectedResult,
      observedState,
      rootCause: 'UNKNOWN',
      recoveryStrategy: 'FAIL_CLOSED',
      suggestedSteps: [],
    };
  }

  /**
   * Helper to ensure recovery steps never exceed the approved risk level.
   */
  private clampRisk(desiredRisk: RiskLevel, maxAllowed: RiskLevel): RiskLevel {
    const riskRank: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    return riskRank[desiredRisk] <= riskRank[maxAllowed] ? desiredRisk : maxAllowed;
  }
}

export const recoveryCatalog = new RecoveryCatalog();
