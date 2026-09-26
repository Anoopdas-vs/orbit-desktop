import { z } from 'zod';
import { SkillManifest, SkillExecutionContext, SkillExecutionResult } from '../types/skills';

export const GuiControllerInputSchema = z.object({
  action: z.enum([
    'click_button',
    'click_coordinate',
    'click_menu_item',
    'type_text',
    'fill_form',
    'press_key',
    'press_shortcut',
  ]),
  appName: z.string().default('System Events'),
  target: z.string().optional(),     // Button label or element description
  text: z.string().optional(),       // Text to type
  key: z.string().optional(),        // Key name (e.g., return, tab, escape, space)
  shortcut: z.string().optional(),   // Shortcut (e.g. "cmd+v", "cmd+return", "cmd+c")
  x: z.number().optional(),          // Coordinate X
  y: z.number().optional(),          // Coordinate Y
});
export type GuiControllerInput = z.infer<typeof GuiControllerInputSchema>;

export interface GuiActionResult {
  action: string;
  appName: string;
  target?: string;
  text?: string;
  key?: string;
  shortcut?: string;
  x?: number;
  y?: number;
  executed: boolean;
  message: string;
}

export const guiControllerSkill: SkillManifest<GuiControllerInput, GuiActionResult> = {
  id: 'gui_controller',
  name: 'Native macOS GUI Controller',
  description: 'Clicks buttons, coordinates, types text, fills forms, and presses keyboard shortcuts inside native macOS applications',
  riskLevel: 'MEDIUM',
  supportsDryRun: true,
  allowedPlatforms: ['darwin', 'all'],
  approvalRequirement: 'single-click',
  inputSchema: GuiControllerInputSchema,

  dryRun: async (input: GuiControllerInput) => {
    let desc = '';
    if (input.action === 'click_button') {
      desc = `Would click button "${input.target || 'Default'}" in "${input.appName}"`;
    } else if (input.action === 'click_coordinate') {
      desc = `Would click at coordinates (${input.x || 0}, ${input.y || 0})`;
    } else if (input.action === 'press_shortcut') {
      desc = `Would dispatch shortcut "${input.shortcut || 'cmd+v'}" to "${input.appName}"`;
    } else if (input.action === 'type_text' || input.action === 'fill_form') {
      desc = `Would type "${input.text || ''}" into active element in "${input.appName}"`;
    } else if (input.action === 'press_key') {
      desc = `Would press key "${input.key || 'return'}" in "${input.appName}"`;
    }
    return {
      success: true,
      data: {
        action: input.action,
        appName: input.appName,
        target: input.target,
        text: input.text,
        key: input.key,
        shortcut: input.shortcut,
        x: input.x,
        y: input.y,
        executed: false,
        message: `[DRY RUN] ${desc}`,
      },
      message: `[DRY RUN] ${desc}`,
      durationMs: 2,
    };
  },

  execute: async (input: GuiControllerInput, context: SkillExecutionContext): Promise<SkillExecutionResult<GuiActionResult>> => {
    const start = performance.now();
    if (context.killSwitchActive()) {
      return {
        success: false,
        error: 'Execution blocked: Emergency Kill Switch is engaged.',
        durationMs: performance.now() - start,
      };
    }

    // Try executing through native macOS bridge (Tauri IPC in desktop, dev server in browser)
    try {
      const { nativeBridge } = await import('../adapters/native/tauri-bridge');
      const data = await nativeBridge.guiAction({
        action: input.action,
        appName: input.appName,
        target: input.target,
        text: input.text,
        key: input.key,
        shortcut: input.shortcut,
        x: input.x,
        y: input.y,
      });
      return {
        success: data.success,
        data: {
          action: input.action,
          appName: data.appName || input.appName,
          target: input.target,
          text: input.text,
          key: input.key,
          shortcut: input.shortcut,
          x: input.x,
          y: input.y,
          executed: data.success,
          message: data.stdout || `Executed GUI ${input.action} in ${input.appName}`,
        },
        message: data.stdout || `Executed GUI ${input.action} in ${input.appName}`,
        stdout: data.stdout,
        error: data.error,
        durationMs: performance.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || `Native GUI automation failed: ${input.action}`,
        data: {
          action: input.action,
          appName: input.appName || '',
          target: input.target,
          text: input.text,
          key: input.key,
          shortcut: input.shortcut,
          x: input.x,
          y: input.y,
          executed: false,
          message: err.message || 'Execution failed',
        },
        durationMs: performance.now() - start,
      };
    }
  },
};
