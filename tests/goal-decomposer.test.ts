import { describe, it, expect, beforeEach, vi } from 'vitest';
import { goalDecomposer, GoalDecomposer } from '../src/core/workflow/goal-decomposer';
import { dynamicPlanner } from '../src/core/dynamic-planner';
import { OllamaAdapter } from '../src/adapters/llm/ollama-adapter';
import { skillRegistry } from '../src/skills/skill-registry';

describe('Phase 4A: Generalized Goal Decomposer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Tier 1: Deterministic Workflow Catalog', () => {
    it('decomposes Files -> Document compound workflow', () => {
      const workflow = goalDecomposer.decomposeDeterministic(
        'Find all PDF files in Downloads and summarize in TextEdit'
      );

      expect(workflow).not.toBeNull();
      expect(workflow!.steps.length).toBe(3);
      expect(workflow!.overallRisk).toBe('MEDIUM');

      // Step 1: files_skill.find_files
      expect(workflow!.steps[0].skillId).toBe('files_skill');
      expect(workflow!.steps[0].action).toBe('find_files');
      expect(workflow!.steps[0].params.path).toBe('~/Downloads');
      expect(workflow!.steps[0].params.query).toBe('pdf');

      // Step 2: document_skill.create_document
      expect(workflow!.steps[1].skillId).toBe('document_skill');
      expect(workflow!.steps[1].action).toBe('create_document');
      expect(workflow!.steps[1].variableBindings?.length).toBe(1);
      expect(workflow!.steps[1].variableBindings![0].targetParam).toBe('content');
      expect(workflow!.steps[1].variableBindings![0].sourceStepId).toBe('step_1');
      expect(workflow!.steps[1].dependencies).toContain('step_1');

      // Step 3: computer_control.open_app
      expect(workflow!.steps[2].skillId).toBe('computer_control');
      expect(workflow!.steps[2].action).toBe('open_app');
      expect(workflow!.steps[2].params.appName).toBe('TextEdit');
    });

    it('decomposes Browser Research -> Document compound workflow', () => {
      const workflow = goalDecomposer.decomposeDeterministic(
        'Search Safari for Quantum Computing and save notes'
      );

      expect(workflow).not.toBeNull();
      expect(workflow!.steps.length).toBe(3);
      expect(workflow!.steps[0].skillId).toBe('browser_skill');
      expect(workflow!.steps[0].action).toBe('navigate');
      expect(workflow!.steps[1].skillId).toBe('document_skill');
      expect(workflow!.steps[1].variableBindings![0].sourcePath).toBe('output.url');
      expect(workflow!.steps[2].skillId).toBe('computer_control');
    });

    it('decomposes System State -> Report workflow', () => {
      const workflow = goalDecomposer.decomposeDeterministic(
        'Check system volume and create status report'
      );

      expect(workflow).not.toBeNull();
      expect(workflow!.steps.length).toBe(2);
      expect(workflow!.steps[0].skillId).toBe('system_skill');
      expect(workflow!.steps[1].skillId).toBe('document_skill');
    });

    it('decomposes Safe File Organization workflow with HIGH risk escalation', () => {
      const workflow = goalDecomposer.decomposeDeterministic(
        'Find invoices in Downloads and move to Documents'
      );

      expect(workflow).not.toBeNull();
      expect(workflow!.overallRisk).toBe('HIGH');
      expect(workflow!.steps[0].skillId).toBe('files_skill');
      expect(workflow!.steps[1].skillId).toBe('files_skill');
      expect(workflow!.steps[1].action).toBe('move_file');
      expect(workflow!.steps[1].riskLevel).toBe('HIGH');
    });

    it('handles Malayalam script compound command', () => {
      const workflow = goalDecomposer.decomposeDeterministic(
        'Downloads ലുള്ള ഫയലുകൾ കണ്ടെത്തി TextEdit ൽ എഴുതൂ'
      );

      expect(workflow).not.toBeNull();
      expect(['ml', 'mixed']).toContain(workflow!.language);
      expect(workflow!.steps.length).toBe(3);
      expect(workflow!.steps[0].skillId).toBe('files_skill');
      expect(workflow!.steps[1].skillId).toBe('document_skill');
    });

    it('handles Manglish compound command', () => {
      const workflow = goalDecomposer.decomposeDeterministic(
        'Downloads il ulla files kandethitu TextEdit il ezhuthu'
      );

      expect(workflow).not.toBeNull();
      expect(workflow!.language).toBe('manglish');
      expect(workflow!.steps.length).toBe(3);
      expect(workflow!.steps[0].skillId).toBe('files_skill');
    });

    it('returns null for uncataloged arbitrary request in deterministic mode', () => {
      const workflow = goalDecomposer.decomposeDeterministic(
        'Write a poem about the monsoon season'
      );
      expect(workflow).toBeNull();
    });
  });

  describe('Tier 2: Local Ollama Fallback', () => {
    it('falls back to null when Ollama is unavailable', async () => {
      const mockOllama = new OllamaAdapter('http://localhost:11434');
      vi.spyOn(mockOllama, 'checkHealth').mockResolvedValue({
        available: false,
        models: [],
        error: 'Connection refused',
      });

      const decomposer = new GoalDecomposer(mockOllama);
      const res = await decomposer.decompose('Analyze system battery and create summary report');
      // Should match Tier 1 pattern since it's in catalog!
      expect(res).not.toBeNull();

      // For something completely uncataloged:
      const uncataloged = await decomposer.decompose('Custom query not in catalog');
      expect(uncataloged).toBeNull();
    });

    it('validates and accepts schema-compliant Ollama plan using registered skills', async () => {
      const mockOllama = new OllamaAdapter('http://localhost:11434');
      vi.spyOn(mockOllama, 'checkHealth').mockResolvedValue({
        available: true,
        models: ['llama3.2:latest'],
      });

      const validOllamaJson = JSON.stringify({
        id: 'mock-plan-1',
        goal: 'Specialized compound multi-skill request',
        language: 'en',
        interpretedIntent: 'Custom Multi-Skill Plan',
        targetApp: 'Safari',
        overallRisk: 'LOW',
        currentStepIndex: 0,
        status: 'PENDING_APPROVAL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: [
          {
            id: 'step_1',
            stepNumber: 1,
            title: 'Browse destination',
            skillId: 'browser_skill',
            action: 'navigate',
            params: { url: 'https://example.com' },
            expectedResult: 'Navigated to page',
            riskLevel: 'LOW',
            timeoutMs: 5000,
            retryPolicy: { maxRetries: 1, backoffMs: 200, allowReplanOnExhaustion: false },
          },
        ],
      });

      vi.spyOn(mockOllama, 'generatePlanPrompt').mockResolvedValue(validOllamaJson);

      const decomposer = new GoalDecomposer(mockOllama);
      const res = await decomposer.decomposeWithOllama('Specialized compound multi-skill request');

      expect(res).not.toBeNull();
      expect(res!.id).toBe('mock-plan-1');
      expect(res!.steps[0].skillId).toBe('browser_skill');
    });

    it('rejects Ollama plan containing unregistered skill ID', async () => {
      const mockOllama = new OllamaAdapter('http://localhost:11434');
      vi.spyOn(mockOllama, 'checkHealth').mockResolvedValue({
        available: true,
        models: ['llama3.2:latest'],
      });

      const invalidSkillJson = JSON.stringify({
        id: 'mock-plan-2',
        goal: 'Attempt to run shell script',
        language: 'en',
        interpretedIntent: 'Dangerous Plan',
        overallRisk: 'LOW',
        currentStepIndex: 0,
        status: 'PENDING_APPROVAL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        steps: [
          {
            id: 'step_1',
            stepNumber: 1,
            title: 'Run arbitrary bash',
            skillId: 'unregistered_bash_runner_hack',
            action: 'exec',
            params: { cmd: 'rm -rf /' },
            expectedResult: 'Done',
            riskLevel: 'LOW',
            timeoutMs: 5000,
            retryPolicy: { maxRetries: 0, backoffMs: 0, allowReplanOnExhaustion: false },
          },
        ],
      });

      vi.spyOn(mockOllama, 'generatePlanPrompt').mockResolvedValue(invalidSkillJson);

      const decomposer = new GoalDecomposer(mockOllama);
      const res = await decomposer.decomposeWithOllama('Attempt to run shell script');

      expect(res).toBeNull();
    });

    it('rejects malformed non-JSON Ollama output', async () => {
      const mockOllama = new OllamaAdapter('http://localhost:11434');
      vi.spyOn(mockOllama, 'checkHealth').mockResolvedValue({
        available: true,
        models: ['llama3.2:latest'],
      });
      vi.spyOn(mockOllama, 'generatePlanPrompt').mockResolvedValue('I am unable to format this as JSON.');

      const decomposer = new GoalDecomposer(mockOllama);
      const res = await decomposer.decomposeWithOllama('Some random request');

      expect(res).toBeNull();
    });
  });

  describe('DynamicPlanner Integration', () => {
    it('decomposes compound Files -> Document workflow through DynamicPlanner', () => {
      const task = dynamicPlanner.decomposeGoal(
        'Find all PDF files in Downloads and summarize in TextEdit'
      );

      expect(task).not.toBeNull();
      expect(task!.steps.length).toBe(3);
      expect(task!.steps[0].skillId).toBe('files_skill');
      expect(task!.steps[1].skillId).toBe('document_skill');
      expect(task!.steps[2].skillId).toBe('computer_control');

      const actionItems = dynamicPlanner.toActionItems(task!);
      expect(actionItems.length).toBe(3);
      expect(actionItems[0].skillId).toBe('files_skill');
      expect(actionItems[1].skillId).toBe('document_skill');
      expect(actionItems[2].skillId).toBe('computer_control');
    });

    it('preserves single-domain browser search in DynamicPlanner without regression', () => {
      const task = dynamicPlanner.decomposeGoal('Open Safari and search for Janki AI');
      expect(task).not.toBeNull();
      expect(task!.steps.length).toBe(3);
      expect(task!.steps[0].action).toBe('open_app');
      expect(task!.steps[2].action).toBe('submit_search');
    });
  });
});
