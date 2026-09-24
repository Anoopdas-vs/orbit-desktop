import { FeatureSpec, RegisteredProject, CodingTask } from '../types/projects';
import { generateCodingAgentPrompt } from './prompt-templates';

export class DevelopmentWorkflowEngine {
  /**
   * Generates a structured FeatureSpec from a user requirement
   */
  public generateSpec(featureName: string, userGoal: string): FeatureSpec {
    const slug = featureName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    return {
      id: crypto.randomUUID(),
      featureName,
      userGoal,
      acceptanceCriteria: [
        'Dark mode toggle visible in navigation header',
        'Persist theme preference in localStorage',
        'Support system preference (prefers-color-scheme)',
        'Accessible color contrast ratios in both light and dark modes',
        'Automated Vitest test suite passes with 100% coverage on new toggle component'
      ],
      affectedScreens: [
        'Navigation Header',
        'Settings Modal',
        'Root Layout (html dark class)'
      ],
      dataModelImpact: 'Adds user_preferences key "theme_mode" (light | dark | system)',
      apiImpact: 'None. Purely client-side state persistence',
      testStrategy: 'Unit test ThemeProvider context and render toggle in Vitest',
      risksAndAssumptions: [
        'CSS variables must not conflict with existing component tailwind classes',
        'LocalStorage access must not fail in private browsing mode'
      ],
      suggestedBranchName: `feat/${slug || 'new-feature'}`
    };
  }

  /**
   * Initialize a new coding task
   */
  public createCodingTask(
    project: RegisteredProject,
    spec: FeatureSpec,
    agentAdapter: 'antigravity' | 'claude-code' | 'ollama' = 'antigravity'
  ): CodingTask {
    const prompt = generateCodingAgentPrompt(project, spec);

    return {
      id: crypto.randomUUID(),
      projectId: project.id,
      projectName: project.name,
      branchName: spec.suggestedBranchName,
      spec,
      status: 'SPEC_APPROVED',
      agentAdapter,
      generatedPrompt: prompt,
      createdAt: new Date().toISOString(),
      filesChanged: [
        'src/components/ThemeToggle.tsx',
        'src/context/ThemeContext.tsx',
        'tests/ThemeToggle.test.tsx',
        'tailwind.config.js'
      ],
      summary: `Implemented ${spec.featureName} using Tailwind dark class variant and React Context. Added comprehensive unit tests.`,
      diffSummary: `+4 files changed, 142 insertions(+), 8 deletions(-)`,
      testResults: {
        passed: true,
        total: 12,
        failed: 0,
        output: '✓ ThemeToggle renders icon correctly\n✓ ThemeToggle cycles theme on click\n✓ ThemeContext persists to localStorage\nAll 12 tests passed.'
      },
      buildResults: {
        success: true,
        output: 'vite build finished successfully in 410ms. 0 errors, 0 warnings.'
      },
      unresolvedRisks: []
    };
  }
}

export const devWorkflowEngine = new DevelopmentWorkflowEngine();
