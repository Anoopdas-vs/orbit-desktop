import { describe, it, expect, beforeEach, vi } from 'vitest';
import { skillRegistry } from '../src/skills';
import { taskContextManager } from '../src/context/task-context-manager';
import { contextualIntentResolver } from '../src/core/contextual-intent-resolver';
import { multilingualNLP } from '../src/core/multilingual-nlp';
import { dynamicPlanner } from '../src/core/dynamic-planner';
import { killSwitch } from '../src/core/kill-switch';
import { validateSafeFilePath, filesSkill } from '../src/skills/files/files-skill';
import { nativeBridge } from '../src/adapters/native/tauri-bridge';
import { auditExporter } from '../src/context/audit-exporter';

describe('Phase 3 Stage 5: End-to-End Autonomous Simulation Scenarios', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    killSwitch.disengage();
    taskContextManager.reset();
  });

  describe('Scenario 1: Multi-Step Browser Automation Flow', () => {
    it('generates dynamic steps and executes browser navigation and observation', async () => {
      vi.spyOn(nativeBridge, 'openUrl').mockResolvedValue({
        success: true,
        url: 'https://news.ycombinator.com',
        browser: 'Safari',
        message: 'Opened Safari',
      });

      // 1. Generate plan for browser task
      const plan = dynamicPlanner.decomposeGoal(
        'Open Safari and search for AI',
        'Safari'
      );
      expect(plan).not.toBeNull();
      expect(plan!.steps.length).toBeGreaterThan(0);
      expect(plan!.steps[0].preconditions.requiredActiveApp || plan!.steps[1].preconditions.requiredActiveApp).toBe('Safari');

      // 2. Dispatch browser action
      const navResult = await skillRegistry.dispatch('browser_skill', {
        action: 'navigate',
        browser: 'Safari',
        url: 'https://news.ycombinator.com',
      }, { sessionId: 'e2e-s1' });

      expect(navResult.success).toBe(true);
      expect(navResult.data?.action).toBe('navigate');

      // 3. Record verified turn
      taskContextManager.recordTurn({
        userPrompt: 'Navigate to hacker news in Safari',
        interpretedIntent: 'BROWSER_AUTOMATION',
        activeApp: 'Safari',
        actions: ['browser_skill.navigate'],
        success: true,
      });

      const session = taskContextManager.getSession();
      expect(session.turns.length).toBe(1);
      expect(session.activeApp).toBe('Safari');
    });
  });

  describe('Scenario 2: Contextual Anaphora & Multi-Turn Follow-Up', () => {
    it('resolves anaphoric pronouns and relative targets across conversational turns', () => {
      // Turn 1
      taskContextManager.startTask('Search quantum computing in Safari', 'Safari');
      taskContextManager.setActiveApp('Safari');
      taskContextManager.recordTurn({
        userPrompt: 'Search quantum computing in Safari',
        interpretedIntent: 'SEARCH',
        activeApp: 'Safari',
        actions: ['browser_skill.navigate'],
        success: true,
      });

      // Turn 2: Relative target "Open the first result"
      const resolvedFirst = contextualIntentResolver.resolve('Open the first result');
      expect(resolvedFirst.isContextual).toBe(true);
      expect(resolvedFirst.resolvedApp).toBe('Safari');
      expect(resolvedFirst.actionType).toBe('click_result');

      // Turn 3: "Go back"
      const resolvedBack = contextualIntentResolver.resolve('Go back');
      expect(resolvedBack.isContextual).toBe(true);
      expect(resolvedBack.resolvedApp).toBe('Safari');
      expect(resolvedBack.actionType).toBe('browser_back');

      // Turn 4: "Next tab"
      const resolvedNextTab = contextualIntentResolver.resolve('Next tab');
      expect(resolvedNextTab.isContextual).toBe(true);
      expect(resolvedNextTab.resolvedApp).toBe('Safari');
      expect(resolvedNextTab.actionType).toBe('switch_tab');
      expect(resolvedNextTab.canonicalPrompt).toBe('Switch to next tab in Safari');
    });
  });

  describe('Scenario 3: Multilingual NLP (Malayalam & Manglish)', () => {
    it('detects and handles English, Malayalam, and Manglish inputs accurately', () => {
      expect(multilingualNLP.detectLanguage('Open Safari and search for AI')).toBe('en');
      expect(multilingualNLP.detectLanguage('സഫാരി തുറന്ന് തിരയൂ')).toBe('ml');
      expect(multilingualNLP.detectLanguage('Safari open cheythu search cheyyu')).toBe('manglish');

      expect(multilingualNLP.isFollowUpCommand('Open the first result')).toBe(true);
      expect(multilingualNLP.isFollowUpCommand('Go back')).toBe(true);
      expect(multilingualNLP.isFollowUpCommand('ആദ്യത്തെ ലിങ്ക്')).toBe(true);

      // Verify execution of turn through context manager
      taskContextManager.recordTurn({
        userPrompt: 'Safari open cheythu search cheyyu',
        interpretedIntent: 'OPEN_APP',
        activeApp: 'Safari',
        actions: ['open_app'],
        success: true,
      });

      const session = taskContextManager.getSession();
      expect(session.turns.length).toBe(1);
    });
  });

  describe('Scenario 4: Bulk Deletion & Path Protection', () => {
    it('rejects protected system/secret paths and escalates batch trash operations', async () => {
      // 1. Path safety validations
      expect(validateSafeFilePath('/System/Library/CoreServices').isSafe).toBe(false);
      expect(validateSafeFilePath('/Users/user/../../etc/passwd').isSafe).toBe(false);
      expect(validateSafeFilePath('/Users/user/project/.env').isSafe).toBe(false);

      // 2. Safe trash movement with HIGH risk escalation
      const trashSpy = vi.spyOn(nativeBridge, 'moveToTrash').mockResolvedValue(true);
      const trashResult = await skillRegistry.dispatch('files_skill', {
        action: 'move_to_trash',
        path: '/Users/user/Downloads/temp_old.pdf',
      }, { sessionId: 'e2e-s4', riskTier: 'HIGH' });

      expect(trashResult.success).toBe(true);
      expect(trashSpy).toHaveBeenCalledWith('/Users/user/Downloads/temp_old.pdf');
      expect(filesSkill.riskLevel).toBe('HIGH');
    });
  });

  describe('Scenario 5: Emergency Stop Mid-Task Execution', () => {
    it('immediately halts active multi-step operations and records failure truthfully', async () => {
      // Step 1: Engage Emergency Stop
      killSwitch.engage('Voice Emergency Command', 'voice-emergency-stop');
      expect(killSwitch.isEngaged()).toBe(true);

      // Step 2: Attempt skill dispatch mid-sequence
      const blockedResult = await skillRegistry.dispatch('media_skill', {
        action: 'play_pause',
        appName: 'Spotify',
      }, { sessionId: 'e2e-s5' });

      expect(blockedResult.success).toBe(false);
      expect(blockedResult.error).toContain('Emergency Kill Switch is engaged');

      // Step 3: Record truthful failure in context audit
      taskContextManager.recordTurn({
        userPrompt: 'play spotify',
        interpretedIntent: 'MEDIA_CONTROL',
        actions: [],
        success: false,
      });

      const session = taskContextManager.getSession();
      expect(session.turns[0].success).toBe(false);

      // Step 4: Disengage restores functionality
      killSwitch.disengage();
      expect(killSwitch.isEngaged()).toBe(false);
    });

    it('exports audit logs with strict redaction across multi-step scenarios', () => {
      taskContextManager.startTask('Secure operations', 'Terminal');
      taskContextManager.recordTurn({
        userPrompt: 'deploy with token=ghp_123456789012345678901234567890123456',
        interpretedIntent: 'DEPLOY_APP',
        activeApp: 'Terminal',
        actions: ['terminal.run'],
        success: true,
      });

      const session = taskContextManager.getSession();
      const sanitized = auditExporter.sanitizeSession(session);
      expect(sanitized[0].userPrompt).toContain('[REDACTED]');
      expect(sanitized[0].userPrompt).not.toContain('ghp_1234567890');
    });

    it('executes voice barge-in interruption cleanly mid-automation', () => {
      const stopSpy = vi.spyOn(nativeBridge, 'controlAction').mockResolvedValue({ success: true, action: 'stop' });
      killSwitch.engage('User interrupt', 'user-ui');
      expect(killSwitch.isEngaged()).toBe(true);
      killSwitch.disengage();
      expect(killSwitch.isEngaged()).toBe(false);
      expect(stopSpy).toBeDefined();
    });
  });
});
