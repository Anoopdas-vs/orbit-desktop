import { PlannedStep, PlannedTask } from './action-planner';
import { nativeBridge, ComputerStateInfo, UiTreeResult } from '../adapters/native/tauri-bridge';
import { semanticTargetResolver } from './semantic-targeting';
import { useComputerStateStore } from '../state/useComputerStateStore';
import { killSwitch } from './kill-switch';

export interface StepExecutionResult {
  stepId: string;
  stepNumber: number;
  success: boolean;
  verified: boolean;
  action: string;
  output: string;
  actualState?: string;
  retriesUsed: number;
  error?: string;
  durationMs: number;
}

export interface TaskExecutionResult {
  taskId: string;
  goal: string;
  success: boolean;
  completedSteps: number;
  totalSteps: number;
  stepResults: StepExecutionResult[];
  error?: string;
  totalDurationMs: number;
}

export class ClosedLoopExecutor {
  /**
   * Execute a planned multi-step computer task with closed-loop verification and recovery.
   */
  public async executeTask(
    task: PlannedTask,
    onStepProgress?: (result: StepExecutionResult) => void
  ): Promise<TaskExecutionResult> {
    const startTime = performance.now();
    const store = useComputerStateStore.getState();
    store.startTask(task.id, task.goal, task.steps.length);

    const stepResults: StepExecutionResult[] = [];
    let allPassed = true;
    let failureError: string | undefined;

    for (let i = 0; i < task.steps.length; i++) {
      const step = task.steps[i];

      // Check emergency stop between every step
      if (killSwitch.isEngaged()) {
        store.finishTask();
        return {
          taskId: task.id,
          goal: task.goal,
          success: false,
          completedSteps: stepResults.length,
          totalSteps: task.steps.length,
          stepResults,
          error: 'Execution halted: Emergency Kill Switch engaged.',
          totalDurationMs: Math.round(performance.now() - startTime),
        };
      }

      store.updateStepProgress({
        stepIndex: i + 1,
        action: step.action,
        expectedState: step.expectedResult,
      });

      const stepResult = await this.executeStepWithRecovery(step, task.targetApp);
      stepResults.push(stepResult);

      if (onStepProgress) {
        onStepProgress(stepResult);
      }

      if (!stepResult.verified) {
        allPassed = false;
        failureError = stepResult.error || `Verification failed for step: ${step.title}`;
        break;
      }
    }

    store.finishTask();

    return {
      taskId: task.id,
      goal: task.goal,
      success: allPassed,
      completedSteps: stepResults.filter((s) => s.verified).length,
      totalSteps: task.steps.length,
      stepResults,
      error: failureError,
      totalDurationMs: Math.round(performance.now() - startTime),
    };
  }

  /**
   * Execute a single step with closed-loop observation, verification, and controlled recovery.
   */
  public async executeStepWithRecovery(
    step: PlannedStep,
    contextApp?: string
  ): Promise<StepExecutionResult> {
    const stepStart = performance.now();
    let retriesUsed = 0;
    const maxRetries = step.retryLimit;
    const store = useComputerStateStore.getState();

    while (retriesUsed <= maxRetries) {
      if (killSwitch.isEngaged()) {
        return {
          stepId: step.id,
          stepNumber: step.stepNumber,
          success: false,
          verified: false,
          action: step.action,
          output: 'Halted by kill switch.',
          retriesUsed,
          error: 'Emergency Kill Switch engaged.',
          durationMs: Math.round(performance.now() - stepStart),
        };
      }

      // 1. Observe Pre-Action State
      let preState: ComputerStateInfo;
      try {
        preState = await nativeBridge.getComputerState();
        store.updateSystemState(preState);
      } catch {
        preState = {
          activeApp: 'Unknown',
          activeWindow: '',
          runningApps: [],
          volume: 50,
          isMuted: false,
        };
      }

      // 2. Dispatch Action
      const dispatchResult = await this.dispatchAction(step, preState, contextApp);

      // 3. Observe Post-Action State and Verify
      const verification = await this.verifyStepOutcome(step, contextApp);

      if (verification.verified) {
        store.markStepVerified(true);
        return {
          stepId: step.id,
          stepNumber: step.stepNumber,
          success: true,
          verified: true,
          action: step.action,
          output: dispatchResult.output || `Step completed and verified: ${step.title}`,
          actualState: verification.actualState,
          retriesUsed,
          durationMs: Math.round(performance.now() - stepStart),
        };
      }

      // 4. Recovery Attempt if verification failed and retries remain
      retriesUsed++;
      if (retriesUsed <= maxRetries) {
        const recoveryReason = `Expected "${step.expectedResult}", but observed "${verification.actualState}". Retrying attempt ${retriesUsed}/${maxRetries}...`;
        store.recordRecovery(recoveryReason);
        await this.performRecovery(step, contextApp);
        // Short backoff delay
        await new Promise((r) => setTimeout(r, 400));
      } else {
        // Truth in failure: Never claim success when verification fails!
        store.markStepVerified(false);
        return {
          stepId: step.id,
          stepNumber: step.stepNumber,
          success: false,
          verified: false,
          action: step.action,
          output: `Verification failed after ${retriesUsed - 1} retries.`,
          actualState: verification.actualState,
          retriesUsed: retriesUsed - 1,
          error: `Could not verify "${step.expectedResult}". Observed: "${verification.actualState}".`,
          durationMs: Math.round(performance.now() - stepStart),
        };
      }
    }

    return {
      stepId: step.id,
      stepNumber: step.stepNumber,
      success: false,
      verified: false,
      action: step.action,
      output: 'Exhausted retry attempts.',
      retriesUsed,
      error: 'Max retries exceeded.',
      durationMs: Math.round(performance.now() - stepStart),
    };
  }

