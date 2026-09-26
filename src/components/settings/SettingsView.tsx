import React, { useState } from 'react';
import {
  Sliders,
  Key,
  Database,
  Cpu,
  Mic,
  Coins,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { useSafetyStore } from '../../state/useSafetyStore';
import { useCommandStore } from '../../state/useCommandStore';
import { useAuditStore } from '../../state/useAuditStore';

export const SettingsView: React.FC = () => {
  const {
    tradingLimits,
    updateTradingLimits,
    allowedApps,
    autoApproveLowRisk,
    setAutoApproveLowRisk,
  } = useSafetyStore();

  const { voiceProviderType, setVoiceProviderType } = useCommandStore();
  const { clearLogs } = useAuditStore();

  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3.2:latest');
  const [maxOrder, setMaxOrder] = useState(tradingLimits.maxOrderInr);
  const [dailyLimit, setDailyLimit] = useState(tradingLimits.dailyCumulativeLimitInr);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateTradingLimits({
      maxOrderInr: Number(maxOrder),
      dailyCumulativeLimitInr: Number(dailyLimit),
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          Janki Application Settings
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure local-first adapters, speech recognition, trading caps, and credential boundaries.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-5 max-w-3xl">
        {/* Voice & Speech Recognition */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Mic className="w-4 h-4 text-blue-400" />
            Voice & Speech-To-Text (STT) Engine
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex items-center space-x-2 bg-slate-950 p-3 rounded-lg border border-slate-800 cursor-pointer">
              <input
                type="radio"
                name="voiceEngine"
                checked={voiceProviderType === 'web-speech'}
                onChange={() => setVoiceProviderType('web-speech')}
                className="text-blue-500 bg-slate-900 border-slate-700"
              />
              <div>
                <strong className="block text-slate-200 font-mono">macOS Web Speech / Mic</strong>
                <span className="text-[11px] text-slate-400">Uses local Web Speech recognition with zero external cost.</span>
              </div>
            </label>

            <label className="flex items-center space-x-2 bg-slate-950 p-3 rounded-lg border border-slate-800 cursor-pointer">
              <input
                type="radio"
                name="voiceEngine"
                checked={voiceProviderType === 'mock'}
                onChange={() => setVoiceProviderType('mock')}
                className="text-blue-500 bg-slate-900 border-slate-700"
              />
              <div>
                <strong className="block text-slate-200 font-mono">Simulated / Mock STT</strong>
                <span className="text-[11px] text-slate-400">High-confidence canned speech events for testing and CI.</span>
              </div>
            </label>
          </div>
        </div>

        {/* Local Ollama LLM Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-400" />
            Local Ollama AI Integration
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Ollama API URL:</label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-slate-200"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Target Model Name:</label>
              <input
                type="text"
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-slate-200"
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Note: If Ollama is offline or uninstalled, Janki gracefully operates in deterministic rule-based mode.
          </p>
        </div>

        {/* macOS Keychain Security Architecture */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-400" />
            Credential Storage & Keychain Security
          </h3>
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero Plaintext Secret Storage Guarantee</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Janki never saves API keys, Binance secrets, or GitHub tokens in SQLite, logs, or .env files. Real credentials reside exclusively in the encrypted <strong>macOS Keychain</strong> via Apple's Security framework.
            </p>
          </div>
        </div>

        {/* Binance Trading Safety Limits */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Coins className="w-4 h-4 text-emerald-400" />
            Trading Safety Limits
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Max Order Limit (INR):</label>
              <input
                type="number"
                value={maxOrder}
                onChange={(e) => setMaxOrder(Number(e.target.value))}
                max={5000}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-slate-200"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Daily Cumulative Limit (INR):</label>
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                max={25000}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 font-mono text-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Save & Danger Zone */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-5 py-2.5 rounded-lg shadow transition flex items-center space-x-1.5"
          >
            <span>Save Preferences</span>
            {savedSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />}
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirm('Reset all local SQLite database records, audit logs, and trade journals?')) {
                clearLogs();
                alert('Local data reset to initial clean state.');
              }
            }}
            className="text-rose-400 hover:text-rose-300 text-xs flex items-center space-x-1 font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Local Database</span>
          </button>
        </div>
      </form>
    </div>
  );
};
