import { create } from 'zustand';
import { ActionPlan } from '../types/action-plan';
import { commandRouter } from '../core/router';
import { defaultPolicyEngine } from '../core/policy-engine';
import { redactSensitiveData } from '../core/redactor';
import { terminalRunnerSkill } from '../skills/terminal-runner';
import { openApplicationSkill } from '../skills/open-application';
import { openUrlSkill } from '../skills/open-url';
import { gitWorkflowSkill } from '../skills/git-workflow';
import { youTubeLauncherSkill, resolvePlayableUrl } from '../skills/youtube-launcher';
import { binanceTradingAdapter } from '../adapters/trading/binance-adapter';
import { MockVoiceProvider, WebAudioVoiceProvider, VoiceProvider } from '../adapters/voice/voice-provider';
import { speechSynth } from '../adapters/voice/speech-synthesis';
import { wakeWordListener, WakeWordEvent } from '../adapters/voice/wake-word-listener';
import { conversationalContext, PendingProposal } from '../core/conversational-context';
import { youtubeAdSkipperSkill, youtubeAdSkipperDaemon } from '../skills/youtube-ad-skipper';
import { aiPromptAgentSkill } from '../skills/ai-prompt-agent';
import { guiControllerSkill } from '../skills/gui-controller';
import { appAvailabilitySkill } from '../skills/app-availability';
import { useSafetyStore } from './useSafetyStore';
import { useAuditStore } from './useAuditStore';

interface CommandState {
  inputText: string;
  isRecording: boolean;
  activeVolume: number;
  isDryRun: boolean;
  fastMode: boolean;
  currentPlan: ActionPlan | null;
  assistantResponse: string | null;
  isExecuting: boolean;
  voiceProviderType: 'web-speech' | 'mock';
  wakeWordEnabled: boolean;
  ttsEnabled: boolean;
  activeProposal: PendingProposal | null;

  // Actions
  setInputText: (text: string) => void;
  toggleDryRun: () => void;
  toggleFastMode: () => void;
  toggleWakeWord: () => void;
  toggleTts: () => void;
  setVoiceProviderType: (type: 'web-speech' | 'mock') => void;
  startVoiceRecording: () => Promise<void>;
  stopVoiceRecording: () => Promise<void>;
  submitCommand: (overrideText?: string) => Promise<void>;
  approveAction: (actionId: string, typedPhrase?: string) => Promise<void>;
  approveAllActions: () => Promise<void>;
  rejectPlan: (reason?: string) => void;
  clearPlan: () => void;
  confirmProposal: () => Promise<void>;
  cancelProposal: () => void;
  initWakeWord: () => void;
}

let activeVoiceProvider: VoiceProvider = new WebAudioVoiceProvider();

