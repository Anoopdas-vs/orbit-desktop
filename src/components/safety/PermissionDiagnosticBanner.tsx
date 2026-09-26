import React, { useState, useEffect } from 'react';
import { ShieldAlert, ExternalLink, RefreshCw } from 'lucide-react';
import { permissionManager } from '../../core/permission-manager';
import { PermissionStatus } from '../../adapters/native/tauri-bridge';

export const PermissionDiagnosticBanner: React.FC = () => {
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const res = await permissionManager.getStatus();
      setStatus(res);
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    check();
  }, []);

  if (!status || status.accessibilityGranted) {
    return null;
  }

  return (
    <div className="mb-4 bg-amber-950/70 border border-amber-800/80 rounded-xl p-3 text-amber-200 text-xs shadow-lg flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-300 block">
            macOS Accessibility Permission Required
          </span>
          <p className="text-[11px] text-amber-200/90 mt-0.5 leading-relaxed">
            {status.message} {status.actionRequired}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={check}
          disabled={checking}
          className="px-2.5 py-1 rounded-lg bg-amber-900/60 hover:bg-amber-800/80 border border-amber-700/60 text-amber-200 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
          Verify
        </button>
      </div>
    </div>
  );
};
