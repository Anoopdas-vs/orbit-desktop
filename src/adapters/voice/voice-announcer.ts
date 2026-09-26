import { phoneticPreprocessor } from './phonetic-preprocessor';
import { speechSynthesisEngine } from './speech-synthesis';
import { WorkflowMilestoneEvent } from '../../types/workflow';

export interface AnnounceOptions {
  priority?: 'normal' | 'urgent';
  minThrottleMs?: number;
}

export class VoiceAnnouncer {
  private lastAnnounceTimestamp = 0;
  private defaultThrottleMs = 1500;
  private isEnabled = true;

  /**
   * Configure announcer state.
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Announce progress message aloud to user with throttling and phonetic cleaning.
   */
  public async announce(text: string, options: AnnounceOptions = {}): Promise<boolean> {
    if (!this.isEnabled || !text) return false;

    const now = Date.now();
    const throttle = options.minThrottleMs ?? this.defaultThrottleMs;

    // Normal priority messages obey the 1.5s throttling window
    if (options.priority !== 'urgent' && now - this.lastAnnounceTimestamp < throttle) {
      return false;
    }

    this.lastAnnounceTimestamp = now;

    // Phonetically clean and streamline the text
    const speechText = phoneticPreprocessor.cleanForSpeech(text);
    if (!speechText) return false;

    await speechSynthesisEngine.speak(speechText);
    return true;
  }

  /**
   * Announce key workflow milestone updates with phonetic cleaning and non-chattering throttle.
   */
  public async announceMilestone(event: WorkflowMilestoneEvent): Promise<boolean> {
    if (!this.isEnabled) return false;

    let message = '';
    let priority: 'normal' | 'urgent' = 'normal';

    switch (event.type) {
      case 'WORKFLOW_STARTED':
        message = `Starting workflow: ${event.goal}`;
        break;
      case 'STEP_STARTED':
        if (event.stepIndex && event.stepTitle) {
          message = `Step ${event.stepIndex}: ${event.stepTitle}`;
        }
        break;
      case 'STEP_COMPLETED':
        if (event.stepIndex) {
          message = `Step ${event.stepIndex} verified.`;
        }
        break;
      case 'AWAITING_APPROVAL':
        message = `Workflow paused: approval required for step ${event.stepIndex || ''}.`;
        priority = 'urgent';
        break;
      case 'RECOVERING':
        message = `Attempting automated recovery for step ${event.stepIndex || ''}.`;
        break;
      case 'WORKFLOW_COMPLETED':
        message = 'Workflow completed successfully.';
        break;
      case 'WORKFLOW_FAILED':
        message = `Workflow halted: ${event.error || 'Execution error'}`;
        priority = 'urgent';
        break;
      case 'WORKFLOW_ABORTED':
        message = 'Workflow aborted by emergency stop.';
        priority = 'urgent';
        break;
      default:
        return false;
    }

    return this.announce(message, { priority });
  }

  /**
   * Immediately stops any ongoing speech (barge-in).
   */
  public cancel(): void {
    speechSynthesisEngine.stop();
  }

  /**
   * Immediately stops speech and resets throttling for user barge-in.
   */
  public bargeIn(): void {
    this.cancel();
    this.lastAnnounceTimestamp = 0;
  }
}

export const voiceAnnouncer = new VoiceAnnouncer();
