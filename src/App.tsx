import React, { useState, useEffect } from 'react';
import { DesktopFrame } from './components/layout/DesktopFrame';
import { Sidebar, ActiveView } from './components/layout/Sidebar';
import { KillSwitchBanner } from './components/layout/KillSwitchBanner';
import { CommandCenterView } from './components/command/CommandCenterView';
import { DevWorkflowView } from './components/dev-workflow/DevWorkflowView';
import { TradingView } from './components/trading/TradingView';
import { AuditView } from './components/audit/AuditView';
import { ProjectsView } from './components/projects/ProjectsView';
import { SafetyCenterView } from './components/safety/SafetyCenterView';
import { SettingsView } from './components/settings/SettingsView';
import { PlanReviewCard } from './components/approval/PlanReviewCard';
import { useCommandStore } from './state/useCommandStore';
import { orbitDb } from './db/database';
import { ShieldCheck } from 'lucide-react';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ActiveView>('command');
  const { currentPlan } = useCommandStore();

  useEffect(() => {
    // Initialize SQLite persistence on app mount
    orbitDb.initialize().catch((err) => {
      console.warn('Orbit SQLite initialization notice:', err);
    });
  }, []);

  return (
    <DesktopFrame>
      <Sidebar currentView={currentView} onSelectView={setCurrentView} />

      <main className="flex-1 flex flex-col min-w-0 bg-orbit-bg overflow-hidden relative">
        <KillSwitchBanner />

        {currentView === 'command' && <CommandCenterView />}

        {currentView === 'approvals' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                Action Plan & Approval Queue
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Review and approve actions before execution. Medium, high, and critical actions require your explicit sign-off.
              </p>
            </div>

            {currentPlan ? (
              <PlanReviewCard plan={currentPlan} />
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs font-mono">
                No action plans currently pending approval. Say or type a command in the Command Center.
              </div>
            )}
          </div>
        )}

        {currentView === 'projects' && <ProjectsView />}
        {currentView === 'dev' && <DevWorkflowView />}
        {currentView === 'trading' && <TradingView />}
        {currentView === 'audit' && <AuditView />}
        {currentView === 'safety' && <SafetyCenterView />}
        {currentView === 'settings' && <SettingsView />}
      </main>
    </DesktopFrame>
  );
};

export default App;
