import React, { useState } from 'react';
import {
  History,
  Download,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { taskContextManager } from '../../context/task-context-manager';
import { auditExporter, SanitizedAuditEntry } from '../../context/audit-exporter';

export const TaskHistoryView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILURE'>('ALL');

  // Load current session turns and sanitize them
  const currentSession = taskContextManager.getSession();
  const entries: SanitizedAuditEntry[] = auditExporter.sanitizeSession(currentSession);

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.userPrompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.intent.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.targetApp && entry.targetApp.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRisk = selectedRisk === 'ALL' || entry.riskTier === selectedRisk;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'SUCCESS' && entry.success) ||
      (statusFilter === 'FAILURE' && !entry.success);

    return matchesSearch && matchesRisk && matchesStatus;
  });

  const handleExportJson = () => {
    const jsonStr = auditExporter.exportToJson(filteredEntries);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `janki_task_history_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const csvStr = auditExporter.exportToCsv(filteredEntries);
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `janki_task_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-700/50">
            <History className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Task Automation History & Audit</h2>
            <p className="text-xs text-slate-400">
              Interactive timeline of autonomous tasks, multi-turn context, and verified executions.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportJson}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center space-x-3 py-4 shrink-0">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search prompts, intents, or target applications..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={selectedRisk}
          onChange={(e) => setSelectedRisk(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="ALL">All Risk Tiers</option>
          <option value="LOW">Low Risk</option>
          <option value="MEDIUM">Medium Risk</option>
          <option value="HIGH">High Risk</option>
          <option value="CRITICAL">Critical Risk</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="ALL">All Statuses</option>
          <option value="SUCCESS">Success Only</option>
          <option value="FAILURE">Failed Only</option>
        </select>
      </div>

      {/* Timeline View */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No automation tasks found matching your filter criteria.
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={`${entry.sessionId}-${entry.turnIndex}`}
              className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 shadow-sm hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5">
                    {entry.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        Turn #{entry.turnIndex}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          entry.riskTier === 'CRITICAL'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : entry.riskTier === 'HIGH'
                            ? 'bg-orange-950 text-orange-300 border border-orange-800'
                            : entry.riskTier === 'MEDIUM'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {entry.riskTier}
                      </span>
                      {entry.targetApp && (
                        <span className="text-[11px] text-slate-300 font-semibold">
                          {entry.targetApp}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-200 mt-1.5 font-medium">
                      "{entry.userPrompt}"
                    </p>

                    {entry.actionsExecuted.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {entry.actionsExecuted.map((act, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-400"
                          >
                            {act}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-400 font-mono shrink-0">
                  <div className="flex items-center space-x-1 justify-end">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{entry.durationMs ?? 0}ms</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
