import { create } from 'zustand';
import {
  WorkflowDefinition,
  WorkflowStatus,
  StepExecutionRecord,
  WorkflowExecutionResult,
} from '../types/workflow';

interface WorkflowState {
  activeWorkflow: WorkflowDefinition | null;
  status: WorkflowStatus;
  currentStepIndex: number;
  stepRecords: StepExecutionRecord[];
  isInspectorOpen: boolean;
  lastExecutionResult: WorkflowExecutionResult | null;

  // Actions
  setWorkflow: (workflow: WorkflowDefinition | null) => void;
  setStatus: (status: WorkflowStatus) => void;
  updateStepProgress: (index: number, record?: StepExecutionRecord) => void;
  setLastResult: (result: WorkflowExecutionResult | null) => void;
  openInspector: () => void;
  closeInspector: () => void;
  toggleInspector: () => void;
  reset: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  activeWorkflow: null,
  status: 'DRAFT',
  currentStepIndex: 0,
  stepRecords: [],
  isInspectorOpen: false,
  lastExecutionResult: null,

  setWorkflow: (workflow) =>
    set({
      activeWorkflow: workflow,
      status: workflow?.status || 'DRAFT',
      currentStepIndex: workflow?.currentStepIndex || 0,
      stepRecords: [],
    }),

  setStatus: (status) =>
    set((state) => ({
      status,
      activeWorkflow: state.activeWorkflow
        ? { ...state.activeWorkflow, status }
        : null,
    })),

  updateStepProgress: (index, record) =>
    set((state) => ({
      currentStepIndex: index,
      stepRecords: record
        ? [...state.stepRecords.filter((r) => r.stepId !== record.stepId), record]
        : state.stepRecords,
    })),

  setLastResult: (result) => set({ lastExecutionResult: result }),

  openInspector: () => set({ isInspectorOpen: true }),
  closeInspector: () => set({ isInspectorOpen: false }),
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),

  reset: () =>
    set({
      activeWorkflow: null,
      status: 'DRAFT',
      currentStepIndex: 0,
      stepRecords: [],
      isInspectorOpen: false,
      lastExecutionResult: null,
    }),
}));
