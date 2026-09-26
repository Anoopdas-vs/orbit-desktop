import React from 'react';
import { FileCode, X, Check, AlertTriangle, ArrowRight } from 'lucide-react';

export interface DiffReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  filePath: string;
  oldContent?: string;
  newContent: string;
  actionType?: string;
}

export const DiffReviewModal: React.FC<DiffReviewModalProps> = ({
  isOpen,
  onClose,
  onApprove,
  onReject,
  filePath,
  oldContent = '',
  newContent,
  actionType = 'Modify File',
}) => {
  if (!isOpen) return null;

  const oldLines = oldContent ? oldContent.split('\n') : [];
  const newLines = newContent ? newContent.split('\n') : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full flex flex-col max-h-[85vh] shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <FileCode className="w-5 h-5 text-indigo-400" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs uppercase font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  {actionType}
                </span>
                <span className="font-mono text-xs text-slate-300 font-semibold truncate max-w-md">
                  {filePath}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diff Body */}
        <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-slate-950 space-y-1">
          {oldLines.length > 0 && (
            <div className="mb-3">
              <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block mb-1">
                Previous Content ({oldLines.length} lines):
              </span>
              <div className="bg-rose-950/20 border border-rose-900/40 rounded p-2.5 text-rose-300 max-h-48 overflow-auto whitespace-pre-wrap">
                {oldLines.map((line, idx) => (
                  <div key={`old-${idx}`} className="flex">
                    <span className="w-8 text-rose-500/70 select-none shrink-0">{idx + 1}</span>
                    <span className="text-rose-200">- {line}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">
              {oldLines.length > 0 ? 'Proposed New Content' : 'New File Content'} ({newLines.length} lines):
            </span>
            <div className="bg-emerald-950/20 border border-emerald-900/40 rounded p-2.5 text-emerald-300 max-h-64 overflow-auto whitespace-pre-wrap">
              {newLines.map((line, idx) => (
                <div key={`new-${idx}`} className="flex">
                  <span className="w-8 text-emerald-500/70 select-none shrink-0">{idx + 1}</span>
                  <span className="text-emerald-200">+ {line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Warning footer */}
        <div className="px-5 py-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Review changes carefully before applying them to disk.</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onReject}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
            >
              Reject Changes
            </button>
            <button
              onClick={onApprove}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Apply Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
