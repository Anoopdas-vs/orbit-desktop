import { describe, it, expect, beforeEach } from 'vitest';
import { taskContextManager } from '../src/context/task-context-manager';
import { auditExporter, redactSensitiveContent } from '../src/context/audit-exporter';

describe('Phase 3 Stage 4: Task History, Audit Ledger & Redaction', () => {
  beforeEach(() => {
    taskContextManager.reset();
  });

  describe('Sensitive Data Redaction', () => {
    it('redacts API keys, passwords, bearer tokens, and secrets', () => {
      const sensitive1 = 'Connecting with api_key: sk-1234567890abcdef1234567890 to service';
      expect(redactSensitiveContent(sensitive1)).toContain('[REDACTED]');
      expect(redactSensitiveContent(sensitive1)).not.toContain('sk-1234567890abcdef');

      const sensitive2 = 'login with password= supersecretPass123! and user admin';
      expect(redactSensitiveContent(sensitive2)).toContain('[REDACTED]');
      expect(redactSensitiveContent(sensitive2)).not.toContain('supersecretPass123!');

      const sensitive3 = 'Authorization: Bearer ya29.a0AfH6SMAxyz123456789';
      expect(redactSensitiveContent(sensitive3)).toContain('[REDACTED]');
    });

    it('redacts credit card numbers', () => {
      const cardText = 'Payment card: 4111 2222 3333 4444 submitted';
      const redacted = redactSensitiveContent(cardText);
      expect(redacted).toContain('[REDACTED]');
      expect(redacted).not.toContain('4111 2222 3333 4444');
    });

    it('preserves non-sensitive text completely intact', () => {
      const plain = 'Open Safari and navigate to google.com';
      expect(redactSensitiveContent(plain)).toBe(plain);
    });
  });

  describe('Session Audit Serialization & Export', () => {
    it('records turns in taskContextManager and exports sanitized JSON', () => {
      taskContextManager.recordTurn({
        userPrompt: 'Open Safari with token=abc123456secret',
        interpretedIntent: 'BROWSER_AUTOMATION',
        activeApp: 'Safari',
        riskTier: 'LOW',
        success: true,
        actions: ['browser_skill.navigate'],
        durationMs: 45,
      });

      taskContextManager.recordTurn({
        userPrompt: 'Move old files to trash',
        interpretedIntent: 'FILE_MANAGEMENT',
        riskTier: 'HIGH',
        success: true,
        actions: ['files_skill.move_to_trash'],
        durationMs: 80,
      });

      const session = taskContextManager.getSession();
      const sanitized = auditExporter.sanitizeSession(session);

      expect(sanitized.length).toBe(2);
      expect(sanitized[0].userPrompt).toContain('[REDACTED]');
      expect(sanitized[0].intent).toBe('BROWSER_AUTOMATION');
      expect(sanitized[1].riskTier).toBe('HIGH');

      const jsonStr = auditExporter.exportToJson(sanitized);
      const parsed = JSON.parse(jsonStr);
      expect(parsed.length).toBe(2);
      expect(parsed[0].userPrompt).toContain('[REDACTED]');
    });

    it('exports audit records to valid CSV format with header', () => {
      taskContextManager.recordTurn({
        userPrompt: 'Play music on Spotify',
        interpretedIntent: 'MEDIA_CONTROL',
        activeApp: 'Spotify',
        riskTier: 'LOW',
        success: true,
        actions: ['media_skill.play_pause'],
        durationMs: 30,
      });

      const session = taskContextManager.getSession();
      const sanitized = auditExporter.sanitizeSession(session);
      const csvStr = auditExporter.exportToCsv(sanitized);

      const lines = csvStr.split('\n');
      expect(lines.length).toBe(2); // Header + 1 row
      expect(lines[0]).toContain('SessionID,Turn,Timestamp,UserPrompt');
      expect(lines[1]).toContain('Play music on Spotify');
      expect(lines[1]).toContain('MEDIA_CONTROL');
    });
  });
});
