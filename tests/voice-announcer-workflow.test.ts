import { describe, it, expect, beforeEach, vi } from 'vitest';
import { voiceAnnouncer } from '../src/adapters/voice/voice-announcer';
import { speechSynthesisEngine } from '../src/adapters/voice/speech-synthesis';
import { WorkflowMilestoneEvent } from '../src/types/workflow';

describe('Phase 4C: Spoken Workflow Announcer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    voiceAnnouncer.setEnabled(true);
    voiceAnnouncer.bargeIn(); // Reset throttler
  });

  it('speaks workflow start, step progression, and completion milestones', async () => {
    const speakSpy = vi.spyOn(speechSynthesisEngine, 'speak').mockResolvedValue();

    const startEvent: WorkflowMilestoneEvent = {
      type: 'WORKFLOW_STARTED',
      workflowId: 'wf-1',
      goal: 'Backup project directory',
      timestamp: new Date().toISOString(),
    };

    const spoke = await voiceAnnouncer.announceMilestone(startEvent);
    expect(spoke).toBe(true);
    expect(speakSpy).toHaveBeenCalledWith(expect.stringContaining('Starting workflow'));
  });

  it('throttles rapid successive normal priority announcements', async () => {
    const speakSpy = vi.spyOn(speechSynthesisEngine, 'speak').mockResolvedValue();

    const event1: WorkflowMilestoneEvent = {
      type: 'STEP_STARTED',
      workflowId: 'wf-1',
      goal: 'Test',
      stepIndex: 1,
      stepTitle: 'First step',
      timestamp: new Date().toISOString(),
    };

    const event2: WorkflowMilestoneEvent = {
      type: 'STEP_COMPLETED',
      workflowId: 'wf-1',
      goal: 'Test',
      stepIndex: 1,
      stepTitle: 'First step',
      timestamp: new Date().toISOString(),
    };

    const spoke1 = await voiceAnnouncer.announceMilestone(event1);
    expect(spoke1).toBe(true);

    // Immediate second announcement within default 1500ms window should be throttled
    const spoke2 = await voiceAnnouncer.announceMilestone(event2);
    expect(spoke2).toBe(false);
    expect(speakSpy).toHaveBeenCalledTimes(1);
  });

  it('allows urgent priority milestones (AWAITING_APPROVAL, FAILED, ABORTED) to bypass throttling', async () => {
    const speakSpy = vi.spyOn(speechSynthesisEngine, 'speak').mockResolvedValue();

    const normalEvent: WorkflowMilestoneEvent = {
      type: 'STEP_STARTED',
      workflowId: 'wf-1',
      goal: 'Test',
      stepIndex: 1,
      stepTitle: 'Step 1',
      timestamp: new Date().toISOString(),
    };

    const urgentEvent: WorkflowMilestoneEvent = {
      type: 'AWAITING_APPROVAL',
      workflowId: 'wf-1',
      goal: 'Test',
      stepIndex: 2,
      stepTitle: 'Critical payment',
      timestamp: new Date().toISOString(),
    };

    // First announcement
    await voiceAnnouncer.announceMilestone(normalEvent);

    // Urgent milestone fired immediately after
    const spokeUrgent = await voiceAnnouncer.announceMilestone(urgentEvent);
    expect(spokeUrgent).toBe(true);
    expect(speakSpy).toHaveBeenCalledTimes(2);
    expect(speakSpy).toHaveBeenLastCalledWith(expect.stringContaining('approval required'));
  });

  it('cancels speech immediately on user barge-in', () => {
    const stopSpy = vi.spyOn(speechSynthesisEngine, 'stop');

    voiceAnnouncer.bargeIn();

    expect(stopSpy).toHaveBeenCalled();
  });
});
