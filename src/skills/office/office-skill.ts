import { z } from 'zod';
import { BaseSkill } from '../base-skill';
import { skillRegistry } from '../skill-registry';
import { SkillExecutionContext, SkillExecutionResult } from '../../types/skills';
import { nativeBridge } from '../../adapters/native/tauri-bridge';

export const OfficeInputSchema = z.object({
  action: z.enum(['create_reminder', 'create_calendar_event', 'create_note']),
  title: z.string().min(1),
  body: z.string().optional(),
  listName: z.string().optional(),
  dueDate: z.string().optional(),
});

export type OfficeInput = z.infer<typeof OfficeInputSchema>;

export interface OfficeOutput {
  success: boolean;
  action: string;
  itemTitle: string;
  output?: string;
  error?: string;
}

export class OfficeSkill extends BaseSkill<OfficeInput, OfficeOutput> {
  public id = 'office_skill';
  public name = 'macOS Productivity & Office Skill';
  public version = '3.0.0';
  public description = 'Automates macOS Reminders, Calendar events, and Apple Notes';
  public capabilities = ['reminders_management', 'calendar_events', 'notes_creation'];
  public riskLevel = 'LOW' as const;
  public supportsDryRun = true;
  public allowedPlatforms: ('darwin' | 'all')[] = ['darwin', 'all'];
  public approvalRequirement = 'single-click' as const;
  public requiredPermissions: ('automation')[] = ['automation'];
  public inputSchema = OfficeInputSchema;

  protected async executeInternal(
    input: OfficeInput,
    _context: SkillExecutionContext
  ): Promise<SkillExecutionResult<OfficeOutput>> {
    const startTime = performance.now();

    try {
      switch (input.action) {
        case 'create_reminder': {
          const script = `tell application "Reminders" to make new reminder with properties {name:"${input.title.replace(/"/g, '\\"')}"}`;
          await nativeBridge.execCommand(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
          return {
            success: true,
            data: { success: true, action: 'create_reminder', itemTitle: input.title },
            stdout: `Created Reminder: "${input.title}"`,
            message: `Created reminder "${input.title}"`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'create_note': {
          const bodyText = input.body || '';
          const script = `tell application "Notes" to make new note with properties {name:"${input.title.replace(/"/g, '\\"')}", body:"${bodyText.replace(/"/g, '\\"')}"}`;
          await nativeBridge.execCommand(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
          return {
            success: true,
            data: { success: true, action: 'create_note', itemTitle: input.title },
            stdout: `Created Note: "${input.title}"`,
            message: `Created note "${input.title}"`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'create_calendar_event': {
          const script = `tell application "Calendar" to tell calendar 1 to make new event with properties {summary:"${input.title.replace(/"/g, '\\"')}"}`;
          await nativeBridge.execCommand(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
          return {
            success: true,
            data: { success: true, action: 'create_calendar_event', itemTitle: input.title },
            stdout: `Created Calendar Event: "${input.title}"`,
            message: `Scheduled calendar event "${input.title}"`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        default:
          return {
            success: true,
            data: { success: true, action: input.action, itemTitle: input.title },
            durationMs: Math.round(performance.now() - startTime),
          };
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || `Office action "${input.action}" failed`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  protected override async dryRunInternal(
    input: OfficeInput,
    _context: SkillExecutionContext
  ): Promise<SkillExecutionResult<OfficeOutput>> {
    return {
      success: true,
      data: {
        success: true,
        action: input.action,
        itemTitle: input.title,
      },
      stdout: `[DRY RUN] Would create ${input.action} with title "${input.title}"`,
      message: `[DRY RUN] Would create ${input.action}: "${input.title}"`,
      durationMs: 2,
    };
  }
}

export const officeSkill = new OfficeSkill();
skillRegistry.registerSkill(officeSkill);
