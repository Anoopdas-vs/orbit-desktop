import { ActionPlan, ActionItem } from '../types/action-plan';
import { killSwitch } from './kill-switch';
import { detectAmbiguity } from './ambiguity-detector';
import { defaultPolicyEngine } from './policy-engine';
import { conversationalContext } from './conversational-context';
import { resolvePlayableUrl } from '../skills/youtube-launcher';
import { checkApplicationAvailability } from '../skills/app-availability';
import { youtubeAdSkipperDaemon } from '../skills/youtube-ad-skipper';
import { personaEngine } from './persona-engine';
import { moodIntelligence } from '../skills/mood-intelligence';
import { tradingAdvisoryDesk } from '../skills/trading-advisory';
import { actionPlanner } from './action-planner';
import { contextualIntentResolver } from './contextual-intent-resolver';
import { dynamicPlanner } from './dynamic-planner';
import { taskContextManager } from '../context/task-context-manager';
import { knowledgeRouter } from './knowledge-router';

export interface RouterContext {
  registeredProjects: { id: string; name: string; rootPath: string }[];
  currentProjectId?: string;
  isDryRun?: boolean;
  fastMode?: boolean;
}

export class CommandRouter {
  /**
   * Parse a natural-language text or transcribed voice prompt into a structured ActionPlan
   */
  public async route(prompt: string, context: RouterContext): Promise<ActionPlan> {
    const rawTrimmed = prompt.trim();

    // 1. Strip wake word prefixes: "hey janki", "hei janki", "janki", "hello janki"
    const cleanedPrompt = rawTrimmed.replace(/^(?:hey|hei|hi|hello)?\s*janki[,:.\- ]*/i, '').trim();
    const effectivePrompt = cleanedPrompt.length > 0 ? cleanedPrompt : rawTrimmed;
    const lower = effectivePrompt.toLowerCase();

    // 2. Check if user only said the wake word ("Hey Janki", "Janki")
    if (
      cleanedPrompt.length === 0 &&
      /(?:hey|hei|hi|hello)?\s*\bjanki\b/i.test(rawTrimmed)
    ) {
      return {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        userPrompt: rawTrimmed,
        interpretedIntent: "Janki Awakened",
        overallRisk: 'LOW',
        isDryRun: false,
        status: 'AWAITING_APPROVAL',
        clarificationNeeded: "I'm listening. What would you like me to do?",
        actions: []
      };
    }

    // 3. Check for immediate Emergency Stop / Kill commands
    if (
      lower === 'stop' ||
      lower === 'cancel' ||
      lower === 'emergency stop' ||
      lower === 'emergency kill' ||
      lower === 'kill'
    ) {
      const killed = killSwitch.engage(`User emergency voice/text command: "${rawTrimmed}"`, 'voice-emergency-stop');
      conversationalContext.clearPendingProposal();
      return {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        userPrompt: rawTrimmed,
        interpretedIntent: 'Emergency Stop Engaged',
        overallRisk: 'LOW',
        isDryRun: false,
        status: 'ABORTED_BY_KILL_SWITCH',
        actions: [
          {
            id: crypto.randomUUID(),
            skillId: 'kill_switch',
            title: 'Emergency Stop',
            description: `All active subprocesses halted (${killed} stopped). Trading and execution locked.`,
            riskLevel: 'LOW',
            params: { killedCount: killed },
            status: 'COMPLETED',
            expectedEffect: 'Lockdown application into read-only state',
            requiresTypedConfirmation: false,
            dryRunSupported: false,
          }
        ]
      };
    }

    if (lower === 'trading off' || lower === 'turn trading off' || lower === 'disable trading') {
      defaultPolicyEngine.updateConfig({ tradingEnabled: false, tradingMode: 'OFF' });
      return {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        userPrompt: rawTrimmed,
        interpretedIntent: 'Disable Trading Module',
        overallRisk: 'LOW',
        isDryRun: false,
        status: 'COMPLETED',
        actions: [
          {
            id: crypto.randomUUID(),
            skillId: 'trading_toggle',
            title: 'Turn Trading Off',
            description: 'Disabled all trading modules and switched mode to OFF.',
            riskLevel: 'LOW',
            params: { enabled: false },
            status: 'COMPLETED',
            expectedEffect: 'Trading API calls and paper orders disarmed',
            requiresTypedConfirmation: false,
            dryRunSupported: false,
          }
        ]
      };
    }

    // 4. Check Multi-Turn Conversational Context (Affirmative / Negative follow-up responses)
    if (conversationalContext.hasPendingProposal()) {
      const proposal = conversationalContext.getPendingProposal()!;

      // User says "yes", "yeah", "sure", "ok", "open in chrome", "open via chrome", "play it"
      if (conversationalContext.isAffirmative(effectivePrompt)) {
        conversationalContext.clearPendingProposal();

        if (proposal.type === 'OPEN_YOUTUBE_CHROME') {
          return {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            userPrompt: rawTrimmed,
            interpretedIntent: 'Open YouTube in Google Chrome (Confirmed)',
            overallRisk: 'LOW',
            isDryRun: !!context.isDryRun,
            status: 'AWAITING_APPROVAL',
            actions: [
              {
                id: crypto.randomUUID(),
                skillId: 'youtube_launcher',
                title: 'Open YouTube in Chrome',
                description: `Confirmed fallback: open YouTube in Google Chrome to play "${proposal.musicQuery || 'relaxing music'}"`,
                riskLevel: 'LOW',
                params: {
                  query: proposal.musicQuery || 'relaxing music',
                  forceBrowser: true,
                  browser: 'Google Chrome',
                },
                status: 'PENDING_APPROVAL',
                expectedEffect: 'Opens Google Chrome with YouTube music playback',
                requiresTypedConfirmation: false,
                dryRunSupported: true,
              }
            ]
          };
        }
      }

      // User says "no", "cancel", "never mind"
      if (conversationalContext.isNegative(effectivePrompt)) {
        conversationalContext.clearPendingProposal();
        return {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          userPrompt: rawTrimmed,
          interpretedIntent: 'Fallback Cancelled',
          overallRisk: 'LOW',
          isDryRun: false,
          status: 'COMPLETED',
          actions: [
            {
              id: crypto.randomUUID(),
              skillId: 'general_assistant',
              title: 'Cancelled',
              description: 'Cancelled opening YouTube via Google Chrome.',
              riskLevel: 'LOW',
              params: { cancelled: true },
              status: 'COMPLETED',
              expectedEffect: 'No browser or app opened',
              requiresTypedConfirmation: false,
              dryRunSupported: false,
            }
          ]
        };
      }

      // User provides another song while proposal is active (e.g. "play Bohemian Rhapsody", "Believer", "Shape of You")
      if (proposal.type === 'OPEN_YOUTUBE_CHROME') {
        const potentialSong = effectivePrompt
          .replace(/^(?:can you\s+)?(?:please\s+)?(?:play|sing|listen to|hear)\s+/i, '')
          .replace(/^(?:i want|i'd like|how about|switch to|change to)\s+(?:to\s+listen\s+to\s+)?(?:play\s+)?/i, '')
          .replace(/on youtube/i, '')
          .trim();

        if (potentialSong.length > 1 && !['yes', 'no', 'cancel', 'stop', 'quit', 'exit'].includes(potentialSong.toLowerCase())) {
          const { targetUrl } = resolvePlayableUrl(potentialSong);
          const updateQuestion = `The YouTube desktop app is not installed on your Mac. Would you like me to open Google Chrome and play "${potentialSong}"?`;

          conversationalContext.setPendingProposal({
            type: 'OPEN_YOUTUBE_CHROME',
            question: updateQuestion,
            targetUrl,
            appName: 'Google Chrome',
            musicQuery: potentialSong,
            onConfirmTitle: `Play "${potentialSong}" in Google Chrome`,
            onConfirmDescription: `Launch Google Chrome to directly play "${potentialSong}" on YouTube`,
            params: { query: potentialSong, forceBrowser: true, browser: 'Google Chrome' },
          });

          return {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            userPrompt: rawTrimmed,
            interpretedIntent: `Play "${potentialSong}" on YouTube`,
            overallRisk: 'LOW',
            isDryRun: !!context.isDryRun,
            status: 'AWAITING_APPROVAL',
            clarificationNeeded: updateQuestion,
            actions: [
              {
                id: crypto.randomUUID(),
                skillId: 'youtube_launcher',
                title: `Play "${potentialSong}" on YouTube`,
                description: `Updated song choice: open Google Chrome for "${potentialSong}"`,
                riskLevel: 'LOW',
                params: {
                  query: potentialSong,
                  forceBrowser: false,
                  browser: 'Google Chrome',
                },
                status: 'PENDING_APPROVAL',
                expectedEffect: `Opens Google Chrome and plays "${potentialSong}"`,
                requiresTypedConfirmation: false,
                dryRunSupported: true,
              },
            ],
          };
        }
      }
    }

    // 5. Check for Ambiguity
    const projectNames = context.registeredProjects.map(p => p.name);
    const ambiguityCheck = detectAmbiguity(effectivePrompt, projectNames);

    if (ambiguityCheck.isAmbiguous) {
      return {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        userPrompt: rawTrimmed,
        interpretedIntent: 'Clarification Needed',
        overallRisk: 'LOW',
        isDryRun: false,
        status: 'AWAITING_APPROVAL',
        clarificationNeeded: ambiguityCheck.clarificationQuestion,
        actions: []
      };
    }

    // 5.5 Check Contextual Intent Resolution (Phase 3 Stage 2)
    const contextual = contextualIntentResolver.resolve(effectivePrompt);
    const resolvedPrompt = contextual.isContextual ? contextual.canonicalPrompt : effectivePrompt;

    // 6. Deterministic Routing Rules
    const actions: ActionItem[] = [];
    let interpretedIntent = 'Unknown Command';

    const personaDetected = personaEngine.detectPersonaRequest(effectivePrompt);
    const isPersonaIntent =
      personaDetected &&
      (lower.includes('act as') ||
        lower.includes('be my') ||
        lower.includes('switch to') ||
        lower.includes('mode') ||
        lower.includes('talk like') ||
        lower.includes('talk to me as') ||
        lower.startsWith('become '));

    // P0. Chameleon Persona Transition ("act as my spiritual leader", "be my mentor", etc.)
    if (isPersonaIntent && personaDetected) {
      const newProfile = personaEngine.setPersona(personaDetected);
      interpretedIntent = `Switch Persona: ${newProfile.name}`;
      const greeting = personaEngine.getRandomGreeting(personaDetected);

      actions.push({
        id: crypto.randomUUID(),
        skillId: 'persona_switch',
        title: `Engage ${newProfile.name}`,
        description: `${newProfile.icon} ${newProfile.tagline}`,
        riskLevel: 'LOW',
        params: {
          persona: personaDetected,
          name: newProfile.name,
          greeting,
        },
        status: 'PENDING_APPROVAL',
        expectedEffect: `Transitions Janki to ${newProfile.name} mode and emits spoken welcome`,
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // P1. Autonomous Multi-Tool Report Generation ("create a report on...", "generate analysis on...")
    else if (
      lower.startsWith('create a report') ||
      lower.startsWith('create report') ||
      lower.startsWith('generate report') ||
      lower.startsWith('generate a report') ||
      lower.startsWith('make a report') ||
      lower.includes('prepare a report') ||
      lower.includes('create an analysis') ||
      lower.includes('generate analysis')
    ) {
      const topic = effectivePrompt
        .replace(/^(?:create|generate|make|prepare)\s+(?:a\s+|an\s+)?(?:report|analysis)\s+(?:on|about|for)?/i, '')
        .trim() || 'Strategic Innovation & Market Execution';

      interpretedIntent = `Generate Autonomous Report: ${topic.slice(0, 30)}`;
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'autonomous_reporter',
        title: `Generate Report: "${topic.slice(0, 35)}"`,
        description: 'Autonomously select research/analytics toolchain, synthesize data, and compile structured report.',
        riskLevel: 'LOW',
        params: { topic },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Compiles and saves comprehensive report to disk with voice summary',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // P2. Mood Intelligence & Contextual Music ("play a song based on my mood", "i had a rough day play music")
    else if (
      lower.includes('mood') ||
      (lower.includes('play') &&
        (lower.includes('feeling') ||
          lower.includes('tired') ||
          lower.includes('stress') ||
          lower.includes('rough day') ||
          lower.includes('vibe') ||
          lower.includes('exhausted')))
    ) {
      const moodProfile = moodIntelligence.analyzeMood(effectivePrompt);
      interpretedIntent = `Play Mood Music (${moodProfile.label})`;

      youtubeAdSkipperDaemon.startDaemon(1000);

      actions.push({
        id: crypto.randomUUID(),
        skillId: 'mood_music',
        title: `Mood Soundtrack: ${moodProfile.suggestedTrackTitle}`,
        description: `${moodProfile.badge} | ${moodProfile.empathyResponse}`,
        riskLevel: 'LOW',
        params: {
          mood: moodProfile.mood,
          trackTitle: moodProfile.suggestedTrackTitle,
          query: moodProfile.youtubeQuery,
          directVideoId: moodProfile.directVideoId,
          empathyResponse: moodProfile.empathyResponse,
        },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Plays curated mood music on YouTube with auto-skip ads and voice empathy',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // P3. Binance Technical Level Analysis & Trade Advisory ("open binance and advise me if i should trade")
    else if (
      (lower.includes('binance') &&
        (lower.includes('trade') ||
          lower.includes('advis') ||
          lower.includes('level') ||
          lower.includes('time') ||
          lower.includes('should i') ||
          lower.includes('good time') ||
          lower.includes('best time'))) ||
      lower.includes('should i trade') ||
      lower.includes('is this the best time to trade') ||
      lower.includes('best time to trade') ||
      lower.includes('check btc levels')
    ) {
      const symbol = lower.includes('eth') ? 'ETHUSDT' : lower.includes('sol') ? 'SOLUSDT' : 'BTCUSDT';
      interpretedIntent = `Binance Technical Trade Advisory (${symbol})`;

      actions.push({
        id: crypto.randomUUID(),
        skillId: 'trading_advisory',
        title: `Analyze ${symbol} & Advise Trade Entry`,
        description: 'Fetch live market feed, compute RSI & 24h levels, determine if now is the best time to enter.',
        riskLevel: 'LOW',
        params: { symbol, openBinanceUrl: true },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Provides technical level breakdown, trade verdict, and opens Binance desk',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // P3.4. Phase 6: Document / PDF / Screen Inspection Workflow
    // e.g. "open WPS from my computer and check a policy number is on the already opened PDF give me the policy number"
    // e.g. "check policy number on the already opened PDF", "find policy number on screen"
    else if (
      (lower.includes('policy number') || lower.includes('policy') || lower.includes('invoice number') || lower.includes('opened pdf') || lower.includes('opened document') || (lower.includes('wps') && (lower.includes('check') || lower.includes('pdf') || lower.includes('policy')))) &&
      (lower.includes('wps') || lower.includes('pdf') || lower.includes('check') || lower.includes('find') || lower.includes('locate') || lower.includes('give me') || lower.includes('inspect'))
    ) {
      const wantsWps = lower.includes('wps');
      const wantsPreview = lower.includes('preview');
      const wantsAcrobat = lower.includes('acrobat');
      const appName = wantsWps ? 'WPS Office' : wantsPreview ? 'Preview' : wantsAcrobat ? 'Adobe Acrobat' : undefined;
      const queryText = lower.includes('policy') ? 'policy number' : lower.includes('invoice') ? 'invoice number' : 'document number';

      interpretedIntent = appName
        ? `Open ${appName} & Inspect Document for ${queryText}`
        : `Inspect Document / Screen for ${queryText}`;

      if (appName) {
        actions.push({
          id: crypto.randomUUID(),
          skillId: 'open_application',
          title: `Activate / Open ${appName}`,
          description: `Bring ${appName} to the foreground to inspect the open document`,
          riskLevel: 'LOW',
          params: { appName },
          status: 'PENDING_APPROVAL',
          expectedEffect: `Brings ${appName} to active focus on macOS`,
          requiresTypedConfirmation: false,
          dryRunSupported: true,
        });
      }

      actions.push({
        id: crypto.randomUUID(),
        skillId: 'screen_skill',
        title: `Locate ${queryText} on Screen / PDF`,
        description: `Inspect active application window for ${queryText} and extract matching text`,
        riskLevel: 'LOW',
        params: {
          action: 'find_text_on_screen',
          queryText,
        },
        status: 'PENDING_APPROVAL',
        expectedEffect: `Scans document content and returns visible ${queryText}`,
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // P3.5. Phase 6: Multimodal Screen / Vision Understanding ("What is on my screen?", "Find invoice number on screen")
    else if (
      lower.includes('on my screen') ||
      lower.includes('on screen') ||
      lower.includes('what is showing') ||
      lower.includes('what am i looking at') ||
      (lower.includes('find') && (lower.includes('invoice') || lower.includes('number')) && (lower.includes('screen') || lower.includes('here'))) ||
      lower.includes('inspect screen')
    ) {
      const isFindingText = lower.includes('find') || lower.includes('locate') || lower.includes('invoice');
      const action = isFindingText ? 'find_text_on_screen' : 'explain_screen';
      const queryText = isFindingText
        ? (lower.match(/(?:find|locate)\s+(?:the\s+)?([a-zA-Z0-9\s_-]+?)(?:\s+on|\s+in|$)/i)?.[1] || 'invoice number').trim()
        : undefined;

      interpretedIntent = isFindingText ? `Find On-Screen: ${queryText}` : 'Multimodal Screen Inspection';

      actions.push({
        id: crypto.randomUUID(),
        skillId: 'screen_skill',
        title: isFindingText ? `Locate "${queryText}" on Screen` : 'Inspect & Explain Screen Content',
        description: 'Observe active desktop windows, parse UI controls, and analyze visual elements',
        riskLevel: 'LOW',
        params: {
          action,
          queryText,
        },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Captures and explains active desktop application and visible controls',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // P4. Phase 5: Hybrid Multi-Step Workflow ("Search the web and save the result into a file")
    else if (
      (lower.includes('search') || lower.includes('research')) &&
      (lower.includes('save') || lower.includes('write to a file') || lower.includes('save into a file') || lower.includes('save to file'))
    ) {
      const classification = knowledgeRouter.classify(effectivePrompt);
      interpretedIntent = classification.interpretedIntent;
      const query = classification.extractedQuery || 'latest technology updates';

      actions.push({
        id: crypto.randomUUID(),
        skillId: 'web_search',
        title: `Search Web: "${query.slice(0, 30)}"`,
        description: 'Query live web and collect recent factual intelligence',
        riskLevel: 'LOW',
        params: { query, maxResults: 5 },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Retrieves relevant factual search records',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });

      actions.push({
        id: crypto.randomUUID(),
        skillId: 'file_workflow',
        title: 'Save Research Summary to File',
        description: 'Save synthesized research report to ~/Downloads/research_summary.md',
        riskLevel: 'LOW',
        params: {
          action: 'save_research_summary',
          filePath: '~/Downloads/research_summary.md',
          content: '{{steps.step_1.output.summary}}',
        },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Writes research findings to markdown file',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // P5. Phase 5: External Application Workflow (Email, Calendar)
    else if (
      (lower.includes('email') || lower.includes('gmail') || lower.includes('inbox') || lower.includes('mail from')) &&
      !lower.startsWith('open safari')
    ) {
      const classification = knowledgeRouter.classify(effectivePrompt);
      interpretedIntent = classification.interpretedIntent;

      if (lower.startsWith('send ') || lower.includes('send this email') || lower.includes('send email to')) {
        const toMatch = lower.match(/(?:to\s+)([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        const to = toMatch ? toMatch[1] : 'recipient@example.com';
        interpretedIntent = `Send Email to ${to}`;

        actions.push({
          id: crypto.randomUUID(),
          skillId: 'email_workflow',
          title: `Send Email to ${to}`,
          description: `Dispatch email to ${to} (Requires User Approval)`,
          riskLevel: 'HIGH',
          params: { action: 'send_email', to, subject: 'Update from Janki Assistant', body: 'Drafted via Janki Assistant.' },
          status: 'PENDING_APPROVAL',
          expectedEffect: `Dispatches email to ${to} upon explicit confirmation`,
          requiresTypedConfirmation: true,
          dryRunSupported: true,
        });
      } else if (lower.includes('summarize') || lower.includes('from ')) {
        const fromMatch = lower.match(/(?:from)\s+([a-zA-Z0-9@._-]+)/i);
        const filter = fromMatch ? fromMatch[1] : undefined;
        actions.push({
          id: crypto.randomUUID(),
          skillId: 'email_workflow',
          title: `Summarize Email${filter ? ` from ${filter}` : ''}`,
          description: `Retrieve and summarize email from ${filter || 'recent inbox'}`,
          riskLevel: 'LOW',
          params: { action: 'summarize_email', filter },
          status: 'PENDING_APPROVAL',
          expectedEffect: 'Reads and summarizes targeted email message',
          requiresTypedConfirmation: false,
          dryRunSupported: true,
        });
      } else {
        actions.push({
          id: crypto.randomUUID(),
          skillId: 'email_workflow',
          title: 'Check Recent Emails',
          description: 'Fetch recent inbox messages and unread notices',
          riskLevel: 'LOW',
          params: { action: 'list_emails' },
          status: 'PENDING_APPROVAL',
          expectedEffect: 'Lists recent emails from inbox',
          requiresTypedConfirmation: false,
          dryRunSupported: true,
        });
      }
    }

    // P5.5. Phase 6: Calendar Queries ("What meetings do I have today?", "Schedule meeting")
    else if (
      lower.includes('meeting') ||
      lower.includes('calendar') ||
      lower.includes('schedule') ||
      lower.includes('appointments')
    ) {
      interpretedIntent = 'Calendar Schedule Management';
      const isCreate = lower.startsWith('schedule') || lower.startsWith('create meeting') || lower.startsWith('book ');

      if (isCreate) {
        const titleMatch = effectivePrompt.replace(/^(?:schedule|create meeting|book)\s+/i, '').trim();
        actions.push({
          id: crypto.randomUUID(),
          skillId: 'calendar_workflow',
          title: `Schedule Meeting: "${titleMatch.slice(0, 30)}"`,
          description: 'Create new calendar event in Google Calendar',
          riskLevel: 'MEDIUM',
          params: { action: 'create_event', title: titleMatch || 'New Meeting' },
          status: 'PENDING_APPROVAL',
          expectedEffect: 'Adds event to calendar',
          requiresTypedConfirmation: false,
          dryRunSupported: true,
        });
      } else {
        actions.push({
          id: crypto.randomUUID(),
          skillId: 'calendar_workflow',
          title: "Check Today's Schedule",
          description: 'Fetch events and meetings from calendar',
          riskLevel: 'LOW',
          params: { action: 'list_events' },
          status: 'PENDING_APPROVAL',
          expectedEffect: 'Retrieves calendar events',
          requiresTypedConfirmation: false,
          dryRunSupported: true,
        });
      }
    }

    // P6. Phase 5: Google / Browser Research ("Search Google for the latest GST changes and explain them")
    else if (
      lower.includes('search google') ||
      lower.includes('google search') ||
      lower.includes('search in google') ||
      (lower.includes('search') && lower.includes('and explain')) ||
      (lower.includes('search') && lower.includes('and tell me'))
    ) {
      const classification = knowledgeRouter.classify(effectivePrompt);
      interpretedIntent = classification.interpretedIntent;
      const query = classification.extractedQuery || 'current updates';

      actions.push({
        id: crypto.randomUUID(),
        skillId: 'browser_research',
        title: `Google Research: "${query.slice(0, 30)}"`,
        description: `Execute Google search in Safari and synthesize findings`,
        riskLevel: 'LOW',
        params: { query, browser: 'Safari', searchEngine: 'google' },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Performs controlled browser research and extracts page findings',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // P6.5. Phase 6: Long-Term Memory Retrieval ("Remind me what I usually use this app for", "What are my preferences")
    else if (
      lower.includes('remind me what i usually use') ||
      lower.includes('what do i use this for') ||
      lower.includes('what are my preferences') ||
      lower.includes('remember what') ||
      lower.includes('what did i decide')
    ) {
      interpretedIntent = 'Retrieve Long-Term Memory';
      const targetApp = lower.match(/(?:for|use)\s+([a-zA-Z0-9\s_-]+)$/i)?.[1]?.trim() || 'this application';

      actions.push({
        id: crypto.randomUUID(),
        skillId: 'document_skill',
        title: `Recall Memory: ${targetApp}`,
        description: `Retrieve long-term memory and usage context for ${targetApp}`,
        riskLevel: 'LOW',
        params: {
          action: 'read_document',
          path: `memory://${targetApp}`,
        },
        status: 'PENDING_APPROVAL',
        expectedEffect: `Recalls stored historical context and user preferences for ${targetApp}`,
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // P7. Phase 5: Web Intelligence & Knowledge Questions (English & Malayalam)
    else if (
      lower.startsWith('what is') ||
      lower.startsWith("what's") ||
      lower.startsWith('who is') ||
      lower.startsWith('how to') ||
      lower.startsWith('why is') ||
      lower.startsWith('explain ') ||
      lower.startsWith('tell me about ') ||
      lower.includes('price of ') ||
      lower.includes('latest information about') ||
      lower.includes('news about') ||
      lower.includes('current price') ||
      /[\u0D00-\u0D7F]/.test(rawTrimmed)
    ) {
      const classification = knowledgeRouter.classify(effectivePrompt);
      interpretedIntent = classification.interpretedIntent;
      const query = classification.extractedQuery || effectivePrompt;

      actions.push({
        id: crypto.randomUUID(),
        skillId: 'web_search',
        title: `Web Research: "${query.slice(0, 35)}"`,
        description: 'Conduct reliable web research, analyze recency, and synthesize answer',
        riskLevel: 'LOW',
        params: {
          query,
          maxResults: 5,
          isMalayalam: classification.isLanguageMalayalam,
        },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Researches live web and provides synthesized voice/text answer',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // A1. "skip ad", "skip youtube ad", "auto skip ads"
    else if (
      lower.includes('skip ad') ||
      lower.includes('skip youtube ad') ||
      lower.includes('skip ads') ||
      lower.includes('auto skip') ||
      lower === 'skip'
    ) {
      interpretedIntent = 'Skip YouTube Ad';
      const isAuto = lower.includes('auto');
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'youtube_ad_skipper',
        title: isAuto ? 'Enable Auto-Skip YouTube Ads' : 'Skip YouTube Ad Now',
        description: isAuto
          ? 'Start automated background watcher daemon to skip YouTube ads every 1.5s'
          : 'Query Google Chrome tabs and click YouTube Skip Ad button immediately',
        riskLevel: 'LOW',
        params: { action: isAuto ? 'start_daemon' : 'skip_now' },
        status: 'PENDING_APPROVAL',
        expectedEffect: isAuto
          ? 'Engages background watcher for zero-click ad skipping'
          : 'Instantly skips current YouTube ad',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // A2. "ask chatgpt [prompt]", "prompt chatgpt", "chatgpt [prompt]"
    else if (
      lower.startsWith('ask chatgpt') ||
      lower.startsWith('prompt chatgpt') ||
      lower.startsWith('tell chatgpt') ||
      lower.startsWith('chatgpt ') ||
      lower === 'chatgpt'
    ) {
      interpretedIntent = 'Prompt ChatGPT';
      const promptQuery = effectivePrompt
        .replace(/^(?:ask|prompt|tell)?\s*chatgpt\s*(?:to|about|for)?/i, '')
        .trim() || 'Hello';

      const appCheck = await checkApplicationAvailability('chatgpt');

      actions.push({
        id: crypto.randomUUID(),
        skillId: 'ai_prompt_agent',
        title: `Ask ChatGPT: "${promptQuery.slice(0, 30)}${promptQuery.length > 30 ? '...' : ''}"`,
        description: `Verified ChatGPT availability: ${appCheck.available ? 'Native app installed' : 'Web browser mode'}. Fastest execution mode: ${appCheck.fastestMode}.`,
        riskLevel: 'LOW',
        params: { tool: 'chatgpt', prompt: promptQuery },
        status: 'PENDING_APPROVAL',
        expectedEffect: `Dispatches prompt to ChatGPT via ${appCheck.fastestMode}`,
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // A3. "ask claude [prompt]", "prompt claude", "claude [prompt]"
    else if (
      lower.startsWith('ask claude') ||
      lower.startsWith('prompt claude') ||
      lower.startsWith('tell claude') ||
      lower.startsWith('claude ') ||
      lower === 'claude'
    ) {
      interpretedIntent = 'Prompt Claude';
      const promptQuery = effectivePrompt
        .replace(/^(?:ask|prompt|tell)?\s*claude\s*(?:to|about|for)?/i, '')
        .trim() || 'Hello';

      const appCheck = await checkApplicationAvailability('claude');

      actions.push({
        id: crypto.randomUUID(),
        skillId: 'ai_prompt_agent',
        title: `Ask Claude: "${promptQuery.slice(0, 30)}${promptQuery.length > 30 ? '...' : ''}"`,
        description: `Verified Claude availability: ${appCheck.available ? 'Native app installed' : 'Web browser mode'}. Fastest execution mode: ${appCheck.fastestMode}.`,
        riskLevel: 'LOW',
        params: { tool: 'claude', prompt: promptQuery },
        status: 'PENDING_APPROVAL',
        expectedEffect: `Dispatches prompt to Claude via ${appCheck.fastestMode}`,
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // A4. Native GUI Controls: "click button [name]", "click [button]"
    else if (
      lower.startsWith('click button ') ||
      (lower.startsWith('click ') && (lower.includes('button') || lower.includes('submit') || lower.includes('skip') || lower.includes('save') || lower.includes('next') || lower.includes('ok') || lower.includes('cancel') || lower.includes('close')))
    ) {
      const targetButton = effectivePrompt.replace(/^click\s+(?:button\s+)?/i, '').replace(/button/i, '').trim();
      interpretedIntent = `Click Button "${targetButton}"`;
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'gui_controller',
        title: `Click Button: ${targetButton}`,
        description: `Dispatches native AppleScript click to "${targetButton}" in the frontmost window`,
        riskLevel: 'MEDIUM',
        params: { action: 'click_button', target: targetButton },
        status: 'PENDING_APPROVAL',
        expectedEffect: `Triggers native click on "${targetButton}"`,
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // A5. "type [text]", "write [text]", "fill form [text]"
    else if (lower.startsWith('type ') || lower.startsWith('write ') || lower.startsWith('fill form ')) {
      const textToType = effectivePrompt.replace(/^(?:type|write|fill form)\s+/i, '').trim();
      interpretedIntent = 'Type Text into Active Window';
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'gui_controller',
        title: `Type: "${textToType.slice(0, 30)}${textToType.length > 30 ? '...' : ''}"`,
        description: `Dispatches keystrokes to the focused macOS UI field`,
        riskLevel: 'MEDIUM',
        params: { action: 'type_text', text: textToType },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Inputs text into active macOS window',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // A6. "press enter", "press return", "press tab", "press escape"
    else if (lower === 'press enter' || lower === 'press return' || lower === 'press tab' || lower === 'press escape' || lower === 'press space') {
      const keyName = lower.replace('press ', '').trim();
      interpretedIntent = `Press Key ${keyName.toUpperCase()}`;
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'gui_controller',
        title: `Press Key: ${keyName}`,
        description: `Dispatches native keycode event for ${keyName}`,
        riskLevel: 'LOW',
        params: { action: 'press_key', key: keyName },
        status: 'PENDING_APPROVAL',
        expectedEffect: `Simulates pressing ${keyName} key`,
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // A. "open youtube and play some music", "open youtube", "play music on youtube", "play some music"
    else if (
      lower.includes('youtube') ||
      lower.includes('lajjavathiye') ||
      lower.startsWith('play ') ||
      (lower.includes('play') && (lower.includes('music') || lower.includes('song') || lower.includes('lofi') || lower.includes('jazz')))
    ) {
      interpretedIntent = 'Launch YouTube & Play Music';

      // Automatically engage background YouTube ad skipper daemon for music playback
      youtubeAdSkipperDaemon.startDaemon(1500);

      // Extract music search term if specified
      let musicQuery = 'some music';
      if (lower.startsWith('play ')) {
        const afterPlay = lower.replace(/^play\s+/i, '').replace(/on youtube/i, '').trim();
        if (afterPlay) {
          musicQuery = afterPlay;
        }
      } else if (lower.includes('play')) {
        const afterPlay = lower.replace(/^.*play\s+/i, '').replace(/on youtube/i, '').trim();
        if (afterPlay) {
          musicQuery = afterPlay;
        }
      } else if (lower.includes('lajjavathiye')) {
        musicQuery = 'lajjavathiye';
      }

      const isFast = !!context.fastMode;
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'youtube_launcher',
        title: 'Open YouTube & Play Music',
        description: isFast
          ? `Fast Mode: Launch Google Chrome immediately with "${musicQuery}" direct playback & Turbo Ad-Skipper`
          : `Check for YouTube desktop app; fallback to Google Chrome for "${musicQuery}" (Ad-skipper auto-engaged)`,
        riskLevel: 'LOW',
        params: {
          query: musicQuery,
          forceBrowser: isFast,
          browser: 'Google Chrome',
        },
        status: 'PENDING_APPROVAL',
        expectedEffect: isFast
          ? 'Fastest mode: Opens Google Chrome and plays video directly with auto-skip ads'
          : 'Checks for YouTube desktop app or asks to open in Google Chrome with auto-skip ads',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // B. "Open my web app project" or "Open [app]"
    else if (lower.includes('open my web app') || lower.includes('open project') || lower.includes('open web app')) {
      const activeProject = context.currentProjectId
        ? context.registeredProjects.find(p => p.id === context.currentProjectId)
        : context.registeredProjects[0];

      interpretedIntent = 'Open Web App Project';
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'open_application',
        title: 'Open Antigravity / IDE',
        description: `Open project directory "${activeProject ? activeProject.name : 'Web App'}" in Antigravity`,
        riskLevel: 'LOW',
        params: {
          appName: 'Antigravity',
          path: activeProject ? activeProject.rootPath : '/Users/anoopdasvs/Downloads/Janki_M book_automation'
        },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Launches Antigravity with the project folder',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // P2. Autonomous Multi-Step Computer Control Planner (Phase 2 & Phase 3)
    // E.g. "Open Safari and search for...", "Open Calculator and calculate...", "Set volume to 40", Malayalam queries, Contextual follow-ups
    else if (
      (() => {
        // 1. Try Phase 3 Dynamic Planner first (handles contextual resolution & compound goals)
        const dynamicTask = dynamicPlanner.decomposeGoal(resolvedPrompt, contextual.resolvedApp);
        if (dynamicTask && dynamicTask.steps.length > 0) {
          interpretedIntent = dynamicTask.interpretedIntent;
          actions.push(...dynamicPlanner.toActionItems(dynamicTask));
          return true;
        }

        // 2. Fallback to Phase 2 ActionPlanner
        const planned = actionPlanner.plan(effectivePrompt);
        if (
          planned &&
          planned.steps.length > 0 &&
          (planned.steps.length > 1 ||
            lower.includes('search') ||
            lower.includes('calculate') ||
            lower.includes('volume') ||
            lower.includes('mute') ||
            lower.includes('minimize') ||
            lower.includes('maximize') ||
            lower.includes('zoom') ||
            lower.includes('close window') ||
            planned.language !== 'en')
        ) {
          interpretedIntent = planned.interpretedIntent;
          actions.push(...actionPlanner.toActionItems(planned));
          return true;
        }
        return false;
      })()
    ) {
      // Intentionally empty: actions populated above
    }

    else if (lower.startsWith('open ') && !lower.includes('binance') && !lower.includes('youtube')) {
      let rawTarget = effectivePrompt.replace(/^open\s+/i, '').trim();
      rawTarget = rawTarget
        .replace(/\s+from\s+my\s+computer/i, '')
        .replace(/\s+on\s+my\s+mac/i, '')
        .replace(/\s+application$/i, '')
        .replace(/\s+app$/i, '')
        .trim();
      const appTarget = rawTarget.toLowerCase() === 'wps' ? 'WPS Office' : rawTarget;
      const appCheck = await checkApplicationAvailability(appTarget);

      interpretedIntent = `Open Application ${appTarget}`;
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'open_application',
        title: `Open ${appTarget}`,
        description: appCheck.available
          ? `Pre-check verified: ${appTarget} is installed locally. Fastest execution mode: native app.`
          : `Pre-check notice: ${appTarget} is not installed locally. Launching via fallback browser/default handler.`,
        riskLevel: 'LOW',
        params: { appName: appTarget },
        status: 'PENDING_APPROVAL',
        expectedEffect: `Opens macOS application "${appTarget}"`,
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // C. "Start the development server"
    else if (lower.includes('start the development server') || lower.includes('start dev server') || lower.includes('run dev')) {
      interpretedIntent = 'Start Development Server';
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'terminal_runner',
        title: 'Start Dev Server',
        description: 'Run allowlisted command: npm run dev',
        riskLevel: 'MEDIUM',
        params: { command: 'npm run dev', timeoutMs: 30000 },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Launches local development server on port 3000/5173',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // D. "Run tests"
    else if (lower === 'run tests' || lower.includes('run test') || lower.includes('npm test')) {
      interpretedIntent = 'Execute Test Suite';
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'terminal_runner',
        title: 'Run Tests',
        description: 'Execute allowlisted test suite: npm test',
        riskLevel: 'MEDIUM',
        params: { command: 'npm test', timeoutMs: 60000 },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Runs automated unit and integration tests and captures exit code',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // E. "Add a dark mode feature to my web app" / Feature flow
    else if (lower.includes('dark mode') || (lower.includes('add') && lower.includes('feature'))) {
      interpretedIntent = 'Generate Feature Specification & Plan';
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'feature_spec_generator',
        title: 'Draft Feature Spec',
        description: 'Inspect repository conventions and draft structured FeatureSpec with acceptance criteria',
        riskLevel: 'MEDIUM',
        params: {
          featureName: 'Dark Mode Feature',
          userGoal: 'Add dark mode toggle and dark theme styling',
        },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Creates FeatureSpec card for user review and approval',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // F. "Open Claude Code or Antigravity and prepare the feature task"
    else if (lower.includes('antigravity') || lower.includes('claude code')) {
      interpretedIntent = 'Prepare AI Coding Agent Task';
      const targetAgent = lower.includes('antigravity') ? 'Antigravity' : 'Claude Code';
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'coding_agent_dispatch',
        title: `Prepare ${targetAgent} Task`,
        description: `Generate sandboxed task prompt template and configure ${targetAgent} runner`,
        riskLevel: 'MEDIUM',
        params: { agent: targetAgent },
        status: 'PENDING_APPROVAL',
        expectedEffect: `Prepares task prompt for ${targetAgent} with security constraints`,
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // G. "Create a Git branch and implement the feature"
    else if (lower.includes('create a git branch') || lower.includes('create branch')) {
      interpretedIntent = 'Create Git Branch';
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'git_workflow',
        title: 'Create Branch',
        description: 'Create and checkout new feature branch from current HEAD',
        riskLevel: 'MEDIUM',
        params: { operation: 'create_branch', branch: 'feat/dark-mode' },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Creates local branch feat/dark-mode',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // H. "Run tests, summarize changes, and prepare a pull request"
    else if (lower.includes('prepare a pull request') || lower.includes('prepare pr') || lower.includes('create pr')) {
      interpretedIntent = 'Verify Changes & Prepare Pull Request';
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'terminal_runner',
        title: 'Run Tests',
        description: 'Execute npm test to ensure clean test suite before PR',
        riskLevel: 'MEDIUM',
        params: { command: 'npm test', timeoutMs: 60000 },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Validates test pass rate',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'git_workflow',
        title: 'Commit Local Changes',
        description: 'Commit staged changes with message: "feat: add dark mode support"',
        riskLevel: 'HIGH',
        params: { operation: 'commit', message: 'feat: add dark mode support' },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Creates local Git commit',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'git_workflow',
        title: 'Push Branch to Remote',
        description: 'Push branch feat/dark-mode to origin',
        riskLevel: 'HIGH',
        params: { operation: 'push', branch: 'feat/dark-mode' },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Pushes branch to remote repository',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'github_pr',
        title: 'Prepare Pull Request',
        description: 'Draft PR "feat: add dark mode support" into main',
        riskLevel: 'HIGH',
        params: {
          title: 'feat: add dark mode support',
          base: 'main',
          head: 'feat/dark-mode',
          body: 'Summary of changes and automated test verification.'
        },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Prepares GitHub PR for user confirmation',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // I. "Open Binance"
    else if (lower.includes('open binance')) {
      interpretedIntent = 'Open Binance';
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'open_url',
        title: 'Open Binance Website',
        description: 'Open public Binance platform: https://www.binance.com',
        riskLevel: 'LOW',
        params: { url: 'https://www.binance.com' },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Opens default browser to Binance',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // J. "Show BTC price"
    else if (lower.includes('btc price') || lower.includes('show btc') || lower.includes('bitcoin price')) {
      interpretedIntent = 'Fetch Public BTC Market Price';
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'binance_public_ticker',
        title: 'Fetch BTC Price',
        description: 'Fetch current public spot ticker for BTCUSDT',
        riskLevel: 'LOW',
        params: { symbol: 'BTCUSDT' },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Displays live BTC price and INR equivalent without requiring credentials',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    // K. "Prepare a BTC spot buy order for ₹1,000"
    else if (lower.includes('spot buy') || (lower.includes('buy') && lower.includes('btc'))) {
      interpretedIntent = 'Prepare Gated BTC Spot Buy Order';
      const amountMatch = lower.match(/(?:₹|rs\.?|inr)?\s*([0-9,]+)/i);
      const inrAmount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : 1000;

      actions.push({
        id: crypto.randomUUID(),
        skillId: 'binance_spot_order',
        title: `Prepare BTC Spot Buy (₹${inrAmount})`,
        description: `Prepare spot market buy for BTCUSDT worth ₹${inrAmount}. Requires explicit typed confirmation.`,
        riskLevel: 'CRITICAL',
        params: {
          symbol: 'BTCUSDT',
          side: 'BUY',
          orderType: 'MARKET',
          inrAmount: inrAmount,
        },
        status: 'PENDING_APPROVAL',
        expectedEffect: `Prepares spot buy order. Requires typing "Confirm spot buy BTCUSDT for ₹${inrAmount}" and secondary button click.`,
        requiresTypedConfirmation: true,
        confirmationPhrase: `Confirm spot buy BTCUSDT for ₹${inrAmount}`,
        dryRunSupported: true,
      });
    }

    // Fallback for unspecified requests
    else {
      interpretedIntent = 'General Request';
      actions.push({
        id: crypto.randomUUID(),
        skillId: 'general_assistant',
        title: 'Review Request',
        description: `Assistant processed command: "${rawTrimmed}"`,
        riskLevel: 'LOW',
        params: { prompt: rawTrimmed },
        status: 'PENDING_APPROVAL',
        expectedEffect: 'Provides guidance or requests further instruction',
        requiresTypedConfirmation: false,
        dryRunSupported: true,
      });
    }

    const overallRisk = defaultPolicyEngine.calculateOverallRisk(actions);

    // Record turn in TaskContextManager (Phase 3 Stage 1 & 2)
    taskContextManager.recordTurn({
      userPrompt: rawTrimmed,
      interpretedIntent,
      activeApp: contextual.resolvedApp,
      actions: actions.map((a) => a.title),
      success: true,
    });

    return {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      userPrompt: rawTrimmed,
      interpretedIntent,
      overallRisk,
      isDryRun: !!context.isDryRun,
      status: 'AWAITING_APPROVAL',
      actions,
    };
  }
}

export const commandRouter = new CommandRouter();
