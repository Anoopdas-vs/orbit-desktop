import { create } from 'zustand';
import { AuditLogEntry, ExecutionLog, ApprovalEvent } from '../types/audit';
import { TradeJournalEntry } from '../types/trading';
import { orbitDb } from '../db/database';

interface AuditState {
  entries: AuditLogEntry[];
  executionLogs: ExecutionLog[];
  approvalEvents: ApprovalEvent[];
  tradeJournal: TradeJournalEntry[];

  // Actions
  addAuditEntry: (entry: AuditLogEntry) => void;
  addExecutionLog: (log: ExecutionLog) => void;
  addApprovalEvent: (event: ApprovalEvent) => void;
  addTradeJournal: (entry: TradeJournalEntry) => void;
  exportAuditJson: () => string;
  clearLogs: () => void;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  entries: [
    {
      id: 'init-audit-1',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      source: 'system',
      rawCommand: 'System Boot: Orbit Security Agent Initialized',
      interpretedIntent: 'System Boot',
      overallRisk: 'LOW',
      approvalStatus: 'AUTO_APPROVED',
      actionsExecutedCount: 1,
      actionsFailedCount: 0,
      executionDurationMs: 12,
      hasSensitiveRedactions: false,
      details: { mode: 'SAFE_MODE', version: '0.1.0' },
    }
  ],
  executionLogs: [],
  approvalEvents: [],
  tradeJournal: [],

  addAuditEntry: (entry: AuditLogEntry) => {
    orbitDb.logCommand(entry);
    set((state) => ({ entries: [entry, ...state.entries] }));
  },

  addExecutionLog: (log: ExecutionLog) => {
    orbitDb.logExecution(log);
    set((state) => ({ executionLogs: [log, ...state.executionLogs] }));
  },

  addApprovalEvent: (event: ApprovalEvent) => {
    orbitDb.logApproval(event);
    set((state) => ({ approvalEvents: [event, ...state.approvalEvents] }));
  },

  addTradeJournal: (entry: TradeJournalEntry) => {
    orbitDb.logTradeJournal(entry);
    set((state) => ({ tradeJournal: [entry, ...state.tradeJournal] }));
  },

  exportAuditJson: () => {
    const state = get();
    return JSON.stringify(
      {
        appName: 'Orbit Assistant',
        exportedAt: new Date().toISOString(),
        entries: state.entries,
        executionLogs: state.executionLogs,
        approvalEvents: state.approvalEvents,
        tradeJournal: state.tradeJournal,
      },
      null,
      2
    );
  },

  clearLogs: () => {
    orbitDb.resetAllData();
    set({ entries: [], executionLogs: [], approvalEvents: [], tradeJournal: [] });
  }
}));
