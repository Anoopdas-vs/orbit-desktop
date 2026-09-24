import React from 'react';
import { Shield, AlertOctagon, Volume2, VolumeX, Radio } from 'lucide-react';
import { useSafetyStore } from '../../state/useSafetyStore';
import { useCommandStore } from '../../state/useCommandStore';

interface DesktopFrameProps {
  children: React.ReactNode;
}

export const DesktopFrame: React.FC<DesktopFrameProps> = ({ children }) => {
  const { killSwitchActive, killSwitchReason, engageKillSwitch, disengageKillSwitch, tradingMode } = useSafetyStore();
  const { isRecording, wakeWordEnabled, toggleWakeWord, ttsEnabled, toggleTts } = useCommandStore();

  return (
    <div className="flex flex-col h-screen w-screen bg-orbit-bg text-slate-100 select-none overflow-hidden font-sans">
      {/* macOS Native-Style Custom Titlebar */}
      <header className="h-10 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between px-3 z-30 backdrop-blur-md">
        {/* macOS Traffic Lights & Janki Brand */}
        <div className="flex items-center space-x-2 w-52">
          <div className="w-3 h-3 rounded-full bg-rose-500/90 border border-rose-600 shadow-sm cursor-pointer hover:opacity-80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/90 border border-amber-600 shadow-sm cursor-pointer hover:opacity-80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/90 border border-emerald-600 shadow-sm cursor-pointer hover:opacity-80" />
          <span className="ml-3 text-xs font-bold text-slate-200 tracking-wider flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            JANKI
          </span>
        </div>

        {/* Center: Wake Word Status & Recording Pulse */}
        <div className="flex items-center space-x-3 text-xs font-medium text-slate-400">
          {isRecording ? (
            <span className="flex items-center text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2.5 py-0.5 rounded-full animate-pulse gap-1.5 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              RECORDING AUDIO
            </span>
          ) : (
            <button
              onClick={() => toggleWakeWord()}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-mono transition ${
                wakeWordEnabled
                  ? 'bg-blue-950/70 border-blue-800/80 text-blue-300 hover:bg-blue-900/60'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title="Click to toggle continuous background wake word detection"
            >
              <Radio className={`w-3 h-3 ${wakeWordEnabled ? 'text-blue-400 animate-pulse' : 'text-slate-500'}`} />
              <span>Wake Word: "Hey Janki" {wakeWordEnabled ? 'Active' : 'Off'}</span>
            </button>
          )}
        </div>

        {/* Controls: Voice Synthesis, Trading Status & Kill Switch */}
        <div className="flex items-center space-x-2.5">
          {/* TTS Audio Voice Output Toggle */}
          <button
            onClick={() => toggleTts()}
            className={`p-1 rounded border transition text-xs ${
              ttsEnabled
                ? 'bg-slate-900 border-slate-700 text-blue-400 hover:text-blue-300'
                : 'bg-slate-950 border-slate-800 text-slate-600 hover:text-slate-400'
            }`}
            title={ttsEnabled ? 'Voice Output ON (Click to mute)' : 'Voice Output Muted (Click to unmute)'}
          >
            {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
            Trade: <strong className={tradingMode === 'OFF' ? 'text-slate-500' : 'text-emerald-400'}>{tradingMode}</strong>
          </span>

          {killSwitchActive ? (
            <button
              onClick={() => disengageKillSwitch()}
              className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs px-2.5 py-1 rounded shadow-md font-medium transition animate-pulse"
              title={killSwitchReason}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>LOCKED (RESET)</span>
            </button>
          ) : (
            <button
              onClick={() => engageKillSwitch('User initiated emergency stop via titlebar button', 'user-ui')}
              className="flex items-center space-x-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 hover:border-rose-600 text-xs px-2.5 py-1 rounded transition font-medium"
              title="Immediately halts all active processes and freezes executions"
            >
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
              <span>KILL SWITCH</span>
            </button>
          )}
        </div>
      </header>

      {/* Main View Area */}
      <div className="flex-1 flex overflow-hidden">
        {children}
      </div>
    </div>
  );
};
