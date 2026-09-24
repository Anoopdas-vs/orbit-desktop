import React from 'react';
import {
  Compass,
  ShieldCheck,
  FolderGit2,
  Code2,
  TrendingUp,
  FileText,
  AlertTriangle,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { useCommandStore } from '../../state/useCommandStore';

export type ActiveView =
  | 'command'
  | 'approvals'
  | 'projects'
  | 'dev'
  | 'trading'
  | 'audit'
  | 'safety'
  | 'settings';

interface SidebarProps {
  currentView: ActiveView;
  onSelectView: (view: ActiveView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onSelectView }) => {
  const { currentPlan } = useCommandStore();

  const pendingApprovalsCount =
    currentPlan?.actions.filter((a) => a.status === 'PENDING_APPROVAL').length || 0;

  const navItems = [
    { id: 'command' as ActiveView, label: 'Command Center', icon: Compass },
    {
      id: 'approvals' as ActiveView,
      label: 'Approvals',
      icon: ShieldCheck,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
    },
    { id: 'projects' as ActiveView, label: 'Projects', icon: FolderGit2 },
    { id: 'dev' as ActiveView, label: 'Dev Workflow', icon: Code2 },
    { id: 'trading' as ActiveView, label: 'Trading Desk', icon: TrendingUp },
    { id: 'audit' as ActiveView, label: 'Audit Log', icon: FileText },
    { id: 'safety' as ActiveView, label: 'Safety Center', icon: AlertTriangle },
    { id: 'settings' as ActiveView, label: 'Settings', icon: Sliders },
  ];

  return (
    <aside className="w-56 bg-slate-950/60 border-r border-slate-800/80 flex flex-col justify-between py-3 select-none">
      <div className="space-y-1 px-2">
        <div className="px-3 py-2 mb-2 flex items-center gap-2 text-xs font-semibold text-slate-400 tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>WORKSPACE</span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition ${
                isActive
                  ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="px-4 pt-3 border-t border-slate-800/80 text-[10px] text-slate-400 flex flex-col gap-0.5">
        <span className="font-semibold text-slate-300">Janki macOS Assistant</span>
        <span>Version 0.1.0 (Sonoma+)</span>
        <span className="text-emerald-400/90 flex items-center gap-1 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Offline Safety Shield Active
        </span>
      </div>
    </aside>
  );
};