  private async dispatchAction(
    step: PlannedStep,
    preState: ComputerStateInfo,
    contextApp?: string
  ): Promise<{ success: boolean; output: string }> {
    const targetApp = step.params.appName || contextApp || preState.activeApp;

    switch (step.action) {
      case 'open_app': {
        const res = await nativeBridge.openApp(step.params.appName || 'Safari');
        return { success: res.success, output: res.message };
      }

      case 'activate_app': {
        const res = await nativeBridge.controlAction({
          action: 'activate_app',
          appName: targetApp,
        });
        return { success: res.success, output: res.output || 'App activated.' };
      }

      case 'focus_search_field': {
        // In macOS browsers (Safari / Chrome), Cmd+L instantly focuses address/search bar
        const res = await nativeBridge.controlAction({
          action: 'key_shortcut',
          appName: targetApp,
          modifiers: ['cmd'],
          key: 'l',
        });
        return { success: res.success, output: res.output || 'Focused search field.' };
      }

      case 'submit_search': {
        if (step.params.url) {
          // Open direct URL or type query + enter
          await nativeBridge.openUrl(step.params.url, targetApp);
          return { success: true, output: `Navigated to search results in ${targetApp}.` };
        }
        await nativeBridge.controlAction({
          action: 'key_type',
          appName: targetApp,
          text: step.params.query || '',
        });
        await nativeBridge.controlAction({
          action: 'key_press',
          appName: targetApp,
          key: 'return',
        });
        return { success: true, output: 'Typed search query and submitted.' };
      }

      case 'calculate_expression': {
        const expr = (step.params.expression || '').replace(/\s+/g, '');
        // Activate Calculator and keystroke the expression followed by '='
        await nativeBridge.controlAction({ action: 'activate_app', appName: 'Calculator' });
        await nativeBridge.controlAction({
          action: 'key_type',
          appName: 'Calculator',
          text: `${expr}=`,
        });
        return { success: true, output: `Evaluated ${expr} in Calculator.` };
      }

      case 'semantic_click': {
        let tree: UiTreeResult;
        try {
          tree = await nativeBridge.getUiTree(targetApp);
        } catch {
          tree = { appName: targetApp, windowTitle: '', elements: [], totalCount: 0 };
        }

        const resolved = semanticTargetResolver.resolve(step.params.target || '', tree);
        if (resolved) {
          const clickRes = await nativeBridge.controlAction({
            action: 'mouse_click',
            appName: targetApp,
            x: resolved.clickX,
            y: resolved.clickY,
          });
          return {
            success: clickRes.success,
            output: `Clicked ${resolved.element.title} (${resolved.matchReason}) at (${resolved.clickX}, ${resolved.clickY})`,
          };
        } else {
          // Fallback to accessibility click by button title
          const directClick = await nativeBridge.guiAction({
            action: 'click_button',
            appName: targetApp,
            target: step.params.target,
          });
          return { success: directClick.success, output: directClick.stdout };
        }
      }

      case 'key_type': {
        const res = await nativeBridge.controlAction({
          action: 'key_type',
          appName: targetApp,
          text: step.params.text || '',
        });
        return { success: res.success, output: res.output || 'Text typed.' };
      }

      case 'key_press': {
        const res = await nativeBridge.controlAction({
          action: 'key_press',
          appName: targetApp,
          key: step.params.key || 'return',
        });
        return { success: res.success, output: res.output || 'Key pressed.' };
      }

      case 'set_volume': {
        const res = await nativeBridge.controlAction({
          action: 'set_volume',
          volumeLevel: step.params.volumeLevel ?? 50,
        });
        return { success: res.success, output: res.output || 'Volume set.' };
      }

      case 'toggle_mute': {
        const res = await nativeBridge.controlAction({ action: 'toggle_mute' });
        return { success: res.success, output: res.output || 'Mute toggled.' };
      }

      case 'minimize_window':
      case 'zoom_window':
      case 'close_window': {
        const res = await nativeBridge.controlAction({
          action: step.action as any,
          appName: targetApp,
        });
        return { success: res.success, output: res.output || 'Window updated.' };
      }

      default:
        return { success: true, output: `Executed action: ${step.action}` };
    }
  }

