import { FeatureSpec, RegisteredProject } from '../types/projects';

export const DEFAULT_CODING_AGENT_PROMPT_TEMPLATE = `You are working in the approved repository: {{projectName}}.

Task:
{{featureSpec}}

Repository rules:
{{projectInstructions}}

Allowed actions:
- Read non-secret project files.
- Modify source code only inside the approved repository.
- Run only the listed allowed project commands:
{{allowedCommands}}
- Do not read or expose .env files, credentials, API keys, or secrets.
- Do not commit, push, deploy, alter billing, alter security settings, or run database migrations.
- If a migration, dependency upgrade, external integration, or architectural decision is needed, stop and explain why.
- Add or update tests where appropriate.
- Return a concise implementation summary, changed files, commands run, test results, and unresolved risks.`;

export function generateCodingAgentPrompt(
  project: RegisteredProject,
  spec: FeatureSpec
): string {
  const specText = `Feature: ${spec.featureName}
Goal: ${spec.userGoal}

Acceptance Criteria:
${spec.acceptanceCriteria.map(c => `- ${c}`).join('\n')}

Affected Screens/Components:
${spec.affectedScreens.map(s => `- ${s}`).join('\n')}

Data Model Impact:
${spec.dataModelImpact}

API Impact:
${spec.apiImpact}

Test Strategy:
${spec.testStrategy}

Risks & Assumptions:
${spec.risksAndAssumptions.map(r => `- ${r}`).join('\n')}`;

  const instructions = project.instructions || 'Follow standard TypeScript and React best practices. Run Vitest.';
  const allowedCommands = project.allowedCommands.map(c => `  - ${c}`).join('\n');

  return DEFAULT_CODING_AGENT_PROMPT_TEMPLATE
    .replace('{{projectName}}', project.name)
    .replace('{{featureSpec}}', specText)
    .replace('{{projectInstructions}}', instructions)
    .replace('{{allowedCommands}}', allowedCommands);
}
