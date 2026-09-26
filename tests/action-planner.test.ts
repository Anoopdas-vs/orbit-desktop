import { describe, it, expect } from 'vitest';
import { actionPlanner } from '../src/core/action-planner';

describe('Phase 2E: Action Planner (Multi-Step Task Decomposition & Multilingual)', () => {
  it('decomposes browser search goal into sequential verified steps (English)', () => {
    const task = actionPlanner.plan('Open Safari and search for Oksy Healthcare');
    expect(task).not.toBeNull();
    expect(task?.targetApp).toBe('Safari');
    expect(task?.steps.length).toBe(3);

    expect(task?.steps[0].action).toBe('open_app');
    expect(task?.steps[0].verificationMethod).toBe('app_active');

    expect(task?.steps[1].action).toBe('focus_search_field');
    expect(task?.steps[1].verificationMethod).toBe('element_present');

    expect(task?.steps[2].action).toBe('submit_search');
    expect(task?.steps[2].params.query).toBe('Oksy Healthcare');
    expect(task?.steps[2].verificationMethod).toBe('window_title');
  });

  it('decomposes browser search goal in Malayalam without failing', () => {
    const task = actionPlanner.plan('Safari തുറന്ന് Google ൽ Oksy Healthcare search ചെയ്യൂ');
    expect(task).not.toBeNull();
    expect(task?.language).toBe('ml');
    expect(task?.targetApp).toBe('Safari');
    expect(task?.steps.length).toBe(3);
    expect(task?.steps[2].params.query).toBe('Oksy Healthcare');
  });

  it('decomposes browser search goal in Manglish (Malayalam-English mixed)', () => {
    const task = actionPlanner.plan('Safari open cheythitu Oksy Healthcare search cheyyu');
    expect(task).not.toBeNull();
    expect(task?.language).toBe('manglish');
    expect(task?.targetApp).toBe('Safari');
    expect(task?.steps.length).toBe(3);
  });

  it('decomposes Calculator arithmetic into structured calculation steps', () => {
    const task = actionPlanner.plan('Open Calculator and calculate 125 * 48');
    expect(task).not.toBeNull();
    expect(task?.targetApp).toBe('Calculator');
    expect(task?.steps.length).toBe(2);

    expect(task?.steps[0].action).toBe('open_app');
    expect(task?.steps[1].action).toBe('calculate_expression');
    expect(task?.steps[1].params.expression).toBe('125 * 48');
  });

  it('decomposes text editor typing goals in English, Manglish, and Malayalam', () => {
    const taskEn = actionPlanner.plan('Open TextEdit and type this message: Meeting at 3pm');
    expect(taskEn).not.toBeNull();
    expect(taskEn?.targetApp).toBe('TextEdit');
    expect(taskEn?.steps.length).toBe(2);
    expect(taskEn?.steps[1].action).toBe('key_type');
    expect(taskEn?.steps[1].params.text).toBe('Meeting at 3pm');

    const taskManglish = actionPlanner.plan('TextEdit open cheythu meeting note type cheyyu');
    expect(taskManglish).not.toBeNull();
    expect(taskManglish?.language).toBe('manglish');
    expect(taskManglish?.steps[1].params.text).toBe('meeting note');

    const taskMl = actionPlanner.plan('TextEdit തുറന്ന് meeting note type ചെയ്യൂ');
    expect(taskMl).not.toBeNull();
    expect(taskMl?.language).toBe('ml');
    expect(taskMl?.steps[1].params.text).toBe('meeting note');
  });

  it('plans system audio volume and mute adjustments', () => {
    const volPlan = actionPlanner.plan('Set volume to 40');
    expect(volPlan).not.toBeNull();
    expect(volPlan?.steps[0].action).toBe('set_volume');
    expect(volPlan?.steps[0].params.volumeLevel).toBe(40);
    expect(volPlan?.steps[0].verificationMethod).toBe('audio_state');

    const mutePlan = actionPlanner.plan('Mute volume');
    expect(mutePlan).not.toBeNull();
    expect(mutePlan?.steps[0].action).toBe('toggle_mute');
    expect(mutePlan?.steps[0].verificationMethod).toBe('audio_state');
  });

  it('plans window manipulation actions', () => {
    const minPlan = actionPlanner.plan('Minimize window');
    expect(minPlan).not.toBeNull();
    expect(minPlan?.steps[0].action).toBe('minimize_window');
  });

  it('converts planned task steps into valid ActionItem schema structures', () => {
    const task = actionPlanner.plan('Open Safari and search for hospitals in Kerala');
    expect(task).not.toBeNull();
    const actionItems = actionPlanner.toActionItems(task!);
    expect(actionItems.length).toBe(3);
    expect(actionItems[0].skillId).toBe('computer_control');
    expect(actionItems[0].status).toBe('PENDING_APPROVAL');
    expect(actionItems[0].dryRunSupported).toBe(true);
  });
});
