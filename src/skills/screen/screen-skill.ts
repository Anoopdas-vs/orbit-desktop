import { z } from 'zod';
import { BaseSkill } from '../base-skill';
import { skillRegistry } from '../skill-registry';
import { SkillExecutionContext, SkillExecutionResult } from '../../types/skills';
import { nativeBridge, UiElementInfo } from '../../adapters/native/tauri-bridge';

export const ScreenSkillInputSchema = z.object({
  action: z.enum(['capture_screen', 'inspect_screen', 'find_text_on_screen', 'explain_screen']),
  outputPath: z.string().optional(),
  queryText: z.string().optional(),
  targetApp: z.string().optional(),
});

export type ScreenSkillInput = z.infer<typeof ScreenSkillInputSchema>;

export interface ScreenSkillOutput {
  success: boolean;
  action: string;
  filePath?: string;
  activeApp?: string;
  windowTitle?: string;
  elements?: UiElementInfo[];
  matchingElements?: UiElementInfo[];
  extractedValue?: string;
  summary?: string;
  error?: string;
}

export class ScreenSkill extends BaseSkill<ScreenSkillInput, ScreenSkillOutput> {
  public id = 'screen_skill';
  public name = 'macOS Screen Perception & Multimodal Vision Skill';
  public version = '1.0.0';
  public description = 'Captures and visually inspects macOS desktop windows, dialogs, buttons, forms, and extracts on-screen text.';
  public capabilities = ['screen_capture', 'screen_inspection', 'text_extraction', 'visual_explanation'];
  public riskLevel = 'LOW' as const;
  public supportsDryRun = true;
  public allowedPlatforms: ('darwin' | 'all')[] = ['darwin', 'all'];
  public approvalRequirement = 'none' as const;
  public inputSchema = ScreenSkillInputSchema;

  protected async executeInternal(
    input: ScreenSkillInput,
    _context: SkillExecutionContext
  ): Promise<SkillExecutionResult<ScreenSkillOutput>> {
    const startTime = performance.now();

    try {
      const permissions = await nativeBridge.checkPermissions();
      if (!permissions.screenRecordingGranted) {
        return {
          success: false,
          error: 'Screen recording permission is required to inspect screen content. Please enable it in macOS System Settings.',
          durationMs: Math.round(performance.now() - startTime),
        };
      }

      switch (input.action) {
        case 'capture_screen': {
          const cap = await nativeBridge.captureScreen(input.outputPath);
          if (!cap.success) {
            return {
              success: false,
              error: cap.error || 'Failed to capture screen image',
              durationMs: Math.round(performance.now() - startTime),
            };
          }
          return {
            success: true,
            data: {
              success: true,
              action: 'capture_screen',
              filePath: cap.file_path,
            },
            stdout: `Screen captured successfully to ${cap.file_path}`,
            message: 'Desktop screen captured.',
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'inspect_screen': {
          const state = await nativeBridge.getComputerState();
          const tree = await nativeBridge.getUiTree(input.targetApp || state.activeApp);

          const summary = `Active application: ${state.activeApp} (Window: "${state.activeWindow}"). Identified ${tree.elements.length} accessible UI controls.`;
          return {
            success: true,
            data: {
              success: true,
              action: 'inspect_screen',
              activeApp: state.activeApp,
              windowTitle: state.activeWindow,
              elements: tree.elements,
              summary,
            },
            stdout: summary,
            message: summary,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'find_text_on_screen': {
          const query = (input.queryText || '').toLowerCase().trim();
          if (!query) {
            return {
              success: false,
              error: 'Query text is required for find_text_on_screen',
              durationMs: Math.round(performance.now() - startTime),
            };
          }

          const state = await nativeBridge.getComputerState();
          const tree = await nativeBridge.getUiTree(input.targetApp || state.activeApp);

          // Find matches in titles, descriptions, or values of elements
          const matches = tree.elements.filter((el) => {
            const t = (el.title || '').toLowerCase();
            const d = (el.description || '').toLowerCase();
            const v = (el.value || '').toLowerCase();
            return t.includes(query) || d.includes(query) || v.includes(query);
          });

          // Check if user asked for an invoice number or ID specifically
          let extractedValue: string | undefined = undefined;
          if (matches.length > 0) {
            extractedValue = matches[0].value || matches[0].title;
          } else {
            // Regex match over any text fields if query is "invoice", "policy", or "number"
            if (query.includes('invoice') || query.includes('policy') || query.includes('number')) {
              for (const el of tree.elements) {
                const combined = `${el.title} ${el.description || ''} ${el.value || ''}`;
                const m = combined.match(/(?:POL|POLICY|INV|BILL|REC)[-_#\s]?[A-Z0-9]{4,16}/i) ||
                          combined.match(/\b(?:OG|LIC|NIC|BAJAJ|HDFC|ICICI)[-_#\s]?[A-Z0-9]{5,15}\b/i) ||
                          combined.match(/\b\d{6,14}\b/);
                if (m) {
                  extractedValue = m[0];
                  matches.push(el);
                  break;
                }
              }
            }
          }

          return {
            success: true,
            data: {
              success: true,
              action: 'find_text_on_screen',
              activeApp: state.activeApp,
              windowTitle: state.activeWindow,
              matchingElements: matches,
              extractedValue,
              summary: matches.length > 0
                ? `Found ${matches.length} match(es) for "${query}". Extracted value: ${extractedValue || 'N/A'}`
                : `No visible match found for "${query}" in active window.`,
            },
            stdout: extractedValue ? `Located "${query}": ${extractedValue}` : `No matches for "${query}".`,
            message: extractedValue ? `Found: ${extractedValue}` : `Could not locate "${query}" on screen.`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'explain_screen': {
          const state = await nativeBridge.getComputerState();
          const tree = await nativeBridge.getUiTree(input.targetApp || state.activeApp);

          const buttons = tree.elements.filter((e) => e.role.toUpperCase() === 'BUTTON');
          const fields = tree.elements.filter((e) => e.role.toUpperCase() === 'TEXTFIELD');

          const explanation =
            `You are currently viewing "${state.activeWindow}" in ${state.activeApp}.\n` +
            `The screen displays ${buttons.length} button(s) and ${fields.length} text input field(s).\n` +
            (buttons.length > 0 ? `Key buttons: ${buttons.slice(0, 4).map((b) => `"${b.title}"`).join(', ')}.\n` : '') +
            `Background running applications: ${state.runningApps.slice(0, 5).join(', ')}.`;

          return {
            success: true,
            data: {
              success: true,
              action: 'explain_screen',
              activeApp: state.activeApp,
              windowTitle: state.activeWindow,
              summary: explanation,
            },
            stdout: explanation,
            message: explanation,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        default:
          return {
            success: false,
            error: `Unsupported action: ${(input as any).action}`,
            durationMs: Math.round(performance.now() - startTime),
          };
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Screen skill execution failed',
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  protected override async dryRunInternal(
    input: ScreenSkillInput,
    _context: SkillExecutionContext
  ): Promise<SkillExecutionResult<ScreenSkillOutput>> {
    return {
      success: true,
      data: {
        success: true,
        action: input.action,
        summary: `[DRY RUN] Would execute screen action: ${input.action}`,
      },
      stdout: `[DRY RUN] Screen skill action ${input.action}`,
      message: `[DRY RUN] Inspected screen for ${input.action}`,
      durationMs: 2,
    };
  }
}

export const screenSkill = new ScreenSkill();
skillRegistry.registerSkill(screenSkill);
