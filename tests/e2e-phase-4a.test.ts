import { describe, it, expect, beforeEach, vi } from 'vitest';
import { goalDecomposer } from '../src/core/workflow/goal-decomposer';
import { dynamicPlanner } from '../src/core/dynamic-planner';
import { variableResolver } from '../src/core/workflow/variable-resolver';
import { useCommandStore } from '../src/state/useCommandStore';
import { useAuditStore } from '../src/state/useAuditStore';
import { killSwitch } from '../src/core/kill-switch';
import { nativeBridge } from '../src/adapters/native/tauri-bridge';

describe('Phase 4A: End-to-End Real-World Compound Workflow Scenarios', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    killSwitch.disengage();
    useCommandStore.setState({
      currentPlan: null,
      assistantResponse: null,
      isExecuting: false,
      isDryRun: false,
    });
    useAuditStore.setState({
      executionLogs: [],
      approvalEvents: [],
      entries: [],
      tradeJournal: [],
    });
  });

  it('executes a complete 3-step compound workflow: Files -> Variable Pipe -> Document -> Computer Control', async () => {
    // Mock native macOS operations
    vi.spyOn(nativeBridge, 'execCommand').mockResolvedValue({
      success: true,
      command: 'mdfind -name "pdf"',
      stdout: '/Users/anoopdasvs/Downloads/Q3_Financial_Summary.pdf',
      stderr: '',
      exitCode: 0,
    });
    const createDocSpy = vi.spyOn(nativeBridge, 'createFile').mockResolvedValue(true);
    const openAppSpy = vi.spyOn(nativeBridge, 'openApp').mockResolvedValue({
      success: true,
      app: 'TextEdit',
      message: 'TextEdit opened successfully',
    });

    // 1. Goal Decomposition
    const userPrompt = 'Find all PDF files in Downloads and summarize in TextEdit';
    const task = dynamicPlanner.decomposeGoal(userPrompt);
    expect(task).not.toBeNull();
    expect(task!.steps.length).toBe(3);

    // 2. Convert to ActionItems for Plan Execution
    const actionItems = dynamicPlanner.toActionItems(task!);
    expect(actionItems.length).toBe(3);

    const plan = {
      id: task!.id,
      createdAt: new Date().toISOString(),
      userPrompt,
      interpretedIntent: task!.interpretedIntent,
      overallRisk: task!.overallRisk,
      isDryRun: false,
      status: 'AWAITING_APPROVAL' as const,
      actions: actionItems,
    };

    useCommandStore.setState({ currentPlan: plan });

    // 3. Execute Step 1: files_skill.find_files
    await useCommandStore.getState().approveAction(actionItems[0].id);
    let currentPlan = useCommandStore.getState().currentPlan!;
    expect(currentPlan.actions[0].status).toBe('COMPLETED');
    expect(currentPlan.actions[0].output).toBeDefined();

    // 4. Execute Step 2: document_skill.create_document
    // Variable resolver pipes {{step_1.output.files}} into the document content parameter
    await useCommandStore.getState().approveAction(actionItems[1].id);
    currentPlan = useCommandStore.getState().currentPlan!;
    expect(currentPlan.actions[1].status).toBe('COMPLETED');
    expect(createDocSpy).toHaveBeenCalledWith(
      '~/Downloads/Discovered-Files-Summary.txt',
      expect.stringContaining('/Users/anoopdasvs/Downloads/Q3_Financial_Summary.pdf'),
      false
    );

    // 5. Execute Step 3: computer_control.open_app
    await useCommandStore.getState().approveAction(actionItems[2].id);
    currentPlan = useCommandStore.getState().currentPlan!;
    expect(currentPlan.actions[2].status).toBe('COMPLETED');
    expect(openAppSpy).toHaveBeenCalledWith('TextEdit');

    // 6. Verify Audit Logs recorded truthful execution
    const audit = useAuditStore.getState();
    expect(audit.executionLogs.length).toBe(3);
    expect(audit.executionLogs.every((l) => l.status === 'SUCCESS')).toBe(true);
  });
});
