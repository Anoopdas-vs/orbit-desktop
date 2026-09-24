import { z } from 'zod';
import { SkillManifest, SkillExecutionContext, SkillExecutionResult } from '../types/skills';

export const GitWorkflowInputSchema = z.object({
  operation: z.enum(['status', 'diff', 'create_branch', 'commit', 'push', 'create_pr']),
  branch: z.string().optional(),
  message: z.string().optional(),
  targetRepo: z.string().optional(),
  baseBranch: z.string().default('main'),
});
export type GitWorkflowInput = z.infer<typeof GitWorkflowInputSchema>;

export const PROTECTED_BRANCHES = ['main', 'master', 'production', 'release', 'staging'];

export function isValidBranchSlug(branch: string): boolean {
  // Allow git-compliant slug: lowercase alphanumeric, hyphens, slashes (e.g., feat/dark-mode, fix/auth-token)
  return /^[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)*$/i.test(branch) && !branch.endsWith('.lock') && !branch.includes('..');
}

export const gitWorkflowSkill: SkillManifest<GitWorkflowInput> = {
  id: 'git_workflow',
  name: 'Git Workflow Manager',
  description: 'Audited Git operations with branch slug validation, protected branch blocking, and approval gates',
  riskLevel: 'MEDIUM',
  supportsDryRun: true,
  allowedPlatforms: ['all'],
  approvalRequirement: 'single-click',
  inputSchema: GitWorkflowInputSchema,

  dryRun: async (input: GitWorkflowInput) => {
    if (input.operation === 'create_branch') {
      if (!input.branch || !isValidBranchSlug(input.branch)) {
        return {
          success: false,
          error: `Invalid branch name "${input.branch}". Must be valid slug (e.g. feat/new-feature).`,
          durationMs: 2,
        };
      }
      return {
        success: true,
        message: `[DRY RUN] Would create and checkout local branch: ${input.branch}`,
        durationMs: 4,
      };
    }

    if (input.operation === 'push') {
      if (PROTECTED_BRANCHES.includes(input.branch?.toLowerCase() || '')) {
        return {
          success: false,
          error: `Protected branch violation: cannot push directly to "${input.branch}".`,
          durationMs: 2,
        };
      }
      return {
        success: true,
        message: `[DRY RUN] Would push branch "${input.branch}" to origin`,
        durationMs: 4,
      };
    }

    return {
      success: true,
      message: `[DRY RUN] Valid Git operation: ${input.operation}`,
      durationMs: 2,
    };
  },

  execute: async (input: GitWorkflowInput, context: SkillExecutionContext): Promise<SkillExecutionResult> => {
    const start = performance.now();

    if (context.killSwitchActive()) {
      return {
        success: false,
        error: 'Execution denied: Emergency Kill Switch is engaged.',
        durationMs: performance.now() - start,
      };
    }

    switch (input.operation) {
      case 'status':
        return {
          success: true,
          data: { clean: false, branch: 'main', modified: ['src/App.tsx'] },
          stdout: '## main...origin/main\n M src/App.tsx\n?? tests/new-feature.test.ts',
          durationMs: performance.now() - start,
        };

      case 'diff':
        return {
          success: true,
          stdout: '+ // Added safe workflow\n+ export const orbitActive = true;',
          durationMs: performance.now() - start,
        };

      case 'create_branch': {
        if (!input.branch || !isValidBranchSlug(input.branch)) {
          return {
            success: false,
            error: `Invalid branch slug: "${input.branch}". Branch names must not contain spaces or illegal characters.`,
            durationMs: performance.now() - start,
          };
        }
        return {
          success: true,
          data: { branch: input.branch },
          stdout: `Switched to a new branch '${input.branch}'`,
          message: `Created branch ${input.branch}`,
          durationMs: performance.now() - start,
        };
      }

      case 'commit': {
        if (!input.message) {
          return {
            success: false,
            error: 'Commit message cannot be empty.',
            durationMs: performance.now() - start,
          };
        }
        return {
          success: true,
          data: { commitHash: '7c89f1a', message: input.message },
          stdout: `[${input.branch || 'HEAD'} 7c89f1a] ${input.message}\n 2 files changed, 45 insertions(+)`,
          message: `Created commit: "${input.message}"`,
          durationMs: performance.now() - start,
        };
      }

      case 'push': {
        if (!input.branch) {
          return {
            success: false,
            error: 'Branch name is required for push operation.',
            durationMs: performance.now() - start,
          };
        }
        if (PROTECTED_BRANCHES.includes(input.branch.toLowerCase())) {
          return {
            success: false,
            error: `Security violation: pushing directly to protected branch "${input.branch}" is prohibited.`,
            durationMs: performance.now() - start,
          };
        }
        return {
          success: true,
          data: { remote: 'origin', branch: input.branch },
          stdout: `To github.com:owner/repo.git\n * [new branch]      ${input.branch} -> ${input.branch}`,
          message: `Pushed branch "${input.branch}" to origin`,
          durationMs: performance.now() - start,
        };
      }

      case 'create_pr': {
        return {
          success: true,
          data: {
            prNumber: 42,
            url: `https://github.com/mock-org/project/pull/42`,
            title: input.message || 'Feature implementation',
          },
          stdout: `Created PR #42: ${input.message || 'Feature implementation'}\nhttps://github.com/mock-org/project/pull/42`,
          message: 'Created GitHub Pull Request #42',
          durationMs: performance.now() - start,
        };
      }
    }
  },
};
