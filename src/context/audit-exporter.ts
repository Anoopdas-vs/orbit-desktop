/**
 * Audit Exporter for Janki AI
 * Serializes task execution sessions, risk tiers, and telemetry into sanitized JSON/CSV.
 * Implements strict redaction of sensitive credentials, API keys, passwords, and tokens.
 */

import { ConversationalTurn, TaskSession } from '../types/context';

const SENSITIVE_PATTERNS = [
  /password\s*[:=]\s*[^\s,;]+/gi,
  /api[_-]?key\s*[:=]\s*[^\s,;]+/gi,
  /bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /secret\s*[:=]\s*[^\s,;]+/gi,
  /token\s*[:=]\s*[^\s,;]+/gi,
  /ghp_[A-Za-z0-9]{36}/gi,
  /sk-[A-Za-z0-9]{20,}/gi,
  /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, // Credit cards
];

export function redactSensitiveContent(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let redacted = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted;
}

export interface SanitizedAuditEntry {
  sessionId: string;
  turnIndex: number;
  timestamp: string;
  userPrompt: string;
  normalizedPrompt: string;
  intent: string;
  targetApp?: string;
  riskTier?: string;
  success: boolean;
  durationMs?: number;
  actionsExecuted: string[];
}

export class AuditExporter {
  /**
   * Transforms raw session turns into sanitized, redact-safe audit entries.
   */
  public sanitizeSession(session: TaskSession): SanitizedAuditEntry[] {
    return session.turns.map((turn, index) => ({
      sessionId: session.sessionId,
      turnIndex: index + 1,
      timestamp: new Date(turn.timestamp).toISOString(),
      userPrompt: redactSensitiveContent(turn.userPrompt),
      normalizedPrompt: redactSensitiveContent(turn.userPrompt),
      intent: turn.interpretedIntent,
      targetApp: turn.activeApp,
      riskTier: turn.riskTier || 'LOW',
      success: turn.success,
      durationMs: turn.durationMs,
      actionsExecuted: (turn.actions || []).map((a: string) => redactSensitiveContent(a)),
    }));
  }

  /**
   * Exports session or turns to formatted JSON string.
   */
  public exportToJson(entries: SanitizedAuditEntry[]): string {
    return JSON.stringify(entries, null, 2);
  }

  /**
   * Exports audit entries to CSV string format.
   */
  public exportToCsv(entries: SanitizedAuditEntry[]): string {
    const headers = [
      'SessionID',
      'Turn',
      'Timestamp',
      'UserPrompt',
      'Intent',
      'TargetApp',
      'RiskTier',
      'Success',
      'DurationMs',
      'ActionsExecuted',
    ];

    const escapeCsv = (val: any): string => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = entries.map((entry) => [
      escapeCsv(entry.sessionId),
      escapeCsv(entry.turnIndex),
      escapeCsv(entry.timestamp),
      escapeCsv(entry.userPrompt),
      escapeCsv(entry.intent),
      escapeCsv(entry.targetApp || ''),
      escapeCsv(entry.riskTier || 'LOW'),
      escapeCsv(entry.success ? 'TRUE' : 'FALSE'),
      escapeCsv(entry.durationMs ?? 0),
      escapeCsv(entry.actionsExecuted.join('; ')),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

export const auditExporter = new AuditExporter();
