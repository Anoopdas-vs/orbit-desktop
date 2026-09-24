import { describe, it, expect, beforeEach } from 'vitest';
import { conversationalContext } from '../src/core/conversational-context';
import { commandRouter } from '../src/core/router';

describe('Multi-Turn Conversational Context & Fallback Dialogues', () => {
  beforeEach(() => {
    conversationalContext.clearPendingProposal();
  });

  it('detects affirmative user responses', () => {
    const affirmatives = ['yes', 'yeah', 'sure', 'ok', 'yep', 'open in chrome', 'open via chrome', 'play it', 'please'];
    for (const word of affirmatives) {
      expect(conversationalContext.isAffirmative(word)).toBe(true);
    }
  });

  it('detects negative user responses', () => {
    const negatives = ['no', 'nope', 'cancel', 'don\'t', 'never mind'];
    for (const word of negatives) {
      expect(conversationalContext.isNegative(word)).toBe(true);
    }
  });

  it('executes the full YouTube app absent -> Chrome fallback conversational flow', async () => {
    // 1. Initial request: "janki open youtube and play some music"
    const initialPlan = await commandRouter.route('janki open youtube and play some music', {
      registeredProjects: [],
    });

    expect(initialPlan.actions.length).toBe(1);
    expect(initialPlan.actions[0].skillId).toBe('youtube_launcher');
    expect(initialPlan.actions[0].params.query).toBe('some music');

    // 2. Simulate youtube_launcher detecting native app missing and asking question
    conversationalContext.setPendingProposal({
      type: 'OPEN_YOUTUBE_CHROME',
      question: 'The YouTube desktop app is not installed on your Mac. Would you like me to open it in Google Chrome and play music?',
      targetUrl: 'https://www.youtube.com/results?search_query=relaxing+music',
      appName: 'Google Chrome',
      musicQuery: 'some music',
      onConfirmTitle: 'Open YouTube in Google Chrome',
      onConfirmDescription: 'Open in Chrome',
      params: { query: 'some music', forceBrowser: true },
    });

    expect(conversationalContext.hasPendingProposal()).toBe(true);

    // 3. User says "yes"
    const followUpPlan = await commandRouter.route('yes', { registeredProjects: [] });

    expect(followUpPlan.interpretedIntent).toContain('Open YouTube in Google Chrome (Confirmed)');
    expect(followUpPlan.actions.length).toBe(1);
    expect(followUpPlan.actions[0].skillId).toBe('youtube_launcher');
    expect(followUpPlan.actions[0].params.forceBrowser).toBe(true);
    expect(followUpPlan.actions[0].params.browser).toBe('Google Chrome');
    expect(conversationalContext.hasPendingProposal()).toBe(false);
  });

  it('handles negative user response by cancelling proposal', async () => {
    conversationalContext.setPendingProposal({
      type: 'OPEN_YOUTUBE_CHROME',
      question: 'Open in Chrome?',
      onConfirmTitle: 'Open in Chrome',
      onConfirmDescription: '',
      params: {},
    });

    const followUpPlan = await commandRouter.route('no', { registeredProjects: [] });
    expect(followUpPlan.interpretedIntent).toBe('Fallback Cancelled');
    expect(conversationalContext.hasPendingProposal()).toBe(false);
  });

  it('handles user specifying or changing song during active proposal', async () => {
    conversationalContext.setPendingProposal({
      type: 'OPEN_YOUTUBE_CHROME',
      question: 'Would you like to open Chrome for music?',
      targetUrl: 'https://www.youtube.com/results?search_query=music',
      appName: 'Google Chrome',
      musicQuery: 'some music',
      onConfirmTitle: 'Open in Chrome',
      onConfirmDescription: '',
      params: {},
    });

    // User asks for another song instead
    const updatePlan = await commandRouter.route('play Bohemian Rhapsody', { registeredProjects: [] });
    expect(updatePlan.interpretedIntent).toContain('Bohemian Rhapsody');
    expect(updatePlan.actions[0].params.query).toBe('Bohemian Rhapsody');

    const updatedProposal = conversationalContext.getPendingProposal();
    expect(updatedProposal?.musicQuery).toBe('Bohemian Rhapsody');

    // Then user confirms
    const followUp = await commandRouter.route('yes', { registeredProjects: [] });
    expect(followUp.actions[0].params.query).toBe('Bohemian Rhapsody');
  });
});
