import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, X, Check } from 'lucide-react';
import { ActionItem } from '../../types/action-plan';

interface CriticalConfirmModalProps {
  action: ActionItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (typedPhrase: string) => void;
}

export const CriticalConfirmModal: React.FC<CriticalConfirmModalProps> = ({
  action,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [typedInput, setTypedInput] = useState('');
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState(false);

  if (!isOpen) return null;

  const requiredPhrase = action.confirmationPhrase || 'Confirm critical operation';
  const isMatch = typedInput.trim().toLowerCase() === requiredPhrase.trim().toLowerCase();
  const canConfirm = isMatch && hasAcknowledgedRisk;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-rose-600/80 rounded-xl max-w-lg w-full p-5 shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2 text-rose-400">
            <ShieldAlert className="w-5 h-5 text-rose-500 animate-pulse" />
            <span className="font-bold text-sm tracking-wide uppercase">Critical Action Verification</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-3.5">
          <div className="bg-rose-950/40 border border-rose-900/60 rounded-lg p-3 text-xs text-rose-200">
            <div className="font-semibold text-rose-300 mb-1">{action.title}</div>
            <div>{action.description}</div>
            <div className="mt-2 text-[11px] text-rose-300 font-mono bg-rose-950/80 p-2 rounded border border-rose-800/40">
              Expected Effect: {action.expectedEffect}
            </div>
          </div>

          {/* Action Parameters Table */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs">
            <span className="text-slate-400 font-semibold block mb-1.5 uppercase tracking-wider text-[10px]">
              Exact Execution Parameters:
            </span>
            <div className="space-y-1 font-mono text-[11px] text-slate-300">
              {Object.entries(action.params).map(([key, val]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-slate-400">{key}:</span>
                  <span className="font-semibold text-blue-300">{JSON.stringify(val)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Exact Phrase Typing Requirement */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 font-medium block">
              Type the exact verification phrase below to confirm:
            </label>
            <div className="text-xs font-mono select-all bg-slate-950 border border-slate-700 p-2 rounded text-amber-300 font-semibold">
              {requiredPhrase}
            </div>
            <input
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder="Type confirmation phrase here..."
              className={`w-full bg-slate-950 border px-3 py-2 rounded text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 ${
                isMatch
                  ? 'border-emerald-500 focus:ring-emerald-500/40'
                  : 'border-slate-700 focus:ring-rose-500/40'
              }`}
            />
          </div>

          {/* Risk Acknowledgment Checkbox */}
          <label className="flex items-start space-x-2 cursor-pointer text-xs text-slate-300 select-none">
            <input
              type="checkbox"
              checked={hasAcknowledgedRisk}
              onChange={(e) => setHasAcknowledgedRisk(e.target.checked)}
              className="mt-0.5 rounded bg-slate-950 border-slate-700 text-rose-500 focus:ring-rose-500"
            />
            <span>
              I understand this action is high-risk/critical, irreversible, and executed under my explicit intent.
            </span>
          </label>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 transition"
          >
            Cancel
          </button>
          <button
            disabled={!canConfirm}
            onClick={() => {
              onConfirm(typedInput);
              onClose();
            }}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-lg ${
              canConfirm
                ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Confirm & Execute</span>
          </button>
        </div>
      </div>
    </div>
  );
};
