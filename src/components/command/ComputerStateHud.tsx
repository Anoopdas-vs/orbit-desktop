import React, { useEffect } from 'react';
import { Monitor, CheckCircle, AlertTriangle, RefreshCw, Volume2, VolumeX, ShieldCheck, Layers } from 'lucide-react';
import { useComputerStateStore } from '../../state/useComputerStateStore';
import { useWorkflowStore } from '../../state/useWorkflowStore';
import { WorkflowInspectorModal } from '../workflow/WorkflowInspectorModal';
import { nativeBridge } from '../../adapters/native/tauri-bridge';

export const ComputerStateHud: React.FC = () => {
  const {
    activeApp,
    activeWindow,
    volume,
    isMuted,
    currentTaskId,
    currentTaskGoal,
    currentStepIndex,
    totalSteps,
    lastAction,
    expectedState,
    isVerified,
    retryCount,
    lastRecoveryReason,
    updateSystemState,
  } = useComputerStateStore();

  const openInspector = useWorkflowStore((state) => state.openInspector);

  useEffect(() => {
    let isMounted = true;
    const pollState = async () => {
      try {
        const info = await nativeBridge.getComputerState();
        if (isMounted) {
          updateSystemState(info);
        }
      } catch {
        // bridge unavailable in pure browser without dev server
      }
    };

    pollState();
    const interval = setInterval(pollState, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [updateSystemState]);

  return (
    <>
      <WorkflowInspectorModal />
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 backdrop-blur-md text-xs shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
              Computer State & Control HUD
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openInspector}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-950/80 border border-sky-800/60 text-sky-300 text-[10px] hover:bg-sky-900 transition"
              title="Open Workflow Inspector"
            >
              <Layers className="w-3 h-3" />
              Inspector
            </button>
            <div className="flex items-center gap-1.5 text-slate-400 ml-1">
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{isMuted ? 'Muted' : `${volume}%`}</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[10px]">
              <ShieldCheck className="w-3 h-3" />
              Autonomous Layer Ready
            </span>
          </div>
        </div>

      <div className="grid grid-cols-2 gap-2 text-slate-300">
        <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/80">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Active Application</span>
          <span className="font-medium text-emerald-300 truncate block mt-0.5">
            {activeApp || 'Finder'}
          </span>
        </div>

        <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/80">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Active Window</span>
          <span className="font-medium text-slate-300 truncate block mt-0.5" title={activeWindow || 'None'}>
            {activeWindow || 'Desktop'}
          </span>
        </div>
      </div>

      {currentTaskId && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-400 font-medium truncate max-w-[70%]">
              Task: <span className="text-slate-200">{currentTaskGoal}</span>
            </span>
            <span className="text-amber-400 font-mono text-[11px]">
              Step {currentStepIndex} of {totalSteps}
            </span>
          </div>

          <div className="flex items-center justify-between bg-slate-950/80 rounded-lg p-2 border border-slate-800 text-[11px]">
            <div className="truncate mr-2">
              <span className="text-slate-500 font-mono">Action: </span>
              <span className="text-sky-300">{lastAction || 'Initializing'}</span>
              {expectedState && (
                <span className="text-slate-400 block truncate text-[10px] mt-0.5">
                  Expected: {expectedState}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {retryCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  Retry {retryCount}
                </span>
              )}
              {isVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-800/60">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  Observing
                </span>
              )}
            </div>
          </div>

          {lastRecoveryReason && (
            <div className="mt-1.5 flex items-start gap-1 text-[10px] text-amber-300/90 bg-amber-950/30 p-1.5 rounded border border-amber-900/40">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />
              <span className="truncate">{lastRecoveryReason}</span>
            </div>
          )}
        </div>
      )}
    </div>
  </>
  );
};
