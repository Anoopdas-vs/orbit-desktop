import { create } from 'zustand';
import { TradingMode, TradingLimits } from '../types/trading';
import { RegisteredProject } from '../types/projects';
import { killSwitch } from '../core/kill-switch';
import { defaultPolicyEngine, DEFAULT_POLICY_CONFIG } from '../core/policy-engine';
import { binanceTradingAdapter } from '../adapters/trading/binance-adapter';

interface SafetyState {
  killSwitchActive: boolean;
  killSwitchReason: string;
  tradingMode: TradingMode;
  tradingLimits: TradingLimits;
  autoApproveLowRisk: boolean;
  registeredProjects: RegisteredProject[];
  activeProjectId: string;
  allowedApps: string[];

  // Actions
  engageKillSwitch: (reason: string, triggeredBy?: 'user-ui' | 'voice-emergency-stop') => void;
  disengageKillSwitch: () => void;
  setTradingMode: (mode: TradingMode) => void;
  updateTradingLimits: (limits: Partial<TradingLimits>) => void;
  setAutoApproveLowRisk: (enabled: boolean) => void;
  addProject: (project: RegisteredProject) => void;
  setActiveProject: (id: string) => void;
}

export const useSafetyStore = create<SafetyState>((set, get) => ({
  killSwitchActive: killSwitch.isEngaged(),
  killSwitchReason: '',
  tradingMode: 'PAPER_TRADING',
  tradingLimits: binanceTradingAdapter.getLimits(),
  autoApproveLowRisk: true,
  allowedApps: [...DEFAULT_POLICY_CONFIG.allowedApplications],
  registeredProjects: [
    {
      id: 'proj-default-1',
      name: 'Web App Client',
      rootPath: '/Users/anoopdasvs/Downloads/Janki_M book_automation',
      defaultBranch: 'main',
      framework: 'React / Vite',
      packageScripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        test: 'vitest',
        lint: 'eslint .'
      },
      instructions: '# Project Conventions\n- macOS native dark UI\n- Strict zero-secret policy\n- Vitest automated tests required',
      allowedCommands: ['npm test', 'npm run dev', 'npm run build', 'npm run lint', 'git status', 'git diff'],
      createdAt: new Date().toISOString(),
    }
  ],
  activeProjectId: 'proj-default-1',

  engageKillSwitch: (reason: string, triggeredBy: 'user-ui' | 'voice-emergency-stop' = 'user-ui') => {
    killSwitch.engage(reason, triggeredBy);
    set({
      killSwitchActive: true,
      killSwitchReason: reason,
      tradingMode: 'OFF'
    });
    defaultPolicyEngine.updateConfig({ tradingEnabled: false, tradingMode: 'OFF' });
  },

  disengageKillSwitch: () => {
    killSwitch.disengage();
    set({
      killSwitchActive: false,
      killSwitchReason: '',
      tradingMode: 'PAPER_TRADING'
    });
    defaultPolicyEngine.updateConfig({ tradingEnabled: true, tradingMode: 'PAPER_TRADING' });
  },

  setTradingMode: (mode: TradingMode) => {
    binanceTradingAdapter.setMode(mode);
    defaultPolicyEngine.updateConfig({
      tradingMode: mode,
      tradingEnabled: mode !== 'OFF'
    });
    set({ tradingMode: mode });
  },

  updateTradingLimits: (limits: Partial<TradingLimits>) => {
    binanceTradingAdapter.updateLimits(limits);
    set({ tradingLimits: binanceTradingAdapter.getLimits() });
  },

  setAutoApproveLowRisk: (enabled: boolean) => {
    defaultPolicyEngine.updateConfig({ autoApproveLowRisk: enabled });
    set({ autoApproveLowRisk: enabled });
  },

  addProject: (project: RegisteredProject) => {
    set((state) => ({
      registeredProjects: [...state.registeredProjects, project],
      activeProjectId: project.id,
    }));
  },

  setActiveProject: (id: string) => {
    set({ activeProjectId: id });
  },
}));