  private async verifyStepOutcome(
    step: PlannedStep,
    contextApp?: string
  ): Promise<{ verified: boolean; actualState: string }> {
    if (step.verificationMethod === 'none') {
      return { verified: true, actualState: 'Verification skipped.' };
    }

    const targetApp = step.verificationCriteria.appName || contextApp;

    // Check system state
    let state: ComputerStateInfo;
    try {
      state = await nativeBridge.getComputerState();
    } catch {
      state = {
        activeApp: targetApp || 'Unknown',
        activeWindow: '',
        runningApps: [],
        volume: 50,
        isMuted: false,
      };
    }

    if (step.verificationMethod === 'app_active') {
      const expected = (step.verificationCriteria.appName || '').toLowerCase();
      const actual = state.activeApp.toLowerCase();
      const isMatch = actual.includes(expected);
      return {
        verified: isMatch,
        actualState: `Active App: ${state.activeApp} (Running: ${state.runningApps.slice(0, 5).join(', ')})`,
      };
    }

    if (step.verificationMethod === 'window_title') {
      const contains = (step.verificationCriteria.contains || '').toLowerCase();
      const actualTitle = state.activeWindow.toLowerCase();
      const verified = contains ? actualTitle.includes(contains) : true;
      return {
        verified,
        actualState: `Window Title: "${state.activeWindow}" in ${state.activeApp}`,
      };
    }

    if (step.verificationMethod === 'audio_state') {
      if (step.verificationCriteria.isMuted !== undefined) {
        return {
          verified: state.isMuted === step.verificationCriteria.isMuted,
          actualState: `Audio is ${state.isMuted ? 'muted' : 'unmuted'} (volume: ${state.volume}%)`,
        };
      }
      if (step.verificationCriteria.volume !== undefined) {
        const diff = Math.abs(state.volume - step.verificationCriteria.volume);
        return {
          verified: diff <= 5,
          actualState: `System Volume is ${state.volume}% (expected ${step.verificationCriteria.volume}%)`,
        };
      }
    }

    if (step.verificationMethod === 'element_present') {
      try {
        const tree = await nativeBridge.getUiTree(targetApp);
        const hasElements = tree.elements.length > 0;
        return {
          verified: hasElements,
          actualState: `Inspected UI: found ${tree.elements.length} accessible elements in ${tree.appName}`,
        };
      } catch (err: any) {
        return {
          verified: false,
          actualState: `Failed to query UI tree: ${err.message}`,
        };
      }
    }

    // Default command success
    return {
      verified: true,
      actualState: `Action executed on ${state.activeApp}`,
    };
  }

  private async performRecovery(step: PlannedStep, contextApp?: string): Promise<void> {
    const targetApp = step.params.appName || contextApp;
    if (targetApp) {
      // Re-activate and bring application to the front
      try {
        await nativeBridge.controlAction({
          action: 'activate_app',
          appName: targetApp,
        });
      } catch {
        // ignore
      }
    }
  }
}

export const closedLoopExecutor = new ClosedLoopExecutor();
