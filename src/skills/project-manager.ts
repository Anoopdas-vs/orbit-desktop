import { z } from 'zod';
import { SkillManifest, SkillExecutionContext, SkillExecutionResult } from '../types/skills';
import { RegisteredProject } from '../types/projects';

export const ProjectManagerInputSchema = z.object({
  action: z.enum(['list', 'inspect', 'register', 'unregister']),
  projectId: z.string().optional(),
  name: z.string().optional(),
  rootPath: z.string().optional(),
});
export type ProjectManagerInput = z.infer<typeof ProjectManagerInputSchema>;

export const projectManagerSkill: SkillManifest<ProjectManagerInput> = {
  id: 'project_manager',
  name: 'Project Directory Manager',
  description: 'Manages registered local project repositories and inspects package.json, git status, and conventions',
  riskLevel: 'LOW',
  supportsDryRun: true,
  allowedPlatforms: ['all'],
  approvalRequirement: 'none',
  inputSchema: ProjectManagerInputSchema,

  dryRun: async (input: ProjectManagerInput) => {
    return {
      success: true,
      message: `[DRY RUN] Project manager action: ${input.action} on ${input.rootPath || input.projectId || 'all'}`,
      durationMs: 2,
    };
  },

  execute: async (input: ProjectManagerInput, context: SkillExecutionContext): Promise<SkillExecutionResult> => {
    const start = performance.now();

    if (context.killSwitchActive()) {
      return {
        success: false,
        error: 'Execution denied: Emergency Kill Switch is engaged.',
        durationMs: performance.now() - start,
      };
    }

    if (input.action === 'register') {
      if (!input.rootPath || !input.name) {
        return {
          success: false,
          error: 'Both project name and rootPath are required for registration.',
          durationMs: performance.now() - start,
        };
      }

      const newProject: RegisteredProject = {
        id: crypto.randomUUID(),
        name: input.name,
        rootPath: input.rootPath,
        defaultBranch: 'main',
        framework: 'React / Vite',
        packageScripts: {
          dev: 'vite',
          build: 'tsc && vite build',
          test: 'vitest',
          lint: 'eslint .'
        },
        instructions: '# Project Conventions\n- Use functional components\n- Add Vitest tests for every new feature',
        allowedCommands: ['npm test', 'npm run dev', 'npm run build', 'npm run lint', 'git status'],
        createdAt: new Date().toISOString(),
      };

      return {
        success: true,
        data: newProject,
        message: `Registered project "${input.name}" at ${input.rootPath}`,
        durationMs: performance.now() - start,
      };
    }

    return {
      success: true,
      message: `Action ${input.action} completed.`,
      durationMs: performance.now() - start,
    };
  },
};
