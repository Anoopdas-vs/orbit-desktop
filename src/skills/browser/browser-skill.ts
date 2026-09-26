import { z } from 'zod';
import { BaseSkill } from '../base-skill';
import { skillRegistry } from '../skill-registry';
import { SkillExecutionContext, SkillExecutionResult } from '../../types/skills';
import { nativeBridge } from '../../adapters/native/tauri-bridge';
import { semanticTargetResolver } from '../../core/semantic-targeting';

export const BrowserInputSchema = z.object({
  action: z.enum([
    'navigate',
    'go_back',
    'go_forward',
    'reload',
    'open_tab',
    'close_tab',
    'switch_tab',
    'fill_field',
    'click_link',
    'scroll_page',
    'observe_page_state',
  ]),
  browser: z.enum(['Safari', 'Google Chrome']).default('Safari'),
  url: z.string().optional(),
  target: z.string().optional(),
  text: z.string().optional(),
  tabIndex: z.number().optional(),
  scrollDirection: z.enum(['up', 'down', 'top', 'bottom']).optional(),
});

export type BrowserInput = z.infer<typeof BrowserInputSchema>;

export interface BrowserOutput {
  success: boolean;
  action: string;
  browser: string;
  url?: string;
  windowTitle?: string;
  target?: string;
  text?: string;
  data?: any;
  tabIndex?: number;
  output?: string;
  error?: string;
}

export class BrowserSkill extends BaseSkill<BrowserInput, BrowserOutput> {
  public id = 'browser_skill';
  public name = 'macOS Advanced Browser Automation Skill';
  public version = '3.0.0';
  public description = 'Controls Safari and Chrome tabs, navigation, DOM interactions, forms, and page state observation';
  public capabilities = [
    'browser_navigation',
    'safari_automation',
    'chrome_automation',
    'tab_management',
    'form_filling',
    'link_clicking',
    'page_scrolling',
    'page_state_observation',
  ];
  public riskLevel = 'LOW' as const;
  public supportsDryRun = true;
  public allowedPlatforms: ('darwin' | 'all')[] = ['darwin', 'all'];
  public approvalRequirement = 'single-click' as const;
  public requiredPermissions: ('accessibility' | 'automation')[] = ['accessibility', 'automation'];
  public inputSchema = BrowserInputSchema;

