import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkflowInspectorModal } from '../src/components/workflow/WorkflowInspectorModal';
import { useWorkflowStore } from '../src/state/useWorkflowStore';
import { workflowEngine } from '../src/core/workflow/workflow-engine';
import { WorkflowDefinition } from '../src/types/workflow';

describe('Phase 4C: Live Workflow Inspector Modal', () => {
  const sampleWorkflow: WorkflowDefinition = {
    id: 'wf-inspector-test',
    goal: 'Process user invoice: token=secret_password_123',
    language: 'en',
    interpretedIntent: 'Process invoice',
    targetApp: 'Finder',
    steps: [
      {
        id: 'step-1',
        stepNumber: 1,
        title: 'Locate Invoices',
        skillId: 'files_skill',
        action: 'find_files',
        params: { path: '/Users/test/Downloads', apiKey: 'sk-abcdef123456' },
        preconditions: {},
        expectedResult: 'Invoices found',
        verificationMethod: 'command_success',
        riskLevel: 'LOW',
        timeoutMs: 4000,
        retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: false },
      },
      {
        id: 'step-2',
        stepNumber: 2,
        title: 'Submit High Risk Payment',
        skillId: 'office_skill',
        action: 'export_pdf',
        params: { doc: 'invoice.pdf' },
        preconditions: {},
        expectedResult: 'Document exported',
        verificationMethod: 'command_success',
        riskLevel: 'HIGH',
        timeoutMs: 5000,
        retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: false },
      },
    ],
    overallRisk: 'HIGH',
    currentStepIndex: 0,
    status: 'RUNNING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    useWorkflowStore.getState().reset();
  });

  it('does not render in the DOM when isInspectorOpen is false', () => {
    useWorkflowStore.getState().setWorkflow(sampleWorkflow);
    useWorkflowStore.getState().closeInspector();

    const { container } = render(<WorkflowInspectorModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders workflow goal, step cards, and progress bar when open', () => {
    useWorkflowStore.getState().setWorkflow(sampleWorkflow);
    useWorkflowStore.getState().openInspector();
    useWorkflowStore.getState().setStatus('RUNNING');

    render(<WorkflowInspectorModal />);

    expect(screen.getByText(/Workflow Inspector & State Observability/i)).toBeInTheDocument();
    expect(screen.getByText(/Process user invoice/i)).toBeInTheDocument();
    expect(screen.getByText(/Locate Invoices/i)).toBeInTheDocument();
    expect(screen.getByText(/Submit High Risk Payment/i)).toBeInTheDocument();
    expect(screen.getByText(/Running/i)).toBeInTheDocument();
    expect(screen.getByText(/0\/2 Steps/i)).toBeInTheDocument();
  });

  it('redacts sensitive credentials in step parameters', () => {
    useWorkflowStore.getState().setWorkflow(sampleWorkflow);
    useWorkflowStore.getState().openInspector();

    render(<WorkflowInspectorModal />);

    // Secret API key must be scrubbed by redactSensitiveData
    expect(screen.queryByText(/sk-abcdef123456/i)).toBeNull();
  });

  it('allows pausing a running workflow', () => {
    const pauseSpy = vi.spyOn(workflowEngine, 'pauseWorkflow');

    useWorkflowStore.getState().setWorkflow(sampleWorkflow);
    useWorkflowStore.getState().openInspector();
    useWorkflowStore.getState().setStatus('RUNNING');

    render(<WorkflowInspectorModal />);

    const pauseBtn = screen.getByRole('button', { name: /Pause/i });
    fireEvent.click(pauseBtn);

    expect(pauseSpy).toHaveBeenCalledWith('wf-inspector-test');
    expect(useWorkflowStore.getState().status).toBe('PAUSED_FOR_APPROVAL');
  });

  it('allows resuming a paused workflow', async () => {
    const resumeSpy = vi.spyOn(workflowEngine, 'resumeWorkflow').mockResolvedValue(null);

    useWorkflowStore.getState().setWorkflow(sampleWorkflow);
    useWorkflowStore.getState().openInspector();
    useWorkflowStore.getState().setStatus('PAUSED_FOR_APPROVAL');

    render(<WorkflowInspectorModal />);

    const resumeBtn = screen.getByRole('button', { name: /Resume/i });
    fireEvent.click(resumeBtn);

    expect(resumeSpy).toHaveBeenCalledWith('wf-inspector-test');
    expect(useWorkflowStore.getState().status).toBe('RUNNING');
  });

  it('closes inspector when close button is clicked', () => {
    useWorkflowStore.getState().setWorkflow(sampleWorkflow);
    useWorkflowStore.getState().openInspector();

    render(<WorkflowInspectorModal />);

    const closeBtn = screen.getByRole('button', { name: /Close$/i });
    fireEvent.click(closeBtn);

    expect(useWorkflowStore.getState().isInspectorOpen).toBe(false);
  });
});
