import React, { useState, useEffect } from 'react';
import {
  Send,
  RotateCcw,
  Eye,
  Shield,
  Sparkles,
  Radio,
  Check,
  X,
  Volume2,
  ExternalLink,
  HelpCircle,
  Play,
  Terminal,
  Zap,
} from 'lucide-react';
import { PushToTalkButton } from './PushToTalkButton';
import { PlanReviewCard } from '../approval/PlanReviewCard';
import { useCommandStore } from '../../state/useCommandStore';
import { useSafetyStore } from '../../state/useSafetyStore';

export const CommandCenterView: React.FC = () => {
  const {
    inputText,
    setInputText,
    submitCommand,
    currentPlan,
    assistantResponse,
    isDryRun,
    toggleDryRun,
    fastMode,
    toggleFastMode,
    clearPlan,
    wakeWordEnabled,
    toggleWakeWord,
    activeProposal,
    confirmProposal,
    cancelProposal,
    initWakeWord,
  } = useCommandStore();

  const { tradingMode, killSwitchActive } = useSafetyStore();
  const [submitting, setSubmitting] = useState(false);
  const [customSongInput, setCustomSongInput] = useState('');
  const [proposalSongInput, setProposalSongInput] = useState('');

  useEffect(() => {
    initWakeWord();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || submitting || killSwitchActive) return;
    setSubmitting(true);
    await submitCommand();
    setSubmitting(false);
  };

  const handleSimulateTest = async (cmd: string) => {
    setInputText(cmd);
    setSubmitting(true);
    await submitCommand(cmd);
    setSubmitting(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Top Banner / Mode Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-xl p-3">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-300">Janki Voice Assistant:</span>
          <button
            onClick={() => toggleWakeWord()}
            className={`text-[10px] px-2.5 py-0.5 rounded-full font-mono border flex items-center gap-1 transition ${
              wakeWordEnabled
                ? 'bg-blue-950 text-blue-300 border-blue-800 hover:bg-blue-900'
                : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-slate-300'
            }`}
          >
            <Radio className={`w-3 h-3 ${wakeWordEnabled ? 'text-blue-400 animate-pulse' : 'text-slate-500'}`} />
            <span>Wake Word: "Hey Janki" {wakeWordEnabled ? 'Listening' : 'Paused'}</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <div className="flex items-center space-x-1.5 text-xs bg-slate-900 border border-slate-700/80 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono text-emerald-300">App Pre-Check: Active</span>
          </div>

          <div className="flex items-center space-x-1.5 text-xs bg-slate-900 border border-slate-700/80 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-[10px] font-mono text-blue-300">Ad-Skipper: Ready</span>
          </div>

          <span className="text-slate-400">Trading:</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
              tradingMode === 'OFF'
                ? 'bg-slate-900 text-slate-400 border-slate-700'
                : tradingMode === 'READ_ONLY'
                ? 'bg-amber-950 text-amber-400 border-amber-800'
                : 'bg-emerald-950 text-emerald-400 border-emerald-800'
            }`}
          >
            {tradingMode === 'OFF'
              ? 'Disabled'
              : tradingMode === 'READ_ONLY'
              ? 'Read-Only'
              : 'Paper Trading'}
          </span>
        </div>
      </div>

      {/* Hero Push-to-Talk Interactive Area */}
      <div className="bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-3 right-4 flex items-center space-x-2">
          <button
            onClick={() => toggleFastMode()}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-mono transition border ${
              fastMode
                ? 'bg-amber-600 text-white border-amber-500 shadow-md font-semibold'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Fast Autonomous Mode: Executes safe actions instantly in milliseconds without waiting for approval clicks"
          >
            <Zap className={`w-3.5 h-3.5 ${fastMode ? 'text-amber-200 fill-current' : 'text-slate-500'}`} />
            <span>Fast Mode: {fastMode ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => toggleDryRun()}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-mono transition border ${
              isDryRun
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Dry Run: {isDryRun ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        <PushToTalkButton />

        {/* 1-Click Test Simulation Controls */}
        <div className="w-full max-w-2xl mt-2 bg-slate-950/80 border border-blue-900/50 rounded-xl p-3">
          <div className="flex items-center justify-between text-[11px] text-blue-300 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              1-Click Voice Test Simulations:
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Click to test instantly without mic</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleSimulateTest('Hey Janki, open youtube and play some music')}
              className="bg-blue-900/40 hover:bg-blue-800/60 text-blue-200 border border-blue-700/60 text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition shadow-sm"
            >
              <Play className="w-3 h-3 text-blue-400 fill-current" />
              <span>1. "Hey Janki, open youtube and play some music"</span>
            </button>

            {activeProposal ? (
              <button
                onClick={() => confirmProposal()}
                className="bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-500 text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition shadow-md animate-pulse"
              >
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>2. Say "Yes" (Open in Chrome Now)</span>
              </button>
            ) : (
              <button
                onClick={() => handleSimulateTest('yes')}
                className="bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition"
              >
                <span>Say "Yes"</span>
              </button>
            )}

            <button
              onClick={() => handleSimulateTest('play Believer')}
              className="bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-200 border border-indigo-700/60 text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition shadow-sm"
            >
              <Play className="w-3 h-3 text-indigo-400 fill-current" />
              <span>"Play Believer"</span>
            </button>

            <button
              onClick={() => handleSimulateTest('play Shape of You')}
              className="bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-200 border border-indigo-700/60 text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition shadow-sm"
            >
              <Play className="w-3 h-3 text-indigo-400 fill-current" />
              <span>"Play Shape of You"</span>
            </button>

            <button
              onClick={() => handleSimulateTest('Open my web app project')}
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition"
            >
              <span>"Open project"</span>
            </button>

            <button
              onClick={() => handleSimulateTest('Ask ChatGPT what is the difference between TCP and UDP')}
              className="bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-200 border border-emerald-700/60 text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition shadow-sm"
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>"Ask ChatGPT..."</span>
            </button>

            <button
              onClick={() => handleSimulateTest('Skip YouTube ad')}
              className="bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 border border-amber-700/60 text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition shadow-sm"
            >
              <span>⏭️ "Skip YouTube ad"</span>
            </button>

            <button
              onClick={() => handleSimulateTest('Click button Submit')}
              className="bg-purple-950/60 hover:bg-purple-900/80 text-purple-200 border border-purple-700/60 text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition shadow-sm"
            >
              <span>🖱️ "Click button Submit"</span>
            </button>

            <button
              onClick={() => handleSimulateTest('Janki, run tests')}
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] px-2.5 py-1.5 rounded-lg font-medium transition"
            >
              <span>"Run tests"</span>
            </button>

            {/* Custom Song Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customSongInput.trim()) {
                  handleSimulateTest(`play ${customSongInput.trim()}`);
                  setCustomSongInput('');
                }
              }}
              className="flex items-center space-x-1 ml-auto"
            >
              <input
                type="text"
                value={customSongInput}
                onChange={(e) => setCustomSongInput(e.target.value)}
                placeholder="Type any song name..."
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
              />
              <button
                type="submit"
                disabled={!customSongInput.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[11px] px-2.5 py-1 rounded-lg font-medium transition"
              >
                Play
              </button>
            </form>
          </div>
        </div>

        {/* Text Command Input Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl mt-3 space-y-2">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputText}
              disabled={killSwitchActive}
              onChange={(e) => setInputText(e.target.value)}
              placeholder='Say "Hey Janki..." or type a command (e.g. "open youtube and play some music")...'
              className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-4 pr-24 py-3 text-xs text-slate-100 placeholder-slate-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono disabled:opacity-50"
            />
            <div className="absolute right-2 flex items-center space-x-1">
              {inputText && (
                <button
                  type="button"
                  onClick={() => setInputText('')}
                  className="p-1.5 text-slate-500 hover:text-slate-300 rounded"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                disabled={!inputText.trim() || submitting || killSwitchActive}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center space-x-1 transition shadow"
              >
                <span>Run</span>
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Active Multi-Turn Conversational Proposal Dialogue (YouTube app vs Chrome fallback) */}
      {activeProposal && (
        <div className="bg-blue-950/50 border-2 border-blue-500/80 rounded-2xl p-5 shadow-2xl backdrop-blur-md space-y-3 animate-in zoom-in-95">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-blue-300 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-blue-400 animate-spin" />
              <span>Janki Waiting For Your Confirmation</span>
            </div>
            <span className="text-[11px] text-blue-300/80 font-mono">You can speak "Yes" or click below</span>
          </div>

          <p className="text-xs text-slate-100 font-medium leading-relaxed bg-slate-950/80 p-3.5 rounded-xl border border-blue-900/50">
            {activeProposal.question}
          </p>

          {/* Option to choose or change song requirement */}
          <div className="bg-slate-950/70 border border-blue-900/40 rounded-xl p-3 space-y-2">
            <span className="text-[11px] text-slate-300 font-semibold block">
              Want a specific song or artist? Pick below or type your choice:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {['Believer', 'Shape of You', 'Bohemian Rhapsody', 'Lofi Chill', 'Lajjavathiye'].map((song) => (
                <button
                  key={song}
                  type="button"
                  onClick={() => handleSimulateTest(`play ${song}`)}
                  className="text-[10px] bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-800/80 px-2.5 py-0.5 rounded-full transition"
                >
                  {song}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (proposalSongInput.trim()) {
                  handleSimulateTest(`play ${proposalSongInput.trim()}`);
                  setProposalSongInput('');
                }
              }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                type="text"
                value={proposalSongInput}
                onChange={(e) => setProposalSongInput(e.target.value)}
                placeholder="Type any song name (e.g. Hotel California, Arijit Singh)..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!proposalSongInput.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition"
              >
                Set Song
              </button>
            </form>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-slate-400">
              {activeProposal.targetUrl && (
                <a
                  href={activeProposal.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono underline"
                >
                  <span>Direct link: Open YouTube Music in new tab</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => cancelProposal()}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 transition"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
                <span>Cancel</span>
              </button>
              <button
                onClick={() => confirmProposal()}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg transition"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Yes, Open in Google Chrome</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assistant Feedback Notice */}
      {assistantResponse && !activeProposal && (
        <div className="bg-slate-900/80 border border-blue-900/40 rounded-xl p-3.5 flex items-start justify-between text-xs text-blue-200">
          <div className="flex items-start space-x-2">
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>{assistantResponse}</span>
          </div>
          <button
            onClick={() => clearPlan()}
            className="text-slate-400 hover:text-slate-200 text-xs ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Action Plan & Approval Review */}
      {currentPlan && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-300 tracking-wider uppercase flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              Structured Action Plan & Approval Gate
            </h2>
            <button
              onClick={() => clearPlan()}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Clear Plan
            </button>
          </div>
          <PlanReviewCard plan={currentPlan} />
        </div>
      )}
    </div>
  );
};
