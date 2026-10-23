import { describe, it, expect, beforeEach, vi } from 'vitest';
import { knowledgeRouter } from '../src/core/knowledge-router';
import { commandRouter } from '../src/core/router';
import { toolRegistry } from '../src/tools/tool-registry';
import { emailTool } from '../src/tools/integrations/email-tool';
import { calendarTool } from '../src/tools/integrations/calendar-tool';
import { fileWorkflowTool } from '../src/tools/integrations/file-workflow-tool';
import { memoryEngine } from '../src/core/memory-engine';
import { killSwitch } from '../src/core/kill-switch';
import { permissionManager } from '../src/core/permission-manager';

describe('Phase 5: Routing & Modular Tool Architecture', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    killSwitch.disengage();
    memoryEngine.clearSessionContext();
  });

  describe('1. Intent Routing', () => {
    it('accurately identifies KNOWLEDGE_RESEARCH intent category', () => {
      const res = knowledgeRouter.classify('What is the current price of gold?');
      expect(res.category).toBe('KNOWLEDGE_RESEARCH');
      expect(res.extractedQuery).toContain('gold');
      expect(res.targetTool).toBe('web_search');
    });

    it('identifies browser-based research intent with target browser', () => {
      const res = knowledgeRouter.classify('Search Google for the latest GST changes and explain them');
      expect(res.category).toBe('KNOWLEDGE_RESEARCH');
      expect(res.targetTool).toBe('browser_research');
      expect(res.extractedQuery?.toLowerCase()).toContain('gst');
    });

    it('accurately identifies COMPUTER_ACTION category', () => {
      const res = knowledgeRouter.classify('Open Safari');
      expect(res.category).toBe('COMPUTER_ACTION');
      expect(res.targetApp).toBe('safari');
    });

    it('accurately identifies EXTERNAL_WORKFLOW for email requests', () => {
      const res = knowledgeRouter.classify('Open Gmail and check my emails');
      expect(res.category).toBe('EXTERNAL_WORKFLOW');
      expect(res.targetTool).toBe('email_workflow');
    });

    it('accurately identifies HYBRID_WORKFLOW combining web research and file save', () => {
      const res = knowledgeRouter.classify('Search the web for Apple M4 and save the result into a file');
      expect(res.category).toBe('HYBRID_WORKFLOW');
      expect(res.subIntents).toContain('web_search');
      expect(res.subIntents).toContain('file_save');
    });
  });

  describe('2. Knowledge vs Action Routing via CommandRouter', () => {
    const dummyContext = {
      registeredProjects: [{ id: 'p1', name: 'Janki', rootPath: '/Users/test/janki' }],
    };

    it('routes "What is the current price of gold?" to web_search without confirmation', async () => {
      const plan = await commandRouter.route('What is the current price of gold?', dummyContext);
      expect(plan.actions.length).toBe(1);
      expect(plan.actions[0].skillId).toBe('web_search');
      expect(plan.actions[0].riskLevel).toBe('LOW');
      expect(plan.actions[0].requiresTypedConfirmation).toBe(false);
    });

    it('routes "Open Safari" to open_application computer action', async () => {
      const plan = await commandRouter.route('Open Safari', dummyContext);
      expect(plan.actions.length).toBe(1);
      expect(plan.actions[0].skillId).toBe('open_application');
      expect(plan.actions[0].params.appName).toBe('Safari');
    });

    it('routes "Open Gmail and check my emails" to email_workflow', async () => {
      const plan = await commandRouter.route('Open Gmail and check my emails', dummyContext);
      expect(plan.actions.length).toBe(1);
      expect(plan.actions[0].skillId).toBe('email_workflow');
      expect(plan.actions[0].params.action).toBe('list_emails');
      expect(plan.actions[0].riskLevel).toBe('LOW');
    });

    it('routes "Search the web and save the result into a file" to compound plan', async () => {
      const plan = await commandRouter.route('Search the web and save the result into a file', dummyContext);
      expect(plan.actions.length).toBe(2);
      expect(plan.actions[0].skillId).toBe('web_search');
      expect(plan.actions[1].skillId).toBe('file_workflow');
      expect(plan.actions[1].params.action).toBe('save_research_summary');
    });
  });

  describe('7. Tool Permission Checking', () => {
    it('blocks execution when required system permission is missing', async () => {
      vi.spyOn(permissionManager, 'getStatus').mockResolvedValue({
        accessibilityGranted: false,
        screenRecordingGranted: false,
        automationGranted: false,
        microphoneGranted: true,
        message: 'Permissions missing',
      });

      const res = await toolRegistry.dispatch(
        'browser_research',
        { query: 'test query' },
        { killSwitchActive: () => false }
      );

      expect(res.status).toBe('BLOCKED');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Missing required system permissions');
    });

    it('allows execution when permissions are satisfied', async () => {
      vi.spyOn(permissionManager, 'getStatus').mockResolvedValue({
        accessibilityGranted: true,
        screenRecordingGranted: true,
        automationGranted: true,
        microphoneGranted: true,
        message: 'All granted',
      });

      const res = await toolRegistry.dispatch(
        'calendar_workflow',
        { action: 'list_events' },
        { killSwitchActive: () => false }
      );

      expect(res.status).toBe('SUCCESS');
      expect(res.success).toBe(true);
    });
  });

  describe('8. Confirmation-Required Actions', () => {
    it('demands confirmation for high-risk email dispatch', async () => {
      const res = await emailTool.execute(
        {
          action: 'send_email',
          to: 'partner@enterprise.org',
          subject: 'Contract Approval',
          body: 'Approved the new terms.',
        },
        {
          confirmedByUser: false, // User has NOT confirmed yet
          killSwitchActive: () => false,
        }
      );

      expect(res.status).toBe('NEEDS_CONFIRMATION');
      expect(res.success).toBe(false);
      expect(res.requiresConfirmation).toBe(true);
      expect(res.confirmationPrompt).toContain('partner@enterprise.org');
    });

    it('executes email send when confirmed by user', async () => {
      const res = await emailTool.execute(
        {
          action: 'send_email',
          to: 'partner@enterprise.org',
          subject: 'Contract Approval',
          body: 'Approved the new terms.',
        },
        {
          confirmedByUser: true, // User confirmed!
          killSwitchActive: () => false,
        }
      );

      expect(res.status).toBe('SUCCESS');
      expect(res.success).toBe(true);
      expect(res.data?.sent).toBe(true);
      expect(res.data?.messageId).toBeDefined();
    });

    it('demands confirmation for permanent file deletion', async () => {
      const res = await fileWorkflowTool.execute(
        {
          action: 'delete_file',
          filePath: '/Users/test/old-draft.txt',
        },
        {
          confirmedByUser: false,
          killSwitchActive: () => false,
        }
      );

      expect(res.status).toBe('NEEDS_CONFIRMATION');
      expect(res.success).toBe(false);
      expect(res.requiresConfirmation).toBe(true);
    });
  });

  describe('9. Tool Execution Failure & Error Handling', () => {
    it('halts and returns BLOCKED when emergency kill-switch is engaged', async () => {
      killSwitch.engage('Manual test lock', 'user-ui');

      const res = await toolRegistry.dispatch(
        'calendar_workflow',
        { action: 'list_events' }
      );

      expect(res.status).toBe('BLOCKED');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Emergency Kill Switch is engaged');
    });

    it('returns FAILED status for invalid tool inputs', async () => {
      const res = await toolRegistry.dispatch(
        'email_workflow',
        { action: 'invalid_action' as any },
        { killSwitchActive: () => false }
      );

      expect(res.status).toBe('FAILED');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Input schema validation failed');
    });
  });

  describe('10. Verification Checks', () => {
    it('verifies created calendar event in calendar tool', async () => {
      const execRes = await calendarTool.execute(
        {
          action: 'create_event',
          timeframe: 'today',
          title: 'Client Demo',
          durationMinutes: 45,
        },
        { killSwitchActive: () => false }
      );

      expect(execRes.success).toBe(true);
      const verifyRes = await calendarTool.verify(
        { action: 'create_event', title: 'Client Demo', durationMinutes: 45, timeframe: 'today' },
        execRes
      );

      expect(verifyRes.verified).toBe(true);
      expect(verifyRes.actualState).toContain('verified');
    });

    it('fails verification when output claims success but required state is unmet', async () => {
      const mockResult = {
        status: 'SUCCESS' as const,
        success: true,
        data: { action: 'create_event', createdEvent: { id: 'non-existent-id', title: 'Missing', startTime: '', durationMinutes: 30 } },
        durationMs: 10,
      };

      const verifyRes = await calendarTool.verify(
        { action: 'create_event', timeframe: 'today', durationMinutes: 30 },
        mockResult
      );

      expect(verifyRes.verified).toBe(false);
      expect(verifyRes.actualState).toContain('missing');
    });
  });

  describe('11. Memory Storage & Retrieval Foundation', () => {
    it('stores and retrieves personal preferences with privacy preservation', () => {
      memoryEngine.setUserPreference('preferredResponseLanguage', 'ml');
      memoryEngine.setUserPreference('defaultBrowser', 'Google Chrome');

      const prefs = memoryEngine.getUserPreferences();
      expect(prefs.preferredResponseLanguage).toBe('ml');
      expect(prefs.defaultBrowser).toBe('Google Chrome');
    });

    it('stores personal memory item with sensitive data redaction', () => {
      const saved = memoryEngine.saveMemory(
        'business_context',
        'api_notes',
        'Testing with token ghp_1234567890abcdefghijklmnopqrstuvwxyzAB',
        true
      );

      expect(saved.isSensitive).toBe(true);
      expect(saved.value).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyzAB');
      expect(saved.value).toContain('[REDACTED_SECRET]');

      const retrieved = memoryEngine.getMemory('business_context', 'api_notes');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.value).toContain('[REDACTED_SECRET]');
    });

    it('stores and retrieves recurring workflow definition', () => {
      memoryEngine.saveRecurringWorkflow(
        'wf-daily-digest',
        'Daily Morning Digest',
        'morning digest',
        { steps: [{ action: 'check_news' }, { action: 'check_calendar' }] }
      );

      const wfs = memoryEngine.getRecurringWorkflows();
      const match = wfs.find((w) => w.id === 'wf-daily-digest');
      expect(match).toBeDefined();
      expect(match?.name).toBe('Daily Morning Digest');
      expect(match?.workflowDefinition.steps.length).toBe(2);
    });

    it('maintains distinct temporary session context without polluting persistent memory', () => {
      memoryEngine.setSessionContext('ephemeral_token', 'temp_123');
      expect(memoryEngine.getSessionContext('ephemeral_token')).toBe('temp_123');

      memoryEngine.clearSessionContext();
      expect(memoryEngine.getSessionContext('ephemeral_token')).toBeUndefined();
    });
  });
});
