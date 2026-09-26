import { describe, it, expect, beforeEach } from 'vitest';
import { contextualIntentResolver } from '../src/core/contextual-intent-resolver';
import { taskContextManager } from '../src/context/task-context-manager';
import { multilingualNLP } from '../src/core/multilingual-nlp';
import { commandRouter } from '../src/core/router';

describe('Phase 3 Stage 2: Multilingual NLP & Contextual Intent Resolver', () => {
  beforeEach(() => {
    taskContextManager.resetTask();
  });

  describe('Multilingual NLP', () => {
    it('detects English commands accurately', () => {
      expect(multilingualNLP.detectLanguage('Open Safari and search for healthcare')).toBe('en');
    });

    it('detects pure Malayalam script', () => {
      expect(multilingualNLP.detectLanguage('സഫാരി തുറന്ന് തിരയൂ')).toBe('ml');
    });

    it('detects Manglish (Malayalam written in Latin script)', () => {
      expect(multilingualNLP.detectLanguage('Safari open cheythu Oksy Healthcare search cheyyu')).toBe('manglish');
      expect(multilingualNLP.detectLanguage('Calculator thurannu kanakkaakku')).toBe('manglish');
    });

    it('detects Mixed language inputs', () => {
      expect(multilingualNLP.detectLanguage('Safari തുറന്ന് Google ൽ search ചെയ്യൂ')).toBe('mixed');
    });

    it('identifies follow-up linguistic markers', () => {
      expect(multilingualNLP.isFollowUpCommand('Now search for Oksy Healthcare')).toBe(true);
      expect(multilingualNLP.isFollowUpCommand('Open the first result')).toBe(true);
      expect(multilingualNLP.isFollowUpCommand('Go back')).toBe(true);
      expect(multilingualNLP.isFollowUpCommand('Veendum cheyyu')).toBe(true);
      expect(multilingualNLP.isFollowUpCommand('ആദ്യത്തെ ലിങ്ക്')).toBe(true);
      expect(multilingualNLP.isFollowUpCommand('Start the dev server')).toBe(false);
    });
  });

  describe('Contextual Intent Resolver', () => {
    it('resolves contextual follow-up search without repeating target application', () => {
      // Step 1: User opens Safari
      taskContextManager.startTask('Open Safari', 'Safari');
      taskContextManager.setActiveApp('Safari');

      // Step 2: Follow-up command: "Now search for Oksy Healthcare"
      const resolved = contextualIntentResolver.resolve('Now search for Oksy Healthcare');
      expect(resolved.isContextual).toBe(true);
      expect(resolved.resolvedApp).toBe('Safari');
      expect(resolved.canonicalPrompt).toContain('Search Safari for "Oksy Healthcare"');
      expect(resolved.actionType).toBe('contextual_search');
    });

    it('resolves relative "first result" to active browser', () => {
      taskContextManager.startTask('Browse Web', 'Google Chrome');
      taskContextManager.setActiveApp('Google Chrome');

      const resolved = contextualIntentResolver.resolve('Open the first result');
      expect(resolved.isContextual).toBe(true);
      expect(resolved.resolvedApp).toBe('Google Chrome');
      expect(resolved.canonicalPrompt).toBe('Click first result link in Google Chrome');
      expect(resolved.actionType).toBe('click_result');
    });

    it('resolves "go back" navigation to active browser', () => {
      taskContextManager.startTask('Search session', 'Safari');
      taskContextManager.setActiveApp('Safari');

      const resolved = contextualIntentResolver.resolve('Go back');
      expect(resolved.isContextual).toBe(true);
      expect(resolved.resolvedApp).toBe('Safari');
      expect(resolved.canonicalPrompt).toBe('Navigate back in Safari');
      expect(resolved.actionType).toBe('browser_back');
    });

    it('resolves repetition command "Do the same thing again"', () => {
      taskContextManager.startTask('Initial task', 'Calculator');
      taskContextManager.recordTurn({
        userPrompt: 'Calculate 125 * 48',
        interpretedIntent: 'Calculate 125 * 48 in Calculator',
        activeApp: 'Calculator',
      });

      const resolved = contextualIntentResolver.resolve('Do the same thing again');
      expect(resolved.isContextual).toBe(true);
      expect(resolved.canonicalPrompt).toBe('Calculate 125 * 48');
      expect(resolved.actionType).toBe('repeat_last_turn');
    });

    it('executes continuous 4-turn conversational sequence through CommandRouter', async () => {
      const routerContext = { registeredProjects: [] };

      // Turn 1: "Open Safari"
      const plan1 = await commandRouter.route('Open Safari', routerContext);
      expect(plan1.actions.length).toBeGreaterThan(0);
      expect(taskContextManager.getActiveApp()).toBe('Safari');

      // Turn 2: "Now search for Oksy Healthcare"
      const plan2 = await commandRouter.route('Now search for Oksy Healthcare', routerContext);
      expect(plan2.interpretedIntent).toContain('Safari');
      expect(plan2.actions.length).toBeGreaterThanOrEqual(1);

      // Turn 3: "Open the first result"
      const plan3 = await commandRouter.route('Open the first result', routerContext);
      expect(plan3.interpretedIntent).toContain('First Result');
      expect(plan3.actions.some((a) => a.params.action === 'semantic_click')).toBe(true);

      // Turn 4: "Go back"
      const plan4 = await commandRouter.route('Go back', routerContext);
      expect(plan4.interpretedIntent).toContain('Navigate Back');
      expect(plan4.actions.some((a) => a.params.key === '[')).toBe(true);
    });
  });
});
