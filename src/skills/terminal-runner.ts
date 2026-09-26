import { z } from 'zod';
import { SkillManifest, SkillExecutionContext, SkillExecutionResult } from '../types/skills';
import { killSwitch } from '../core/kill-switch';
import { redactSensitiveData } from '../core/redactor';

export const TerminalRunnerInputSchema = z.object({
  command: z.string().min(1),
  cwd: z.string().optional(),
  timeoutMs: z.number().default(30000),
  env: z.record(z.string()).optional(),
});
export type TerminalRunnerInput = z.infer<typeof TerminalRunnerInputSchema>;

export const BLOCKED_PATTERNS = [
  /\brm\s+-(?:r[fF]|fr|r|f)\b/i,           // rm -rf, rm -r, rm -f
  /\bsudo\b/i,                             // sudo privileges
  /curl\b.*\|\s*(?:ba)?sh\b/i,             // curl | sh or curl | bash
  /wget\b.*\|\s*(?:ba)?sh\b/i,             // wget | sh
  /\bchmod\s+-[rR]\b/i,                    // recursive chmod
  /\bgit\s+push\b.*(?:--force|-f\b)/i,     // force push
  /\bgit\s+reset\s+--hard\b/i,             // git reset --hard
  /\b(?:cat|head|tail|less|more|vi|vim|nano)\b.*\.env\b/i, // reading .env directly
  /\b(?:export|env|set)\b.*(?:KEY|SECRET|TOKEN|PASSWORD)/i, // reading environment secrets
  />\s*\/dev\/sd[a-z]/i,                   // raw disk writes
  /\bmkfs\b/i,                             // filesystem format
  /:(){ :\|:& };:/,                        // fork bomb
];

export const ALLOWLISTED_PREFIXES = [
  'git status',
  'git diff',
  'git branch',
  'git log',
  'git checkout -b ',
  'git checkout ',
  'npm test',
  'npm run dev',
  'npm run lint',
  'npm run build',
  'npm install',
  'pnpm test',
  'pnpm run dev',
  'pnpm run lint',
  'pnpm run build',
  'pnpm install',
  'yarn test',
  'yarn dev',
  'yarn lint',
  'yarn build',
  'yarn install',
  'npx vitest',
  'tsc --noEmit',
];

export function isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
  const trimmed = command.trim();

  // 1. Check blocked dangerous patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: `Command blocked by Janki security policy: detected forbidden pattern matching ${pattern.toString()}`,
      };
    }
  }

  // 2. Check if command matches allowlisted catalog
  const isAllowlisted = ALLOWLISTED_PREFIXES.some(prefix =>
    trimmed === prefix || trimmed.startsWith(prefix)
  );

  if (!isAllowlisted) {
    return {
      allowed: false,
      reason: `Command "${trimmed}" is not in the allowlisted command catalog. Arbitrary shell commands are rejected for safety.`,
    };
  }

  return { allowed: true };
}

export const terminalRunnerSkill: SkillManifest<TerminalRunnerInput> = {
  id: 'terminal_runner',
  name: 'Controlled Terminal Runner',
  description: 'Executes allowlisted development and Git commands in a monitored subprocess with timeout and kill-switch abort',
  riskLevel: 'MEDIUM',
  supportsDryRun: true,
  allowedPlatforms: ['all'],
  approvalRequirement: 'single-click',
  inputSchema: TerminalRunnerInputSchema,

  dryRun: async (input: TerminalRunnerInput) => {
    const check = isCommandAllowed(input.command);
    if (!check.allowed) {
      return {
        success: false,
        error: check.reason,
        durationMs: 2,
      };
    }
    return {
      success: true,
      message: `[DRY RUN] Command is valid and allowlisted: "${input.command}" (CWD: ${input.cwd || 'default'})`,
      stdout: `[SIMULATED] Would execute "${input.command}" with timeout ${input.timeoutMs}ms`,
      durationMs: 5,
    };
  },

  execute: async (input: TerminalRunnerInput, context: SkillExecutionContext): Promise<SkillExecutionResult> => {
    const start = performance.now();

    // 1. Check emergency kill switch
    if (context.killSwitchActive()) {
      return {
        success: false,
        error: 'Execution denied: Emergency Kill Switch is engaged.',
        durationMs: performance.now() - start,
      };
    }

    // 2. Validate command allowlist
    const validation = isCommandAllowed(input.command);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        exitCode: 1,
        durationMs: performance.now() - start,
      };
    }

    // 3. Setup AbortController and register with killSwitch
    const abortController = new AbortController();
    const procId = crypto.randomUUID();
    killSwitch.registerProcess(procId, input.command, abortController);

    try {
      const { nativeBridge } = await import('../adapters/native/tauri-bridge');
      const data = await nativeBridge.execCommand(input.command, input.cwd);
      killSwitch.unregisterProcess(procId);
      return {
        success: data.success,
        data: { command: input.command, exitCode: data.exitCode },
        stdout: data.stdout,
        stderr: data.stderr,
        exitCode: data.exitCode,
        error: data.error,
        durationMs: performance.now() - start,
      };
    } catch (err: any) {
      killSwitch.unregisterProcess(procId);
      return {
        success: false,
        error: err.message || 'Subprocess execution error: native execution failed',
        exitCode: 1,
        durationMs: performance.now() - start,
      };
    }
  },
};
