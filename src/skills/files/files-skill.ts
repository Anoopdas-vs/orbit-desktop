import { z } from 'zod';
import { BaseSkill } from '../base-skill';
import { skillRegistry } from '../skill-registry';
import { SkillExecutionContext, SkillExecutionResult } from '../../types/skills';
import { nativeBridge } from '../../adapters/native/tauri-bridge';

export const FilesInputSchema = z.object({
  action: z.enum([
    'find_files',
    'get_metadata',
    'open_file',
    'create_file',
    'rename_file',
    'move_file',
    'move_to_trash',
  ]),
  path: z.string().optional(),
  newPath: z.string().optional(),
  content: z.string().optional(),
  query: z.string().optional(),
  overwrite: z.boolean().default(false),
  fileCount: z.number().optional(),
});

export type FilesInput = z.infer<typeof FilesInputSchema>;

export interface FilesOutput {
  success: boolean;
  action: string;
  path?: string;
  metadata?: any;
  files?: string[];
  output?: string;
  error?: string;
}

const FORBIDDEN_FILE_PATHS = [
  '/system',
  '/library',
  '/usr',
  '/bin',
  '/sbin',
  '/var',
  '/etc',
  '/private',
  '/.ssh',
  '/.gnupg',
  '/.aws',
  '/.config',
  '/.git',
  '/node_modules',
];

export function validateSafeFilePath(inputPath: string): { isSafe: boolean; reason?: string } {
  if (!inputPath || typeof inputPath !== 'string') {
    return { isSafe: false, reason: 'Invalid file path.' };
  }

  const lower = inputPath.toLowerCase().trim();

  if (lower.includes('..')) {
    return {
      isSafe: false,
      reason: 'Directory traversal sequence ("..") is strictly prohibited.',
    };
  }

  for (const forbidden of FORBIDDEN_FILE_PATHS) {
    if (lower.startsWith(forbidden) || lower.includes(forbidden)) {
      return {
        isSafe: false,
        reason: `Access to protected location "${forbidden}" is strictly prohibited by Janki safety policy.`,
      };
    }
  }

  if (
    lower.includes('.env') ||
    lower.includes('/id_rsa') ||
    lower.includes('/id_ed25519') ||
    lower.includes('.zshrc') ||
    lower.includes('.bashrc') ||
    lower.includes('/.ssh') ||
    lower.includes('/.aws') ||
    lower.includes('/.git')
  ) {
    return {
      isSafe: false,
      reason: 'Access to credentials or configuration secret files is strictly blocked.',
    };
  }

  return { isSafe: true };
}

export class FilesSkill extends BaseSkill<FilesInput, FilesOutput> {
  public id = 'files_skill';
  public name = 'macOS Safe Filesystem Automation Skill';
  public version = '3.0.0';
  public description = 'Discovers, inspects, creates, and safely organizes files with strict path protection and Trash-only deletion';
  public capabilities = [
    'file_discovery',
    'metadata_inspection',
    'file_creation',
    'file_organization',
    'safe_trash_deletion',
  ];
  public riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
  public supportsDryRun = true;
  public allowedPlatforms: ('darwin' | 'all')[] = ['darwin', 'all'];
  public approvalRequirement = 'single-click' as const;
  public requiredPermissions: ('accessibility' | 'fullDiskAccess' | 'automation')[] = [];
  public inputSchema = FilesInputSchema;

  protected async executeInternal(
    input: FilesInput,
    _context: SkillExecutionContext
  ): Promise<SkillExecutionResult<FilesOutput>> {
    const startTime = performance.now();

    // 1. Safety path validation
    if (input.path) {
      const check = validateSafeFilePath(input.path);
      if (!check.isSafe) {
        return {
          success: false,
          error: check.reason,
          durationMs: Math.round(performance.now() - startTime),
        };
      }
    }

    if (input.newPath) {
      const checkNew = validateSafeFilePath(input.newPath);
      if (!checkNew.isSafe) {
        return {
          success: false,
          error: checkNew.reason,
          durationMs: Math.round(performance.now() - startTime),
        };
      }
    }

    // 2. High-risk batch or deletion checks
    const isTrash = input.action === 'move_to_trash';
    const isBatch = (input.fileCount || 0) > 3;
    if (isTrash || isBatch) {
      this.riskLevel = 'HIGH';
    } else {
      this.riskLevel = 'MEDIUM';
    }

    try {
      switch (input.action) {
        case 'find_files': {
          const query = input.query || '';
          const res = await nativeBridge.execCommand(
            `mdfind -name "${query.replace(/"/g, '')}" | head -n 20`
          );
          const found = res.stdout.split('\n').filter((f) => f.trim().length > 0);
          return {
            success: true,
            data: { success: true, action: 'find_files', files: found },
            stdout: `Found ${found.length} file(s) matching "${query}"`,
            message: `Found ${found.length} file(s)`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'get_metadata': {
          const meta = await nativeBridge.getFileMetadata!(input.path || '');
          return {
            success: true,
            data: { success: true, action: 'get_metadata', path: input.path, metadata: meta },
            stdout: `File "${meta.name}" (${meta.size_bytes} bytes)`,
            message: `File: ${meta.name} (${meta.size_bytes} bytes)`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'open_file': {
          await nativeBridge.openApp('Finder', input.path);
          return {
            success: true,
            data: { success: true, action: 'open_file', path: input.path },
            stdout: `Opened file: ${input.path}`,
            message: `Opened file: ${input.path}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'create_file': {
          await nativeBridge.createFile!(input.path || '', input.content || '', input.overwrite);
          return {
            success: true,
            data: { success: true, action: 'create_file', path: input.path },
            stdout: `Created file: ${input.path}`,
            message: `Created file: ${input.path}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'rename_file':
        case 'move_file': {
          const oldP = input.path || '';
          const newP = input.newPath || '';
          await nativeBridge.execCommand(`mv "${oldP.replace(/"/g, '')}" "${newP.replace(/"/g, '')}"`);
          return {
            success: true,
            data: { success: true, action: input.action, path: newP },
            stdout: `Moved/Renamed file to: ${newP}`,
            message: `Moved to: ${newP}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'move_to_trash': {
          // Never permanent deletion! Move to ~/.Trash
          await nativeBridge.moveToTrash!(input.path || '');
          return {
            success: true,
            data: { success: true, action: 'move_to_trash', path: input.path },
            stdout: `Moved file "${input.path}" to macOS Trash`,
            message: `Moved to Trash: ${input.path}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        default:
          return {
            success: true,
            data: { success: true, action: input.action },
            stdout: `Executed file action: ${input.action}`,
            durationMs: Math.round(performance.now() - startTime),
          };
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || `File action "${input.action}" failed`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  protected override async dryRunInternal(
    input: FilesInput,
    _context: SkillExecutionContext
  ): Promise<SkillExecutionResult<FilesOutput>> {
    return {
      success: true,
      data: {
        success: true,
        action: input.action,
        path: input.path,
      },
      stdout: `[DRY RUN] Would execute safe file operation: ${input.action} on "${input.path || 'file'}"`,
      message: `[DRY RUN] Would execute ${input.action}`,
      durationMs: 2,
    };
  }
}

export const filesSkill = new FilesSkill();
skillRegistry.registerSkill(filesSkill);
