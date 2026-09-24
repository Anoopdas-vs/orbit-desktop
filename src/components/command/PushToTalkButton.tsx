import React from 'react';
import { Mic, Square } from 'lucide-react';
import { useCommandStore } from '../../state/useCommandStore';
import { useSafetyStore } from '../../state/useSafetyStore';

export const PushToTalkButton: React.FC = () => {
  const { isRecording, activeVolume, startVoiceRecording, stopVoiceRecording, inputText } = useCommandStore();
  const { killSwitchActive } = useSafetyStore();

  const handleToggle = () => {
    if (killSwitchActive) return;
    if (isRecording) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 select-none">
      {/* Outer Glow & Animated Ripple when Recording */}
      <div className="relative flex items-center justify-center">
        {isRecording && (
          <>
            <div
              className="absolute w-28 h-28 rounded-full bg-rose-500/25 animate-ping pointer-events-none"
              style={{ transform: `scale(${1 + activeVolume / 80})` }}
            />
            <div
              className="absolute w-32 h-32 rounded-full border-2 border-rose-500/50 animate-pulse pointer-events-none"
            />
          </>
        )}

        <button
          type="button"
          disabled={killSwitchActive}
          onClick={handleToggle}
          className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all duration-200 shadow-2xl focus:outline-none focus:ring-4 cursor-pointer ${
            killSwitchActive
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50 ring-0'
              : isRecording
              ? 'bg-rose-600 hover:bg-rose-500 text-white scale-105 shadow-rose-600/60 ring-rose-500/50 ring-4'
              : 'bg-gradient-to-b from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white hover:scale-105 shadow-blue-900/50 ring-blue-500/30'
          }`}
          title={
            killSwitchActive
              ? 'Microphone locked by emergency stop'
              : isRecording
              ? 'Click to stop recording and process command'
              : 'Click to start speaking'
          }
        >
          {isRecording ? (
            <Square className="w-8 h-8 fill-current text-white animate-pulse" />
          ) : (
            <Mic className="w-9 h-9 text-white/90" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-wider mt-1 text-white">
            {isRecording ? 'Click to Stop' : 'Click to Speak'}
          </span>
        </button>
      </div>

      {/* Audio Level VU Bar */}
      <div className="w-44 h-2 bg-slate-900 rounded-full mt-3.5 overflow-hidden border border-slate-700/80 shadow-inner">
        <div
          className={`h-full transition-all duration-75 rounded-full ${
            isRecording
              ? activeVolume > 20
                ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500'
                : 'bg-gradient-to-r from-blue-500 to-emerald-400'
              : 'bg-slate-800'
          }`}
          style={{ width: `${isRecording ? Math.max(15, activeVolume) : 0}%` }}
        />
      </div>

      <div className="text-xs text-slate-300 mt-2 font-medium text-center">
        {isRecording ? (
          <div className="space-y-1">
            <span className="text-rose-400 font-mono font-bold animate-pulse block">
              {activeVolume > 10 ? '🎙️ Mic active (hearing voice)...' : '🔴 Recording... Speak now, then click to finish'}
            </span>
            {inputText && (
              <span className="text-[11px] text-blue-300 font-mono block max-w-sm mx-auto truncate bg-slate-900/80 px-2.5 py-0.5 rounded border border-blue-900/50">
                Hearing: "{inputText}"
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 font-mono text-[11px]">
            Click the microphone to start speaking
          </span>
        )}
      </div>
    </div>
  );
};
