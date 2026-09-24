import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Activity,
  Lock,
  Cpu,
} from 'lucide-react';
import { useSafetyStore } from '../../state/useSafetyStore';
import { killSwitch } from '../../core/kill-switch';

export const SafetyCenterView: React.FC = () => {
  const { killSwitchActive, killSwitchReason, engageKillSwitch, disengageKillSwitch, autoApproveLowRisk, setAutoApproveLowRisk } = useSafetyStore();
  const [customReason, setCustomReason] = useState('Manual emergency stop via Safety Center');

  const runningCount = killSwitch.getRunningProcessCount();

  const riskTiers = [
    {
      level: 'LOW',
      badgeClass: 'bg-emerald-950 text-emerald-400 border-emerald-800',
      description: 'Open approved app, read git status, check market price, read local project files.',
      actionPolicy: autoApproveLowRisk ? 'Automatic Execution Enabled' : '1-Click Confirmation Required',
    },
    {
      level: 'MEDIUM',
      badgeClass: 'bg-amber-950 text-amber-400 border-amber-800',
      description: 'Start dev server, run test suites, create git branch, draft feature spec.',
      actionPolicy: 'Visible 1-Click Approval Required',
    },
    {
      level: 'HIGH',
      badgeClass: 'bg-orange-950 text-orange-400 border-orange-800',
      description: 'Git commit, push branch to remote, prepare PR, staging deployment, authenticated balance reads.',
      actionPolicy: 'Diff Review & Explicit Single Confirmation',
    },
    {
      level: 'CRITICAL',
      badgeClass: 'bg-rose-950 text-rose-300 border-rose-800',
      description: 'Production deployment, live spot order submission, database migrations, force push.',
      actionPolicy: 'Exact Phrase Typing Verification + Dual In-App Confirmation',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          Safety, Governance & Kill Switch Center
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Master controls for system isolation, active background subprocess aborts, and risk tier evaluation.
        </p>
      </div>

      {/* Emergency Stop Hero Section */}
      <div className={`rounded-2xl p-6 border transition shadow-2xl ${
        killSwitchActive
          ? 'bg-rose-950/80 border-rose-800 text-rose-100'
          : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-950 px-2 py-0.5 rounded-full border border-rose-800">
              System State: {killSwitchActive ? 'LOCKED / EMERGENCY STOP' : 'NORMAL / SECURED'}
            </span>
            <h3 className="text-base font-bold">
              {killSwitchActive
                ? 'Execution Freeze Active'
                : 'Emergency Kill Switch Available'}
            </h3>
            <p className="text-xs text-slate-400 max-w-xl">
              {killSwitchActive
                ? `Reason: ${killSwitchReason}. All external actions, trading orders, and shell executions are blocked.`
                : 'Engaging will immediately abort all active subprocesses, disable trading, and refuse any destructive or write actions.'}
            </p>
          </div>

          <div>
            {killSwitchActive ? (
              <button
                onClick={() => disengageKillSwitch()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg flex items-center space-x-2 transition"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Disengage & Restore System</span>
              </button>
            ) : (
              <button
                onClick={() => engageKillSwitch(customReason, 'user-ui')}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg flex items-center space-x-2 transition"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Engage Emergency Kill Switch</span>
              </button>
            )}
          </div>
        </div>

        {/* Process Activity Monitor */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-2">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>Monitored Child Processes: <strong>{runningCount} active</strong></span>
          </div>
          <div className="flex items-center space-x-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Secret Redaction Filter: <strong>Armed</strong></span>
          </div>
        </div>
      </div>

      {/* 4-Tier Risk Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Four-Tier Risk Evaluation Matrix
        </h3>

        <div className="space-y-3">
          {riskTiers.map((tier) => (
            <div
              key={tier.level}
              className="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono ${tier.badgeClass}`}>
                    {tier.level} RISK
                  </span>
                  <span className="font-semibold text-slate-200">{tier.actionPolicy}</span>
                </div>
                <div className="text-slate-400 text-[11px]">{tier.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Safety Preferences */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Automation Preferences
        </h3>

        <label className="flex items-center justify-between cursor-pointer text-xs text-slate-300">
          <div>
            <div className="font-semibold text-slate-200">Auto-Approve LOW Risk Actions</div>
            <div className="text-[11px] text-slate-400">
              When disabled, even safe actions like opening approved apps or reading git status ask for approval.
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoApproveLowRisk}
            onChange={(e) => setAutoApproveLowRisk(e.target.checked)}
            className="rounded bg-slate-950 border-slate-700 text-blue-500 focus:ring-0"
          />
        </label>
      </div>
    </div>
  );
};
