import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Play,
  XCircle,
  Eye,
  CheckCheck,
  Shield,
  Clock,
  Terminal,
} from 'lucide-react';
import { ActionPlan, ActionItem, RiskLevel } from '../../types/action-plan';
import { useCommandStore } from '../../state/useCommandStore';
import { CriticalConfirmModal } from './CriticalConfirmModal';

interface PlanReviewCardProps {
  plan: ActionPlan;
}

export const PlanReviewCard: React.FC<PlanReviewCardProps> = ({ plan }) => {
  const { approveAction, approveAllActions, rejectPlan, isExecuting } = useCommandStore();
  const [selectedCriticalAction, setSelectedCriticalAction] = useState<ActionItem | null>(null);

  const getRiskBadge = (risk: RiskLevel) => {
    switch (risk) {
      case 'LOW':
        return (
          <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            LOW RISK
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="bg-amber-950/80 text-amber-400 border border-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            MEDIUM RISK
          </span>
        );
      case 'HIGH':
        return (
          <span className="bg-orange-950/80 text-orange-400 border border-orange-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            HIGH RISK
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="bg-rose-950/80 text-rose-300 border border-rose-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            CRITICAL RISK
          </span>
        );
    }
  };

  const pendingActions = plan.actions.filter((a) => a.status === 'PENDING_APPROVAL');
  const hasPending = pendingActions.length > 0;

  const handleActionClick = (action: ActionItem) => {
    if (action.riskLevel === 'CRITICAL') {
      setSelectedCriticalAction(action);
    } else {
      approveAction(action.id);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl backdrop-blur-sm space-y-4">
      {/* Plan Header */}
      <div className="flex items-start justify-between border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-100">{plan.interpretedIntent}</h3>
            {getRiskBadge(plan.overallRisk)}
            {plan.isDryRun && (
              <span className="bg-indigo-950 text-indigo-300 border border-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-mono">
                DRY RUN MODE
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Command: <span className="font-mono text-slate-300">"{plan.userPrompt}"</span>
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {hasPending && (
            <>
              <button
                disabled={isExecuting}
                onClick={() => approveAllActions()}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition shadow-md"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Approve All ({pendingActions.length})</span>
              </button>
              <button
                onClick={() => rejectPlan()}
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg font-medium border border-slate-700 transition"
              >
                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Reject</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Action Items List */}
      <div className="space-y-2.5">
        {plan.actions.map((action, idx) => (
          <div
            key={action.id}
            className={`border rounded-lg p-3 transition ${
              action.status === 'COMPLETED'
                ? 'bg-slate-950/40 border-emerald-900/40'
                : action.status === 'RUNNING'
                ? 'bg-blue-950/20 border-blue-800 animate-pulse'
                : action.status === 'FAILED'
                ? 'bg-rose-950/30 border-rose-900'
                : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-mono">
                  {idx + 1}
                </span>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-200">{action.title}</span>
                    {getRiskBadge(action.riskLevel)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{action.description}</div>
                </div>
              </div>

              {/* Status and Action Controls */}
              <div className="flex items-center space-x-2">
                {action.status === 'PENDING_APPROVAL' && (
                  <button
                    onClick={() => handleActionClick(action)}
                    className={`flex items-center space-x-1 px-3 py-1 rounded text-xs font-semibold transition ${
                      action.riskLevel === 'CRITICAL'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{action.riskLevel === 'CRITICAL' ? 'Review & Confirm' : 'Approve'}</span>
                  </button>
                )}

                {action.status === 'RUNNING' && (
                  <span className="text-xs text-blue-400 font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                    Running...
                  </span>
                )}

                {action.status === 'COMPLETED' && (
                  <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed ({action.executionDurationMs}ms)
                  </span>
                )}

                {action.status === 'DRY_RUN' && (
                  <span className="text-xs text-indigo-400 font-mono flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    Dry Run Validated
                  </span>
                )}

                {action.status === 'FAILED' && (
                  <span className="text-xs text-rose-400 font-mono flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    Failed
                  </span>
                )}
              </div>
            </div>

            {/* Expected Effect */}
            <div className="mt-2 text-[11px] text-slate-400 font-mono bg-slate-900/60 px-2.5 py-1.5 rounded border border-slate-800/60 flex items-center justify-between">
              <span>Expected Effect: {action.expectedEffect}</span>
              <span className="text-slate-400 text-[10px]">Skill: {action.skillId}</span>
            </div>

            {/* Output or Error if available */}
            {action.output && (
              <div className="mt-2 text-[11px] font-mono bg-slate-950 p-2 rounded border border-slate-800 text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                {typeof action.output === 'string' ? action.output : JSON.stringify(action.output, null, 2)}
              </div>
            )}
            {action.error && (
              <div className="mt-2 text-[11px] font-mono bg-rose-950/60 p-2 rounded border border-rose-900 text-rose-300 overflow-x-auto">
                {action.error}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Critical Verification Modal */}
      {selectedCriticalAction && (
        <CriticalConfirmModal
          action={selectedCriticalAction}
          isOpen={!!selectedCriticalAction}
          onClose={() => setSelectedCriticalAction(null)}
          onConfirm={(phrase) => {
            approveAction(selectedCriticalAction.id, phrase);
            setSelectedCriticalAction(null);
          }}
        />
      )}
    </div>
  );
};
