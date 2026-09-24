import React from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { useSafetyStore } from '../../state/useSafetyStore';

export const KillSwitchBanner: React.FC = () => {
  const { killSwitchActive, killSwitchReason, disengageKillSwitch } = useSafetyStore();

  if (!killSwitchActive) return null;

  return (
    <div className="bg-rose-950/90 border-b border-rose-800 text-rose-100 px-4 py-3 flex items-center justify-between shadow-2xl backdrop-blur-md z-20 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-rose-900/60 rounded-lg border border-rose-700/80 animate-pulse">
          <AlertOctagon className="w-5 h-5 text-rose-300" />
        </div>
        <div>
          <div className="text-xs font-bold tracking-wide uppercase text-rose-300">
            Emergency Kill Switch Engaged
          </div>
          <div className="text-xs text-rose-200 font-mono mt-0.5">
            {killSwitchReason || 'All background subprocesses and external actions have been terminated.'}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <span className="text-[11px] text-rose-300/80 hidden md:inline">
          Executions, Git pushes, deployments, and trading orders are locked.
        </span>
        <button
          onClick={() => disengageKillSwitch()}
          className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs px-3 py-1.5 rounded-md font-semibold shadow-lg transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Disengage & Reset</span>
        </button>
      </div>
    </div>
  );
};