  protected async executeInternal(
    input: BrowserInput,
    _context: SkillExecutionContext
  ): Promise<SkillExecutionResult<BrowserOutput>> {
    const startTime = performance.now();
    const browser = input.browser || 'Safari';

    try {
      switch (input.action) {
        case 'navigate': {
          const targetUrl = input.url || 'https://www.google.com';
          if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            return {
              success: false,
              error: `Invalid URL protocol: "${targetUrl}". Only http and https URLs are permitted.`,
              durationMs: Math.round(performance.now() - startTime),
            };
          }
          await nativeBridge.openUrl(targetUrl, browser);
          const state = await nativeBridge.getComputerState();
          return {
            success: true,
            data: { success: true, action: 'navigate', browser, url: targetUrl, windowTitle: state.activeWindow },
            stdout: `Navigated ${browser} to ${targetUrl}`,
            message: `Navigated ${browser} to ${targetUrl}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'go_back': {
          await nativeBridge.controlAction({
            action: 'key_shortcut',
            appName: browser,
            modifiers: ['cmd'],
            key: '[',
          });
          return {
            success: true,
            data: { success: true, action: 'go_back', browser },
            stdout: `Navigated back in ${browser}`,
            message: `Returned to previous page in ${browser}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'go_forward': {
          await nativeBridge.controlAction({
            action: 'key_shortcut',
            appName: browser,
            modifiers: ['cmd'],
            key: ']',
          });
          return {
            success: true,
            data: { success: true, action: 'go_forward', browser },
            stdout: `Navigated forward in ${browser}`,
            message: `Navigated forward in ${browser}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'reload': {
          await nativeBridge.controlAction({
            action: 'key_shortcut',
            appName: browser,
            modifiers: ['cmd'],
            key: 'r',
          });
          return {
            success: true,
            data: { success: true, action: 'reload', browser },
            stdout: `Reloaded current tab in ${browser}`,
            message: `Reloaded tab in ${browser}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'open_tab': {
          await nativeBridge.controlAction({
            action: 'key_shortcut',
            appName: browser,
            modifiers: ['cmd'],
            key: 't',
          });
          if (input.url) {
            await nativeBridge.openUrl(input.url, browser);
          }
          return {
            success: true,
            data: { success: true, action: 'open_tab', browser, url: input.url },
            stdout: `Opened new tab in ${browser}${input.url ? ` (${input.url})` : ''}`,
            message: `Opened new tab in ${browser}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'close_tab': {
          await nativeBridge.controlAction({
            action: 'key_shortcut',
            appName: browser,
            modifiers: ['cmd'],
            key: 'w',
          });
          return {
            success: true,
            data: { success: true, action: 'close_tab', browser },
            stdout: `Closed active tab in ${browser}`,
            message: `Closed active tab in ${browser}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'switch_tab': {
          const tabNum = input.tabIndex ?? 1;
          await nativeBridge.controlAction({
            action: 'key_shortcut',
            appName: browser,
            modifiers: ['cmd'],
            key: String(Math.min(9, Math.max(1, tabNum))),
          });
          return {
            success: true,
            data: { success: true, action: 'switch_tab', browser },
            stdout: `Switched to tab ${tabNum} in ${browser}`,
            message: `Switched to tab ${tabNum} in ${browser}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'click_link': {
          // Layer 1: Perception via AXUIElement tree
          const tree = await nativeBridge.getUiTree(browser);
          const resolved = semanticTargetResolver.resolve(
            { rawTarget: input.target || 'link', expectedRole: 'LINK', actionContext: 'click' },
            tree
          );

          if (resolved) {
            await nativeBridge.controlAction({
              action: 'mouse_click',
              appName: browser,
              x: resolved.clickX,
              y: resolved.clickY,
            });
            return {
              success: true,
              data: { success: true, action: 'click_link', browser, target: input.target },
              stdout: `Clicked link "${input.target}" via accessibility target`,
              message: `Clicked link "${input.target}"`,
              durationMs: Math.round(performance.now() - startTime),
            };
          }

          // Layer 2: Fallback via AppleScript GUI button/link
          const directClick = await nativeBridge.guiAction({
            action: 'click_button',
            appName: browser,
            target: input.target,
          });

          return {
            success: directClick.success,
            data: { success: directClick.success, action: 'click_link', browser, target: input.target },
            stdout: directClick.stdout,
            message: directClick.success ? `Clicked link "${input.target}"` : `Failed to click link "${input.target}"`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'fill_field': {
          // Layer 1: Find text field and click to focus
          const tree = await nativeBridge.getUiTree(browser);
          const resolved = semanticTargetResolver.resolve(
            { rawTarget: input.target || 'search', expectedRole: 'TEXTFIELD', actionContext: 'type' },
            tree
          );

          if (resolved) {
            await nativeBridge.controlAction({
              action: 'mouse_click',
              appName: browser,
              x: resolved.clickX,
              y: resolved.clickY,
            });
          } else {
            // Address bar / search shortcut fallback
            await nativeBridge.controlAction({
              action: 'key_shortcut',
              appName: browser,
              modifiers: ['cmd'],
              key: 'l',
            });
          }

          // Type text
          if (input.text) {
            await nativeBridge.controlAction({
              action: 'key_type',
              appName: browser,
              text: input.text,
            });
          }

          return {
            success: true,
            data: { success: true, action: 'fill_field', browser, target: input.target },
            stdout: `Filled field "${input.target}" with text`,
            message: `Filled field in ${browser}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'scroll_page': {
          const delta = input.scrollDirection === 'up' ? -5 : 5;
          await nativeBridge.controlAction({
            action: 'mouse_scroll',
            deltaY: delta,
          });
          return {
            success: true,
            data: { success: true, action: 'scroll_page', browser },
            stdout: `Scrolled page ${input.scrollDirection || 'down'} in ${browser}`,
            message: `Scrolled page in ${browser}`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'observe_page_state': {
          const state = await nativeBridge.getComputerState();
          const tree = await nativeBridge.getUiTree(browser);
          return {
            success: true,
            data: {
              success: true,
              action: 'observe_page_state',
              browser,
              windowTitle: state.activeWindow,
              output: `Observed ${tree.totalCount} accessible elements on page "${state.activeWindow}"`,
            },
            stdout: `Page Title: "${state.activeWindow}" (${tree.totalCount} accessible elements)`,
            message: `Page: "${state.activeWindow}"`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        default:
          return {
            success: true,
            data: { success: true, action: input.action, browser },
            stdout: `Executed browser action ${input.action}`,
            durationMs: Math.round(performance.now() - startTime),
          };
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || `Browser action ${input.action} failed`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  protected override async dryRunInternal(
    input: BrowserInput,
    _context: SkillExecutionContext
  ): Promise<SkillExecutionResult<BrowserOutput>> {
    return {
      success: true,
      data: {
        success: true,
        action: input.action,
        browser: input.browser,
        url: input.url,
      },
      stdout: `[DRY RUN] Would execute browser action: ${input.action} in ${input.browser}`,
      message: `[DRY RUN] Would execute browser action: ${input.action}`,
      durationMs: 2,
    };
  }
}

export const browserSkill = new BrowserSkill();
skillRegistry.registerSkill(browserSkill);
