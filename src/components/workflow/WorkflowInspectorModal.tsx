import React from 'react';
import {
  X,
  CheckCircle,
  AlertTriangle,
  Play,
  Pause,
  StopCircle,
  RefreshCw,
  Clock,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import { useWorkflowStore } from '../../state/useWorkflowStore';
import { workflowEngine } from '../../core/workflow/workflow-engine';
import { redactSensitiveData, sanitizeObject } from '../../core/redactor';

export const WorkflowInspectorModal: React.FC = () => {
  const {
    activeWorkflow,
    status,
    currentStepIndex,
    stepRecords,
    isInspectorOpen,
    closeInspector,
  } = useWorkflowStore();

  if (!isInspectorOpen) return null;

  const totalSteps = activeWorkflow?.steps?.length || 0;
  const completedCount = stepRecords.filter((r) => r.success).length;
  const progressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  const handlePause = () => {
    if (activeWorkflow) {
      workflowEngine.pauseWorkflow(activeWorkflow.id);
      useWorkflowStore.getState().setStatus('PAUSED_FOR_APPROVAL');
    }
  };

  const handleResume = async () => {
    if (activeWorkflow) {
      useWorkflowStore.getState().setStatus('RUNNING');
      await workflowEngine.resumeWorkflow(activeWorkflow.id);
    }
  };

  const handleAbort = async () => {
    if (activeWorkflow) {
      await workflowEngine.abortWorkflow(activeWorkflow.id, 'Aborted via Workflow Inspector');
      useWorkflowStore.getState().setStatus('FAILED');
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'RUNNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-950 text-sky-300 border border-sky-800">
            <RefreshCw className="w-3 h-3 animate-spin" /> Running
          </span>
        );
      case 'PAUSED_FOR_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950 text-amber-300 border border-amber-800">
            <Pause className="w-3 h-3" /> Paused (Approval Required)
          </span>
        );
      case 'RECOVERING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-950 text-purple-300 border border-purple-800">
            <RefreshCw className="w-3 h-3 animate-spin" /> Recovering
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
            <CheckCircle className="w-3 h-3" /> Completed
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950 text-rose-300 border border-rose-800">
            <AlertTriangle className="w-3 h-3" /> Failed
          </span>
        );
      case 'ABORTED_BY_KILL_SWITCH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-950 text-red-300 border border-red-800">
            <ShieldAlert className="w-3 h-3" /> Kill Switch Aborted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
            <Clock className="w-3 h-3" /> {status}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-wider font-mono">
                Workflow Inspector & State Observability
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-md mt-0.5">
                {activeWorkflow?.goal || 'No active workflow'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <button
              onClick={closeInspector}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              aria-label="Close Inspector"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-4">
          <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                status === 'FAILED'
                  ? 'bg-rose-500'
                  : status === 'COMPLETED'
                  ? 'bg-emerald-500'
                  : 'bg-sky-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-mono text-slate-400 whitespace-nowrap">
            {completedCount}/{totalSteps} Steps ({progressPercent}%)
          </span>
        </div>

        {/* Content Body: Step Cards */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {activeWorkflow?.steps?.map((step, idx) => {
            const record = stepRecords.find((r) => r.stepId === step.id);
            const isCurrent = idx === currentStepIndex && status === 'RUNNING';
            const isCompleted = record?.success;
            const isFailed = record && !record.success;

            const rawParams = record?.resolvedParams || step.params;
            const sanitizedParams = sanitizeObject(rawParams);
            const redactedParamsText = redactSensitiveData(
              JSON.stringify(sanitizedParams, null, 2)
            ).redactedText;

            return (
              <div
                key={step.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-sky-950/30 border-sky-600/80 shadow-md ring-1 ring-sky-500/20'
                    : isCompleted
                    ? 'bg-slate-950/40 border-emerald-900/40'
                    : isFailed
                    ? 'bg-rose-950/20 border-rose-800/60'
                    : 'bg-slate-950/20 border-slate-800/60 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-200">
                      {step.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                      {step.skillId}:{step.action}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        step.riskLevel === 'HIGH' || step.riskLevel === 'CRITICAL'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {step.riskLevel}
                    </span>

                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {record?.durationMs ? `${record.durationMs}ms` : 'Verified'}
                      </span>
                    ) : isCurrent ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-sky-400 font-mono">
                        <RefreshCw className="w-3 h-3 animate-spin" /> In Progress
                      </span>
                    ) : isFailed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-rose-400">
                        <AlertTriangle className="w-3.5 h-3.5" /> Failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock className="w-3 h-3" /> Queued
                      </span>
                    )}
                  </div>
                </div>

                {/* Parameters & Verification Details */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/60 text-[11px] grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 block font-mono text-[10px]">Parameters</span>
                    <pre className="mt-1 p-1.5 rounded bg-slate-900/90 text-slate-300 font-mono text-[10px] overflow-x-auto max-h-24">
                      {redactedParamsText}
                    </pre>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-mono text-[10px]">Expected Outcome</span>
                    <p className="mt-1 text-slate-300 text-[11px]">{step.expectedResult}</p>
                    {record?.error && (
                      <div className="mt-1.5 p-1.5 rounded bg-rose-950/60 border border-rose-900 text-rose-300 text-[10px]">
                        Error: {record.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Lifecycle Controls */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {status === 'PAUSED_FOR_APPROVAL' && (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Awaiting approval to proceed
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {status === 'RUNNING' && (
              <button
                onClick={handlePause}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-950 text-amber-300 border border-amber-800 hover:bg-amber-900 transition flex items-center gap-1.5"
              >
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
            )}
            {status === 'PAUSED_FOR_APPROVAL' && (
              <button
                onClick={handleResume}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 transition flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" /> Resume
              </button>
            )}
            <button
              onClick={handleAbort}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 transition flex items-center gap-1.5"
            >
              <StopCircle className="w-3.5 h-3.5" /> Abort
            </button>
            <button
              onClick={closeInspector}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
