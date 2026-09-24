import React, { useState } from 'react';
import {
  FileText,
  Download,
  Trash2,
  Shield,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Lock,
} from 'lucide-react';
import { useAuditStore } from '../../state/useAuditStore';
import { RiskLevel } from '../../types/action-plan';

export const AuditView: React.FC = () => {
  const { entries, executionLogs, approvalEvents, exportAuditJson, clearLogs } = useAuditStore();
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');

  const filteredEntries = entries.filter((e) => {
    const matchesSearch =
      e.rawCommand.toLowerCase().includes(searchFilter.toLowerCase()) ||
      e.interpretedIntent.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesRisk = selectedRisk === 'ALL' || e.overallRisk === selectedRisk;
    return matchesSearch && matchesRisk;
  });

  const handleExport = () => {
    const jsonStr = exportAuditJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbit_audit_ledger_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            Append-Only Activity & Audit Ledger
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Immutable chronological record of commands, transcriptions, approval decisions, executed tools, and redactions.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExport}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium shadow transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON Audit</span>
          </button>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to reset local audit records?')) {
                clearLogs();
              }
            }}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg font-medium border border-slate-700 transition"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search commands, intents, tools..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        <div className="flex items-center space-x-1 text-xs">
          <span className="text-slate-400 mr-1 text-[11px]">Filter Risk:</span>
          {['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((risk) => (
            <button
              key={risk}
              onClick={() => setSelectedRisk(risk)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                selectedRisk === risk
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {risk}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Entries Feed */}
      <div className="space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs font-mono">
            No audit records matching criteria.
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5 hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-200">{entry.interpretedIntent}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                      entry.overallRisk === 'LOW'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : entry.overallRisk === 'MEDIUM'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : entry.overallRisk === 'HIGH'
                        ? 'bg-orange-950 text-orange-400 border border-orange-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {entry.overallRisk}
                  </span>

                  {entry.hasSensitiveRedactions && (
                    <span className="bg-purple-950 text-purple-300 border border-purple-800 text-[9px] px-1.5 py-0.2 rounded font-mono flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      REDACTED SECRETS
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono">
                  <span>Source: {entry.source}</span>
                  <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Raw Command */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 font-mono text-xs text-slate-300">
                <span className="text-slate-500 mr-2">$</span>
                {entry.rawCommand}
              </div>

              {/* Status and Performance Meta */}
              <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
                <div className="flex items-center space-x-3">
                  <span>Approval: <strong className="text-slate-300">{entry.approvalStatus}</strong></span>
                  {entry.transcriptionConfidence && (
                    <span>Confidence: {(entry.transcriptionConfidence * 100).toFixed(0)}%</span>
                  )}
                </div>
                <span>Execution Time: {entry.executionDurationMs}ms</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
