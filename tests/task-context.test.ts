import { describe, it, expect, beforeEach, vi } from 'vitest';
import { taskContextManager, TaskContextManager } from '../src/context/task-context-manager';
import { entityBlackboard, EntityBlackboard } from '../src/context/entity-blackboard';

describe('Phase 3 Stage 1: Task Context & Entity Blackboard', () => {
  beforeEach(() => {
    taskContextManager.resetTask();
    entityBlackboard.clear();
  });

  describe('EntityBlackboard', () => {
    it('stores, retrieves, and checks entities', () => {
      const board = new EntityBlackboard();
      const record = board.setEntity('targetApp', 'Safari', 'app', 1);

      expect(record.name).toBe('targetApp');
      expect(record.value).toBe('Safari');
      expect(record.type).toBe('app');
      expect(record.sourceTurn).toBe(1);

      expect(board.hasEntity('targetApp')).toBe(true);
      expect(board.getEntity('targetApp')?.value).toBe('Safari');
      expect(board.getEntity('nonexistent')).toBeNull();
    });

    it('redacts sensitive data before storing entities', () => {
      const board = new EntityBlackboard();
      const secret = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
      const record = board.setEntity('apiKey', `My token is ${secret}`, 'custom', 1);

      expect(record.redacted).toBe(true);
      expect(record.value).not.toContain(secret);
      expect(record.value).toContain('[REDACTED_SECRET]');
    });

    it('automatically extracts known apps, URLs, queries, and file paths', () => {
      const board = new EntityBlackboard();
      const extracted = board.extractAndRecord('Open Safari and search for Oksy Healthcare on https://www.google.com', 1);

      expect(board.getEntity('activeApp')?.value).toBe('Safari');
      expect(board.getEntity('url')?.value).toBe('https://www.google.com');
      expect(board.getEntity('searchQuery')?.value).toBe('Oksy Healthcare');
      expect(extracted.length).toBeGreaterThanOrEqual(2);
    });

    it('extracts Malayalam search queries', () => {
      const board = new EntityBlackboard();
      board.extractAndRecord('Safari തുറന്ന് Google ൽ Oksy Healthcare search ചെയ്യൂ', 1);

      expect(board.getEntity('activeApp')?.value).toBe('Safari');
      expect(board.getEntity('searchQuery')?.value).toBe('Oksy Healthcare');
    });

    it('extracts Manglish search queries', () => {
      const board = new EntityBlackboard();
      board.extractAndRecord('Safari open cheythitu Oksy Healthcare search cheyyu', 1);

      expect(board.getEntity('activeApp')?.value).toBe('Safari');
      expect(board.getEntity('searchQuery')?.value).toBe('Oksy Healthcare');
    });

    it('extracts file paths with extensions', () => {
      const board = new EntityBlackboard();
      board.extractAndRecord('Open /Users/anoopdasvs/Documents/report.pdf in Preview', 1);

      expect(board.getEntity('filePath')?.value).toBe('/Users/anoopdasvs/Documents/report.pdf');
    });

    it('retrieves entities by type and clears blackboard', () => {
      const board = new EntityBlackboard();
      board.setEntity('app1', 'Safari', 'app');
      board.setEntity('app2', 'Chrome', 'app');
      board.setEntity('q1', 'test query', 'searchQuery');

      const apps = board.getEntitiesByType('app');
      expect(apps.length).toBe(2);

      board.clear();
      expect(Object.keys(board.getAllEntities()).length).toBe(0);
    });
  });

  describe('TaskContextManager', () => {
    it('initializes and manages multi-turn task sessions', () => {
      const session = taskContextManager.startTask('Search Healthcare providers', 'Safari');

      expect(session.goal).toBe('Search Healthcare providers');
      expect(session.activeApp).toBe('Safari');
      expect(session.turns.length).toBe(0);
      expect(taskContextManager.isSessionActive()).toBe(true);

      // Turn 1
      const turn1 = taskContextManager.recordTurn({
        userPrompt: 'Open Safari',
        interpretedIntent: 'Launch Safari',
        activeApp: 'Safari',
      });
      expect(turn1.turnNumber).toBe(1);
      expect(turn1.activeApp).toBe('Safari');

      // Turn 2
      const turn2 = taskContextManager.recordTurn({
        userPrompt: 'Now search for Oksy Healthcare',
        interpretedIntent: 'Search Safari for Oksy Healthcare',
      });
      expect(turn2.turnNumber).toBe(2);
      expect(taskContextManager.getActiveApp()).toBe('Safari');
      expect(taskContextManager.getEntity('searchQuery')?.value).toBe('Oksy Healthcare');

      const active = taskContextManager.getActiveSession();
      expect(active?.turns.length).toBe(2);
    });

    it('redacts sensitive data in recorded turns and session goals', () => {
      const secret = 'password = "superSecretPassword123"';
      const session = taskContextManager.startTask(`Setup account with ${secret}`);
      expect(session.goal).toContain('[REDACTED_SECRET]');

      const turn = taskContextManager.recordTurn({
        userPrompt: `Use token api_key: "abcdef1234567890"`,
        interpretedIntent: 'Configure token',
      });
      expect(turn.userPrompt).toContain('[REDACTED_SECRET]');
    });

    it('expires task session after TTL elapses', () => {
      // Use a custom short TTL of 50ms for testing
      const customManager = new TaskContextManager(new EntityBlackboard(), 50);
      customManager.startTask('Expiring task', 'Calculator');

      expect(customManager.isSessionActive()).toBe(true);
      expect(customManager.getActiveSession()?.goal).toBe('Expiring task');

      // Fast-forward time or delay past 50ms
      vi.setSystemTime(Date.now() + 60);

      expect(customManager.getActiveSession()).toBeNull();
      expect(customManager.isSessionActive()).toBe(false);

      vi.useRealTimers();
    });

    it('supports explicit task reset', () => {
      taskContextManager.startTask('Task to reset', 'TextEdit');
      taskContextManager.setActiveApp('TextEdit');
      taskContextManager.setActiveWindow('Untitled');

      expect(taskContextManager.getActiveApp()).toBe('TextEdit');
      expect(taskContextManager.getActiveWindow()).toBe('Untitled');

      taskContextManager.resetTask('User requested new context');

      expect(taskContextManager.getActiveSession()).toBeNull();
      expect(taskContextManager.isSessionActive()).toBe(false);
      expect(taskContextManager.getActiveApp()).toBeNull();
      expect(taskContextManager.getActiveWindow()).toBeNull();
    });

    it('provides a clean context snapshot', () => {
      taskContextManager.startTask('Snapshot test', 'Safari');
      taskContextManager.setEntity('key1', 'val1');
      taskContextManager.recordTurn({
        userPrompt: 'Hello Janki',
        interpretedIntent: 'Awaken',
      });

      const snapshot = taskContextManager.getSnapshot();
      expect(snapshot).not.toBeNull();
      expect(snapshot?.goal).toBe('Snapshot test');
      expect(snapshot?.turnCount).toBe(1);
      expect(snapshot?.entities.key1).toBe('val1');
    });
  });
});