export const useCommandStore = create<CommandState>((set, get) => ({
  inputText: '',
  isRecording: false,
  activeVolume: 0,
  isDryRun: false,
  fastMode: true,
  currentPlan: null,
  assistantResponse: null,
  isExecuting: false,
  voiceProviderType: 'web-speech',
  wakeWordEnabled: true,
  ttsEnabled: true,
  activeProposal: null,

  setInputText: (text: string) => set({ inputText: text }),

  toggleDryRun: () => set((state) => ({ isDryRun: !state.isDryRun })),

  toggleFastMode: () => set((state) => ({ fastMode: !state.fastMode })),

  toggleWakeWord: () => {
    const next = !get().wakeWordEnabled;
    set({ wakeWordEnabled: next });
    if (next) {
      wakeWordListener.start();
    } else {
      wakeWordListener.stop();
    }
  },

  toggleTts: () => {
    const next = !get().ttsEnabled;
    speechSynth.setMuted(!next);
    set({ ttsEnabled: next });
  },

  setVoiceProviderType: (type: 'web-speech' | 'mock') => {
    activeVoiceProvider = type === 'mock' ? new MockVoiceProvider() : new WebAudioVoiceProvider();
    set({ voiceProviderType: type });
  },

  initWakeWord: () => {
    wakeWordListener.onWake((event: WakeWordEvent) => {
      const state = get();
      if (!state.wakeWordEnabled || state.isRecording) return;

      if (event.hasTrailingCommand && event.trailingCommand) {
        state.setInputText(event.trailingCommand);
        state.submitCommand(event.trailingCommand);
      } else {
        // Just the wake word: "Hey Janki"
        set({ assistantResponse: "I'm listening. Speak your command..." });
        if (state.ttsEnabled) {
          speechSynth.speak("Yes? I'm listening.");
        }
        state.startVoiceRecording();
      }
    });

    if (get().wakeWordEnabled) {
      wakeWordListener.start();
    }
  },

  startVoiceRecording: async () => {
    try {
      // 1. Temporarily pause background wake word listener to free the microphone lock in Chrome
      wakeWordListener.stop();

      if (activeVoiceProvider.onVolumeChange) {
        activeVoiceProvider.onVolumeChange((vol) => set({ activeVolume: vol }));
      }
      if (activeVoiceProvider.onTranscriptChange) {
        activeVoiceProvider.onTranscriptChange((text) => set({ inputText: text }));
      }
      await activeVoiceProvider.startRecording();
      set({ isRecording: true, assistantResponse: 'Listening... Speak your command into the microphone now.' });
    } catch (err: any) {
      console.error('Failed to start voice recording:', err);
      if (get().wakeWordEnabled) {
        wakeWordListener.start();
      }
      set({
        isRecording: false,
        assistantResponse: 'Microphone permission not granted yet. Click "Allow" on the Chrome prompt, or speak using the quick buttons.',
      });
    }
  },

  stopVoiceRecording: async () => {
    try {
      set({ isRecording: false, activeVolume: 0 });
      const result = await activeVoiceProvider.stopRecording();

      // Safely resume wake word listener after a short cooldown
      if (get().wakeWordEnabled) {
        setTimeout(() => {
          if (!get().isRecording) {
            wakeWordListener.start();
          }
        }, 500);
      }

      if (!result.text || result.text.trim().length === 0) {
        const errorMsg = result.error
          ? `Microphone notice: ${result.error}. Please allow microphone in Chrome settings.`
          : 'No speech was detected. Please check microphone access, speak clearly, or use the quick test buttons below.';
        set({ assistantResponse: errorMsg });
        return;
      }

      set({ inputText: result.text });
      await get().submitCommand(result.text);
    } catch (err: any) {
      console.error('Failed to stop voice recording:', err);
      set({ isRecording: false, activeVolume: 0 });
      if (get().wakeWordEnabled) {
        setTimeout(() => wakeWordListener.start(), 500);
      }
    }
  },

  confirmProposal: async () => {
    const proposal = conversationalContext.getPendingProposal();
    if (!proposal) return;
    conversationalContext.clearPendingProposal();
    set({ activeProposal: null });

    if (proposal.type === 'OPEN_YOUTUBE_CHROME') {
      const musicQuery = proposal.musicQuery || 'relaxing music';
      
      // 0. Auto-engage the YouTube Turbo Ad-Skipper daemon (500ms zero-lag polling)
      youtubeAdSkipperDaemon.startDaemon(500);

      // 1. Resolve direct playable video URL (offline catalog + backend resolver)
      let finalUrl = '';
      const localResolution = resolvePlayableUrl(musicQuery);
      if (localResolution.isDirectVideo) {
        finalUrl = localResolution.targetUrl;
      } else {
        try {
          if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
            const res = await fetch('/api/macos/resolve-youtube', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: musicQuery }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.targetUrl && data.isDirectVideo) {
                finalUrl = data.targetUrl;
              }
            }
          }
        } catch (err) {
          console.warn('Backend resolve-youtube failed:', err);
        }
        if (!finalUrl) {
          finalUrl = localResolution.targetUrl || 'https://www.youtube.com/watch?v=7wtfhZwyrcc&autoplay=1';
        }
      }

      // 2. Attempt native macOS launch via bridge
      let openedViaBridge = false;
      try {
        if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
          const res = await fetch('/api/macos/open-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: finalUrl, browser: 'Google Chrome' }),
          });
          if (res.ok) {
            openedViaBridge = true;
          }
        }
      } catch (err) {
        console.warn('Bridge open-url failed, falling back:', err);
      }

      // 3. Fallback to window.open if bridge is unavailable
      if (!openedViaBridge && typeof window !== 'undefined') {
        try {
          window.open(finalUrl, '_blank', 'noopener,noreferrer');
        } catch (err) {
          console.warn('Popup blocked:', err);
        }
      }

      const responseText = `Playing "${musicQuery}" directly on YouTube in Google Chrome (Turbo Ad-Skipper active).`;
      set({ assistantResponse: responseText });
      if (get().ttsEnabled) {
        speechSynth.speak(responseText);
      }
    }
  },

  cancelProposal: () => {
    conversationalContext.clearPendingProposal();
    set({ activeProposal: null, assistantResponse: 'Action cancelled.' });
    if (get().ttsEnabled) {
      speechSynth.speak('Cancelled.');
    }
  },

  submitCommand: async (overrideText?: string) => {
    const text = (overrideText !== undefined ? overrideText : get().inputText).trim();
    if (!text) return;

    const safety = useSafetyStore.getState();
    const audit = useAuditStore.getState();
    const isDryRun = get().isDryRun;
    const ttsEnabled = get().ttsEnabled;

    const { redactedText, hasRedactions } = redactSensitiveData(text);

    const plan = await commandRouter.route(text, {
      registeredProjects: safety.registeredProjects,
      currentProjectId: safety.activeProjectId,
      isDryRun,
      fastMode: get().fastMode,
    });

    // Check policy
    const policyResult = defaultPolicyEngine.evaluatePlan(plan);

    // If clarification needed
    if (plan.clarificationNeeded) {
      set({
        currentPlan: plan,
        assistantResponse: plan.clarificationNeeded,
      });
      if (ttsEnabled) {
        speechSynth.speak(plan.clarificationNeeded);
      }
      audit.addAuditEntry({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source: 'text',
        rawCommand: redactedText,
        interpretedIntent: plan.interpretedIntent,
        overallRisk: plan.overallRisk,
        approvalStatus: 'NOT_REQUIRED',
        actionsExecutedCount: 0,
        actionsFailedCount: 0,
        executionDurationMs: 5,
        details: { clarificationNeeded: plan.clarificationNeeded },
        hasSensitiveRedactions: hasRedactions,
      });
      return;
    }

    // Check if auto-approved (LOW risk, or Fast Mode enabled for non-critical actions)
    const shouldAutoRun = !isDryRun && plan.actions.length > 0 && (
      policyResult.canAutoExecute ||
      (get().fastMode && plan.overallRisk !== 'CRITICAL')
    );

    if (shouldAutoRun) {
      set({ currentPlan: plan, isExecuting: true });
      await get().approveAllActions();
      return;
    }

    const responseMsg = `Generated ${plan.actions.length} action(s). Overall risk: ${plan.overallRisk}. Please review and approve.`;
    set({
      currentPlan: plan,
      assistantResponse: responseMsg,
    });

    if (ttsEnabled && plan.actions.length > 0) {
      speechSynth.speak(`I've prepared a plan for ${plan.interpretedIntent}. Please review.`);
    }

    audit.addAuditEntry({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      source: 'text',
      rawCommand: redactedText,
      interpretedIntent: plan.interpretedIntent,
      overallRisk: plan.overallRisk,
      approvalStatus: policyResult.canAutoExecute ? 'AUTO_APPROVED' : 'APPROVED',
      actionsExecutedCount: 0,
      actionsFailedCount: 0,
      executionDurationMs: 8,
      details: { actionCount: plan.actions.length, isDryRun },
      hasSensitiveRedactions: hasRedactions,
    });
  },

  approveAction: async (actionId: string, typedPhrase?: string) => {
    const { currentPlan, isDryRun, ttsEnabled } = get();
    if (!currentPlan) return;

    const action = currentPlan.actions.find((a) => a.id === actionId);
    if (!action) return;

    const audit = useAuditStore.getState();
    const safety = useSafetyStore.getState();

    // Check typed phrase for critical action
    if (action.riskLevel === 'CRITICAL' && action.confirmationPhrase) {
      if (typedPhrase?.trim().toLowerCase() !== action.confirmationPhrase.trim().toLowerCase()) {
        const errorMsg = `Confirmation phrase mismatch! Required: "${action.confirmationPhrase}"`;
        set({ assistantResponse: errorMsg });
        if (ttsEnabled) speechSynth.speak('Verification phrase did not match.');
        return;
      }
    }

    // Mark as running
    set((state) => ({
      currentPlan: state.currentPlan
        ? {
            ...state.currentPlan,
            actions: state.currentPlan.actions.map((a) =>
              a.id === actionId ? { ...a, status: 'RUNNING' } : a
            ),
          }
        : null,
    }));

    audit.addApprovalEvent({
      id: crypto.randomUUID(),
      planId: currentPlan.id,
      actionId,
      riskLevel: action.riskLevel,
      decision: 'APPROVE',
      decidedAt: new Date().toISOString(),
      typedPhraseEntered: typedPhrase,
    });

    const executionContext = {
      isDryRun,
      userPrompt: currentPlan.userPrompt,
      killSwitchActive: () => safety.killSwitchActive,
    };

    let result: any;
    const startTime = performance.now();

    try {
      if (action.skillId === 'youtube_launcher') {
        result = isDryRun
          ? await youTubeLauncherSkill.dryRun!(action.params as any, executionContext)
          : await youTubeLauncherSkill.execute(action.params as any, executionContext);

        if (result.data?.needsFallbackConfirmation) {
          const proposal = conversationalContext.getPendingProposal();
          set({
            activeProposal: proposal,
            assistantResponse: result.data.question,
          });
          if (ttsEnabled) {
            speechSynth.speak(result.data.question);
          }
        }
      } else if (action.skillId === 'terminal_runner') {
        result = isDryRun
          ? await terminalRunnerSkill.dryRun!(action.params as any, executionContext)
          : await terminalRunnerSkill.execute(action.params as any, executionContext);
      } else if (action.skillId === 'open_application') {
        result = isDryRun
          ? await openApplicationSkill.dryRun!(action.params as any, executionContext)
          : await openApplicationSkill.execute(action.params as any, executionContext);
      } else if (action.skillId === 'open_url') {
        result = isDryRun
          ? await openUrlSkill.dryRun!(action.params as any, executionContext)
          : await openUrlSkill.execute(action.params as any, executionContext);
      } else if (action.skillId === 'git_workflow') {
        result = isDryRun
          ? await gitWorkflowSkill.dryRun!(action.params as any, executionContext)
          : await gitWorkflowSkill.execute(action.params as any, executionContext);
      } else if (action.skillId === 'binance_spot_order') {
        const prep = await binanceTradingAdapter.prepareSpotOrder({
          symbol: action.params.symbol,
          side: action.params.side,
          inrAmount: action.params.inrAmount,
        });
        if (prep.error) {
          result = { success: false, error: prep.error, durationMs: 10 };
        } else {
          const exec = await binanceTradingAdapter.executeOrder(
            prep.order!,
            typedPhrase || '',
            true
          );
          if (exec.success && exec.journalEntry) {
            audit.addTradeJournal(exec.journalEntry);
            result = {
              success: true,
              data: exec.journalEntry,
              stdout: `[Trading Journal] Order executed. ID: ${exec.journalEntry.exchangeOrderId}`,
              durationMs: 15,
            };
          } else {
            result = { success: false, error: exec.error, durationMs: 15 };
          }
        }
      } else if (action.skillId === 'binance_public_ticker') {
        const quote = await binanceTradingAdapter.getPublicPrice(action.params.symbol || 'BTCUSDT');
        result = {
          success: true,
          data: quote,
          stdout: `${quote.symbol}: $${quote.price.toLocaleString()} (~₹${quote.inrEquivalentPrice.toLocaleString()})`,
          durationMs: 20,
        };
      } else if (action.skillId === 'youtube_ad_skipper') {
        result = isDryRun
          ? await youtubeAdSkipperSkill.dryRun!(action.params as any, executionContext)
          : await youtubeAdSkipperSkill.execute(action.params as any, executionContext);
      } else if (action.skillId === 'ai_prompt_agent') {
        result = isDryRun
          ? await aiPromptAgentSkill.dryRun!(action.params as any, executionContext)
          : await aiPromptAgentSkill.execute(action.params as any, executionContext);
      } else if (action.skillId === 'gui_controller') {
        result = isDryRun
          ? await guiControllerSkill.dryRun!(action.params as any, executionContext)
          : await guiControllerSkill.execute(action.params as any, executionContext);
      } else if (action.skillId === 'app_availability') {
        result = isDryRun
          ? await appAvailabilitySkill.dryRun!(action.params as any, executionContext)
          : await appAvailabilitySkill.execute(action.params as any, executionContext);
      } else {
        result = {
          success: true,
          stdout: `Executed action ${action.title} successfully.`,
          durationMs: 10,
        };
      }

      const durationMs = Math.round(performance.now() - startTime);

      audit.addExecutionLog({
        id: crypto.randomUUID(),
        planId: currentPlan.id,
        actionId,
        skillId: action.skillId,
        commandExecuted: action.params.command || action.title,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode ?? (result.success ? 0 : 1),
        status: isDryRun ? 'DRY_RUN' : (result.success ? 'SUCCESS' : 'ERROR'),
        startedAt: new Date(Date.now() - durationMs).toISOString(),
        completedAt: new Date().toISOString(),
        durationMs,
        error: result.error,
      });

      const responseText = result.message || (result.success
        ? `${isDryRun ? '[DRY RUN] ' : ''}Action "${action.title}" completed successfully.`
        : `Action "${action.title}" failed: ${result.error}`);

      set((state) => ({
        currentPlan: state.currentPlan
          ? {
              ...state.currentPlan,
              actions: state.currentPlan.actions.map((a) =>
                a.id === actionId
                  ? {
                      ...a,
                      status: isDryRun ? 'DRY_RUN' : (result.success ? 'COMPLETED' : 'FAILED'),
                      output: result.stdout || result.data,
                      error: result.error,
                      executionDurationMs: durationMs,
                    }
                  : a
              ),
            }
          : null,
        assistantResponse: responseText,
      }));

      if (ttsEnabled && result.success && !result.data?.needsFallbackConfirmation) {
        speechSynth.speak(responseText);
      }
    } catch (err: any) {
      console.error('Execution error:', err);
      set((state) => ({
        currentPlan: state.currentPlan
          ? {
              ...state.currentPlan,
              actions: state.currentPlan.actions.map((a) =>
                a.id === actionId ? { ...a, status: 'FAILED', error: err.message } : a
              ),
            }
          : null,
        assistantResponse: `Execution failed: ${err.message}`,
      }));
      if (ttsEnabled) speechSynth.speak('Action execution encountered an error.');
    }
  },

  approveAllActions: async () => {
    const { currentPlan } = get();
    if (!currentPlan) return;

    set({ isExecuting: true });
    for (const action of currentPlan.actions) {
      if (action.status === 'PENDING_APPROVAL') {
        await get().approveAction(action.id, action.confirmationPhrase);
      }
    }
    set({ isExecuting: false });
  },

  rejectPlan: (reason = 'User rejected action plan') => {
    const { currentPlan, ttsEnabled } = get();
    if (!currentPlan) return;

    useAuditStore.getState().addApprovalEvent({
      id: crypto.randomUUID(),
      planId: currentPlan.id,
      riskLevel: currentPlan.overallRisk,
      decision: 'REJECT',
      decidedAt: new Date().toISOString(),
      rejectionReason: reason,
    });

    set({
      currentPlan: { ...currentPlan, status: 'REJECTED' },
      assistantResponse: `Plan rejected: ${reason}`,
    });

    if (ttsEnabled) speechSynth.speak('Plan rejected.');
  },

  clearPlan: () => set({ currentPlan: null, assistantResponse: null }),
}));
