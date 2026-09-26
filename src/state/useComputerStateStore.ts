import { create } from 'zustand';
import { ComputerStateInfo } from '../adapters/native/tauri-bridge';

export interface ComputerWorkingMemory {
  activeApp: string;
  activeWindow: string;
  runningApps: string[];
  volume: number;
  isMuted: boolean;
  currentTaskId: string | null;
  currentTaskGoal: string | null;
  currentStepIndex: number;
  totalSteps: number;
  lastAction: string | null;
  expectedState: string | null;
  isVerified: boolean;
  retryCount: number;
  lastRecoveryReason: string | null;

  // Actions
  updateSystemState: (info: ComputerStateInfo) => void;
  startTask: (taskId: string, goal: string, totalSteps: number) => void;
  updateStepProgress: (params: {
    stepIndex: number;
    action: string;
    expectedState: string;
    retryCount?: number;
  }) => void;
  markStepVerified: (verified: boolean) => void;
  recordRecovery: (reason: string) => void;
  finishTask: () => void;
  reset: () => void;
}

export const useComputerStateStore = create<ComputerWorkingMemory>((set) => ({
  activeApp: 'Finder',
  activeWindow: '',
  runningApps: [],
  volume: 50,
  isMuted: false,
  currentTaskId: null,
  currentTaskGoal: null,
  currentStepIndex: 0,
  totalSteps: 0,
  lastAction: null,
  expectedState: null,
  isVerified: false,
  retryCount: 0,
  lastRecoveryReason: null,

  updateSystemState: (info) =>
    set({
      activeApp: info.activeApp,
      activeWindow: info.activeWindow,
      runningApps: info.runningApps,
      volume: info.volume,
      isMuted: info.isMuted,
    }),

  startTask: (taskId, goal, totalSteps) =>
    set({
      currentTaskId: taskId,
      currentTaskGoal: goal,
      currentStepIndex: 0,
      totalSteps,
      isVerified: false,
      retryCount: 0,
      lastRecoveryReason: null,
    }),

  updateStepProgress: ({ stepIndex, action, expectedState, retryCount = 0 }) =>
    set({
      currentStepIndex: stepIndex,
      lastAction: action,
      expectedState,
      retryCount,
      isVerified: false,
    }),

  markStepVerified: (verified) => set({ isVerified: verified }),

  recordRecovery: (reason) =>
    set((state) => ({
      lastRecoveryReason: reason,
      retryCount: state.retryCount + 1,
    })),

  finishTask: () =>
    set({
      currentTaskId: null,
      currentTaskGoal: null,
      currentStepIndex: 0,
      totalSteps: 0,
      isVerified: true,
      retryCount: 0,
      lastRecoveryReason: null,
    }),

  reset: () =>
    set({
      currentTaskId: null,
      currentTaskGoal: null,
      currentStepIndex: 0,
      totalSteps: 0,
      lastAction: null,
      expectedState: null,
      isVerified: false,
      retryCount: 0,
      lastRecoveryReason: null,
    }),
}));
