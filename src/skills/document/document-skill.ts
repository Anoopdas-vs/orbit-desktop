import { z } from 'zod';
import { BaseSkill } from '../base-skill';
import { skillRegistry } from '../skill-registry';
import { SkillExecutionContext, SkillExecutionResult } from '../../types/skills';
import { nativeBridge } from '../../adapters/native/tauri-bridge';
import { validateSafeFilePath } from '../files/files-skill';

export const DocumentInputSchema = z.object({
  action: z.enum(['read_document', 'create_document', 'append_text', 'summarize_document']),
  path: z.string(),
  content: z.string().optional(),
  text: z.string().optional(),
  overwrite: z.boolean().default(false),
});

export type DocumentInput = z.infer<typeof DocumentInputSchema>;

export interface DocumentOutput {
  success: boolean;
  action: string;
  path: string;
  content?: string;
  wordCount?: number;
  output?: string;
  error?: string;
}

export class DocumentSkill extends BaseSkill<DocumentInput, DocumentOutput> {
  public id = 'document_skill';
  public name = 'macOS Document Reading & Editing Skill';
  public version = '3.0.0';
  public description = 'Safely reads, edits, appends to, and inspects markdown, text, CSV, and code documents';
  public capabilities = ['document_reading', 'document_editing', 'text_appending', 'document_inspection'];
  public riskLevel = 'LOW' as const;
  public supportsDryRun = true;
  public allowedPlatforms: ('darwin' | 'all')[] = ['darwin', 'all'];
  public approvalRequirement = 'single-click' as const;
  public inputSchema = DocumentInputSchema;

  protected async executeInternal(
    input: DocumentInput,
    _context: SkillExecutionContext
  ): Promise<SkillExecutionResult<DocumentOutput>> {
    const startTime = performance.now();

    const safeCheck = validateSafeFilePath(input.path);
    if (!safeCheck.isSafe) {
      return {
        success: false,
        error: safeCheck.reason,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      switch (input.action) {
        case 'read_document':
        case 'summarize_document': {
          const content = await nativeBridge.readFile!(input.path, 50000);
          const words = content.split(/\s+/).filter((w) => w.length > 0).length;
          return {
            success: true,
            data: { success: true, action: input.action, path: input.path, content, wordCount: words },
            stdout: `Read document (${words} words): ${input.path}`,
            message: `Document has ${words} words.`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'create_document': {
          await nativeBridge.createFile!(input.path, input.content || '', input.overwrite);
          return {
            success: true,
            data: { success: true, action: 'create_document', path: input.path },
            stdout: `Created document: ${input.path}`,
            message: `Document created at ${input.path}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'append_text': {
          const existing = await nativeBridge.readFile!(input.path).catch(() => '');
          const updated = `${existing}\n${input.text || ''}`;
          await nativeBridge.createFile!(input.path, updated, true);
          return {
            success: true,
            data: { success: true, action: 'append_text', path: input.path },
            stdout: `Appended text to document: ${input.path}`,
            message: `Appended text to ${input.path}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        default:
          return {
            success: true,
            data: { success: true, action: input.action, path: input.path },
            stdout: `Document action ${input.action} completed.`,
            durationMs: Math.round(performance.now() - startTime),
          };
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || `Document action "${input.action}" failed`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  protected override async dryRunInternal(
    input: DocumentInput,
    _context: SkillExecutionContext
  ): Promise<SkillExecutionResult<DocumentOutput>> {
    return {
      success: true,
      data: {
        success: true,
        action: input.action,
        path: input.path,
      },
      stdout: `[DRY RUN] Would execute document action: ${input.action} on ${input.path}`,
      message: `[DRY RUN] Would execute ${input.action}`,
      durationMs: 2,
    };
  }
}

export const documentSkill = new DocumentSkill();
skillRegistry.registerSkill(documentSkill);
