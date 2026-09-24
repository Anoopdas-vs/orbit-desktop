export interface RegisteredProject {
  id: string;
  name: string;
  rootPath: string;
  defaultBranch: string;
  framework?: string;
  allowedCommands: string[];
  packageScripts: Record<string, string>;
  instructions?: string;
  createdAt: string;
}

export interface FeatureSpec {
  id: string;
  featureName: string;
  userGoal: string;
  acceptanceCriteria: string[];
  affectedScreens: string[];
  dataModelImpact: string;
  apiImpact: string;
  testStrategy: string;
  risksAndAssumptions: string[];
  suggestedBranchName: string;
}

export interface CodingTask {
  id: string;
  projectId: string;
  projectName: string;
  branchName: string;
  spec: FeatureSpec;
  status: 'DRAFT' | 'SPEC_APPROVED' | 'BRANCH_CREATED' | 'AGENT_RUNNING' | 'TESTS_PASSED' | 'READY_FOR_PR' | 'COMPLETED' | 'FAILED';
  agentAdapter: 'antigravity' | 'claude-code' | 'ollama';
  generatedPrompt?: string;
  createdAt: string;
  completedAt?: string;
  filesChanged: string[];
  summary?: string;
  diffSummary?: string;
  testResults?: {
    passed: boolean;
    total: number;
    failed: number;
    output: string;
  };
  buildResults?: {
    success: boolean;
    output: string;
  };
  unresolvedRisks?: string[];
}
