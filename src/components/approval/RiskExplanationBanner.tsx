import React from 'react';
import { Shield, ShieldAlert, AlertTriangle, Info, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { RiskLevel } from '../../types/action-plan';

export interface RiskExplanationBannerProps {
  riskLevel: RiskLevel;
  actionTitle: string;
  description: string;
  targetApp?: string;
  targetPath?: string;
  affectedItemsCount?: number;
  isReversible: boolean;
  onApprove: () => void;
  onReject: () => void;
  onOpenDiff?: () => void;
  isApproving?: boolean;
}

export const RiskExplanationBanner: React.FC<RiskExplanationBannerProps> = ({
  riskLevel,
  actionTitle,
  description,
  targetApp,
  targetPath,
  affectedItemsCount,
  isReversible,
  onApprove,
  onReject,
  onOpenDiff,
  isApproving = false,
}) => {
  const getBadgeStyle = () => {
    switch (riskLevel) {
      case 'CRITICAL':
        return {
          bg: 'bg-rose-950/80 border-rose-600/80 text-rose-200',
          badge: 'bg-rose-600 text-white',
          icon: <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />,
        };
      case 'HIGH':
        return {
          bg: 'bg-orange-950/70 border-orange-600/70 text-orange-200',
          badge: 'bg-orange-600 text-white',
          icon: <AlertTriangle className="w-5 h-5 text-orange-400" />,
        };
      case 'MEDIUM':
        return {
          bg: 'bg-amber-950/60 border-amber-600/60 text-amber-200',
          badge: 'bg-amber-600 text-white',
          icon: <Info className="w-5 h-5 text-amber-400" />,
        };
      case 'LOW':
      default:
        return {
          bg: 'bg-emerald-950/50 border-emerald-600/50 text-emerald-200',
          badge: 'bg-emerald-600 text-white',
          icon: <Shield className="w-5 h-5 text-emerald-400" />,
        };
    }
  };

  const style = getBadgeStyle();

  return (
    <div className={`rounded-xl border p-4 shadow-lg backdrop-blur-sm transition-all ${style.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="mt-0.5">{style.icon}</div>
          <div>
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${style.badge}`}>
                {riskLevel} RISK
              </span>
              <h4 className="font-semibold text-sm text-slate-100">{actionTitle}</h4>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{description}</p>

            {/* Blast radius details */}
            <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-slate-300 font-mono">
              {targetApp && (
                <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60">
                  App: <strong className="text-slate-100">{targetApp}</strong>
                </span>
              )}
              {targetPath && (
                <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60 truncate max-w-xs">
                  Target: <strong className="text-slate-100">{targetPath}</strong>
                </span>
              )}
              {affectedItemsCount !== undefined && affectedItemsCount > 0 && (
                <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60">
                  Items: <strong className="text-slate-100">{affectedItemsCount}</strong>
                </span>
              )}
              <span className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60">
                {isReversible ? (
                  <span className="text-emerald-400">Reversible</span>
                ) : (
                  <span className="text-rose-400">Irreversible Action</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          {onOpenDiff && (
            <button
              onClick={onOpenDiff}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-600/80 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Review Diff</span>
            </button>
          )}

          <button
            onClick={onReject}
            disabled={isApproving}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-600/80 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Reject</span>
          </button>

          <button
            onClick={onApprove}
            disabled={isApproving}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50 ${
              riskLevel === 'CRITICAL'
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : riskLevel === 'HIGH'
                ? 'bg-orange-600 hover:bg-orange-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{riskLevel === 'CRITICAL' ? 'Confirm Action' : 'Approve'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
