import { Tool, ToolExecutionContext, ToolExecutionResult } from '../types/tools';
import { killSwitch } from '../core/kill-switch';
import { permissionManager } from '../core/permission-manager';
import { skillRegistry } from '../skills/skill-registry';
import { BaseSkill } from '../skills/base-skill';
import { SkillExecutionContext, SkillExecutionResult } from '../types/skills';
import { webSearchTool } from './web/web-search-tool';
import { browserResearchTool } from './browser/browser-research-tool';
import { emailTool } from './integrations/email-tool';
import { calendarTool } from './integrations/calendar-tool';
import { fileWorkflowTool } from './integrations/file-workflow-tool';
import { screenUnderstandingTool } from './screen/screen-understanding-tool';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerStandardTools();
  }

  public registerStandardTools(): void {
    this.registerTool(webSearchTool);
    this.registerTool(browserResearchTool);
    this.registerTool(emailTool);
    this.registerTool(calendarTool);
    this.registerTool(fileWorkflowTool);
    this.registerTool(screenUnderstandingTool);
  }

  /**
   * Register a modular tool and bridge it to SkillRegistry.
   */
  public registerTool(tool: Tool): void {
    if (!tool || !tool.name) {
      throw new Error('Invalid tool: Tool name is required');
    }
    this.tools.set(tool.name, tool);
    this.bridgeToolToSkillRegistry(tool);
  }

  public unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  public getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  public hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  public listTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Safe execution wrapper passing through permission manager, kill switch, and verification.
   */
  public async dispatch<TInput = any, TOutput = any>(
    toolName: string,
    input: TInput,
    context?: Partial<ToolExecutionContext>
  ): Promise<ToolExecutionResult<TOutput>> {
    const startTime = performance.now();

    const fullContext: ToolExecutionContext = {
      isDryRun: context?.isDryRun ?? false,
      userPrompt: context?.userPrompt ?? '',
      sessionId: context?.sessionId,
      preferredLanguage: context?.preferredLanguage ?? 'en',
      confirmedByUser: context?.confirmedByUser ?? false,
      killSwitchActive: context?.killSwitchActive ?? (() => killSwitch.isEngaged()),
    };

    // 1. Kill-switch check
    if (killSwitch.isEngaged() || fullContext.killSwitchActive()) {
      return {
        status: 'BLOCKED',
        success: false,
        error: `Execution blocked: Emergency Kill Switch is engaged (${killSwitch.getReason() || 'Active'}).`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // 2. Lookup tool
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        status: 'FAILED',
        success: false,
        error: `Tool "${toolName}" is not registered in ToolRegistry.`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // 3. Permission verification
    if (tool.requiredPermissions && tool.requiredPermissions.length > 0) {
      const status = await permissionManager.getStatus();
      const missing: string[] = [];

      for (const perm of tool.requiredPermissions) {
        if (perm === 'accessibility' && !status.accessibilityGranted) missing.push(perm);
        if (perm === 'automation' && !status.automationGranted) missing.push(perm);
        if (perm === 'screenRecording' && !status.screenRecordingGranted) missing.push(perm);
        if (perm === 'microphone' && !status.microphoneGranted) missing.push(perm);
      }

      if (missing.length > 0) {
        return {
          status: 'BLOCKED',
          success: false,
          error: `Missing required system permissions for tool "${toolName}": ${missing.join(', ')}.`,
          durationMs: Math.round(performance.now() - startTime),
        };
      }
    }

    // 4. Validate input schema
    const parseRes = tool.inputSchema.safeParse(input);
    if (!parseRes.success) {
      return {
        status: 'FAILED',
        success: false,
        error: `Input schema validation failed for tool "${toolName}": ${parseRes.error.message}`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // 5. Execute tool
    try {
      const execResult = await tool.execute(parseRes.data, fullContext);

      // 6. Run verification
      if (execResult.success && tool.verify) {
        const verifyRes = await tool.verify(parseRes.data, execResult, fullContext);
        execResult.verification = verifyRes;
        if (!verifyRes.verified) {
          execResult.status = 'PARTIAL_SUCCESS';
          execResult.message = `Action completed with verification discrepancy: ${verifyRes.error || verifyRes.actualState}`;
        }
      }

      return {
        ...execResult,
        durationMs: execResult.durationMs ?? Math.round(performance.now() - startTime),
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        success: false,
        error: err.message || `Unhandled error executing tool "${toolName}"`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  /**
   * Adapts a unified Tool into a BaseSkill so it can be registered into SkillRegistry.
   */
  private bridgeToolToSkillRegistry(tool: Tool): void {
    class ToolSkillBridge extends BaseSkill {
      public id = tool.name;
      public name = `Tool: ${tool.name}`;
      public description = tool.description;
      public riskLevel = tool.riskLevel;
      public inputSchema = tool.inputSchema;
      public requiredPermissions = tool.requiredPermissions || [];

      protected async executeInternal(
        input: any,
        context: SkillExecutionContext
      ): Promise<SkillExecutionResult> {
        const toolRes = await tool.execute(input, {
          isDryRun: context.isDryRun,
          userPrompt: context.userPrompt,
          sessionId: context.sessionId,
          killSwitchActive: context.killSwitchActive,
        });

        return {
          success: toolRes.success,
          data: toolRes.data,
          stdout: toolRes.stdout,
          stderr: toolRes.stderr,
          error: toolRes.error,
          message: toolRes.message,
          durationMs: toolRes.durationMs,
        };
      }
    }

    skillRegistry.registerSkill(new ToolSkillBridge());
  }
}

export const toolRegistry = new ToolRegistry();
