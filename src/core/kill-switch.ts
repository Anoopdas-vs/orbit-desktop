/**
 * Emergency Kill Switch Module
 * Global interrupt that immediately stops subprocesses, disables trading,
 * and freezes execution into a safe read-only lock state.
 */

type KillSwitchListener = (active: boolean, reason: string) => void;

interface ActiveProcess {
  id: string;
  name: string;
  abortController: AbortController;
  startedAt: string;
}

class KillSwitchController {
  private active = false;
  private reason = '';
  private triggeredBy = '';
  private activeProcesses = new Map<string, ActiveProcess>();
  private listeners = new Set<KillSwitchListener>();

  public isEngaged(): boolean {
    return this.active;
  }

  public getReason(): string {
    return this.reason;
  }

  public getTriggeredBy(): string {
    return this.triggeredBy;
  }

  public engage(reason: string, triggeredBy: 'user-ui' | 'voice-emergency-stop' | 'policy-violation' = 'user-ui'): number {
    this.active = true;
    this.reason = reason;
    this.triggeredBy = triggeredBy;

    // Abort all active running processes
    let killedCount = 0;
    for (const [id, proc] of this.activeProcesses.entries()) {
      try {
        proc.abortController.abort(new Error(`Killed by Emergency Stop: ${reason}`));
        killedCount++;
      } catch (err) {
        console.error(`Error aborting process ${id}:`, err);
      }
    }
    this.activeProcesses.clear();

    this.notifyListeners();
    return killedCount;
  }

  public disengage(): void {
    this.active = false;
    this.reason = '';
    this.triggeredBy = '';
    this.notifyListeners();
  }

  public registerProcess(id: string, name: string, abortController: AbortController): void {
    if (this.active) {
      abortController.abort(new Error('Kill switch is active. Execution denied.'));
      return;
    }
    this.activeProcesses.set(id, {
      id,
      name,
      abortController,
      startedAt: new Date().toISOString(),
    });
  }

  public unregisterProcess(id: string): void {
    this.activeProcesses.delete(id);
  }

  public getRunningProcessCount(): number {
    return this.activeProcesses.size;
  }

  public subscribe(listener: KillSwitchListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.active, this.reason);
    }
  }
}

export const killSwitch = new KillSwitchController();
