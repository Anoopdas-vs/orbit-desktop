import { describe, it, expect } from 'vitest';
import { isValidBranchSlug, gitWorkflowSkill, PROTECTED_BRANCHES } from '../src/skills/git-workflow';

describe('Git Workflow Protection & Validation', () => {
  it('validates compliant git branch slugs', () => {
    expect(isValidBranchSlug('feat/dark-mode')).toBe(true);
    expect(isValidBranchSlug('fix/issue-123')).toBe(true);
    expect(isValidBranchSlug('chore/deps-update')).toBe(true);
    expect(isValidBranchSlug('experiment-v1')).toBe(true);
  });

  it('rejects illegal branch names', () => {
    expect(isValidBranchSlug('feat/dark mode with spaces')).toBe(false);
    expect(isValidBranchSlug('../path-traversal')).toBe(false);
    expect(isValidBranchSlug('branch.lock')).toBe(false);
  });

  it('blocks push directly to protected branches', async () => {
    const context = {
      isDryRun: false,
      userPrompt: 'git push',
      killSwitchActive: () => false,
    };

    for (const branch of PROTECTED_BRANCHES) {
      const res = await gitWorkflowSkill.execute(
        { operation: 'push', branch, baseBranch: 'main' },
        context
      );
      expect(res.success).toBe(false);
      expect(res.error).toContain('protected branch');
    }
  });

  it('allows push to validated feature branches', async () => {
    const context = {
      isDryRun: false,
      userPrompt: 'git push',
      killSwitchActive: () => false,
    };

    const res = await gitWorkflowSkill.execute(
      { operation: 'push', branch: 'feat/safe-feature', baseBranch: 'main' },
      context
    );
    expect(res.success).toBe(true);
    expect(res.message).toContain('feat/safe-feature');
  });
});
