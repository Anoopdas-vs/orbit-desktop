import { TaskSession, ConversationalTurn, EntityRecord, EntityType, ContextSnapshot } from '../types/context';
import { entityBlackboard, EntityBlackboard } from './entity-blackboard';
import { redactSensitiveData } from '../core/redactor';

export class TaskContextManager {
  private activeSession: TaskSession | null = null;
  private blackboard: EntityBlackboard;
  public defaultTtlMs = 120000; // 120 seconds TTL

  constructor(blackboard: EntityBlackboard = entityBlackboard, defaultTtlMs = 120000) {
    this.blackboard = blackboard;
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Start or replace the current active task session.
   */
  public startTask(goal: string, targetApp?: string, ttlMs?: number): TaskSession {
    const { redactedText } = redactSensitiveData(goal);
    const now = Date.now();

    this.blackboard.clear();

    if (targetApp) {
      this.blackboard.setEntity('activeApp', targetApp, 'app', 0);
      this.blackboard.setEntity('targetApp', targetApp, 'app', 0);
    }

    const session: TaskSession = {
      sessionId: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      goal: redactedText,
      createdAt: now,
      lastUpdatedAt: now,
      currentTurn: 0,
      activeApp: targetApp,
      activeWindow: undefined,
      turns: [],
      entities: this.blackboard.getAllEntities(),
      isComplete: false,
      isExpired: false,
      ttlMs: ttlMs ?? this.defaultTtlMs,
    };

    this.activeSession = session;
    return session;
  }

  /**
   * Check if a session exists and is still unexpired.
   */
  public isSessionActive(): boolean {
    return this.getActiveSession() !== null;
  }

  /**
   * Get active session, evaluating TTL expiration.
   */
  public getActiveSession(): TaskSession | null {
    if (!this.activeSession) return null;

    if (this.activeSession.isComplete) {
      return null;
    }

    const elapsed = Date.now() - this.activeSession.lastUpdatedAt;
    if (elapsed > this.activeSession.ttlMs) {
      this.activeSession.isExpired = true;
      return null;
    }

    return this.activeSession;
  }

  /**
   * Record a new conversational turn in the active session.
   * If no active session exists or it has expired, creates a new one automatically.
   */
  public recordTurn(turnData: {
    userPrompt: string;
    interpretedIntent: string;
    activeApp?: string;
    actions?: string[];
    success?: boolean;
    durationMs?: number;
    riskTier?: string;
  }): ConversationalTurn {
    let session = this.getActiveSession();
    if (!session) {
      session = this.startTask(turnData.interpretedIntent || turnData.userPrompt, turnData.activeApp);
    }

    const now = Date.now();
    session.currentTurn += 1;
    const turnNumber = session.currentTurn;

    // Automatically extract entities from user prompt
    const extractedEntities = this.blackboard.extractAndRecord(turnData.userPrompt, turnNumber);

    if (turnData.activeApp) {
      this.setActiveApp(turnData.activeApp);
    }

    const { redactedText } = redactSensitiveData(turnData.userPrompt);
    const { redactedText: redactedIntent } = redactSensitiveData(turnData.interpretedIntent);

    const turn: ConversationalTurn = {
      turnId: crypto.randomUUID(),
      turnNumber,
      timestamp: now,
      userPrompt: redactedText,
      interpretedIntent: redactedIntent,
      activeApp: this.getActiveApp() || undefined,
      actions: turnData.actions || [],
      success: turnData.success ?? true,
      entities: extractedEntities,
      durationMs: turnData.durationMs,
      riskTier: turnData.riskTier || 'LOW',
    };

    session.turns.push(turn);
    session.lastUpdatedAt = now;
    session.entities = this.blackboard.getAllEntities();

    return turn;
  }

  public getSession(): TaskSession {
    return this.getActiveSession() || this.startTask('New Session');
  }

  public reset(): void {
    this.resetTask();
  }

  public getActiveApp(): string | null {
    const appEntity = this.blackboard.getEntity('activeApp');
    if (appEntity && appEntity.value) {
      return appEntity.value;
    }
    return this.activeSession?.activeApp || null;
  }

  public setActiveApp(appName: string): void {
    if (!appName) return;
    this.blackboard.setEntity('activeApp', appName, 'app', this.activeSession?.currentTurn || 0);
    this.blackboard.setEntity('targetApp', appName, 'app', this.activeSession?.currentTurn || 0);
    if (this.activeSession) {
      this.activeSession.activeApp = appName;
      this.activeSession.lastUpdatedAt = Date.now();
    }
  }

  public getActiveWindow(): string | null {
    const winEntity = this.blackboard.getEntity('activeWindow');
    if (winEntity && winEntity.value) {
      return winEntity.value;
    }
    return this.activeSession?.activeWindow || null;
  }

  public setActiveWindow(windowTitle: string): void {
    if (!windowTitle) return;
    this.blackboard.setEntity('activeWindow', windowTitle, 'text', this.activeSession?.currentTurn || 0);
    if (this.activeSession) {
      this.activeSession.activeWindow = windowTitle;
      this.activeSession.lastUpdatedAt = Date.now();
    }
  }

  public getEntity(name: string): EntityRecord | null {
    return this.blackboard.getEntity(name);
  }

  public setEntity(name: string, value: string, type?: EntityType): EntityRecord {
    const turn = this.activeSession?.currentTurn || 1;
    const record = this.blackboard.setEntity(name, value, type, turn);
    if (this.activeSession) {
      this.activeSession.entities[name.toLowerCase()] = record;
      this.activeSession.lastUpdatedAt = Date.now();
    }
    return record;
  }

  public getAllEntities(): Record<string, EntityRecord> {
    return this.blackboard.getAllEntities();
  }

  /**
   * Explicitly reset and clear the task context and entity blackboard.
   */
  public resetTask(reason = 'Explicit task reset'): void {
    if (this.activeSession) {
      this.activeSession.isComplete = true;
    }
    this.activeSession = null;
    this.blackboard.clear();
  }

  /**
   * Mark current task complete.
   */
  public completeTask(success = true): void {
    if (this.activeSession) {
      this.activeSession.isComplete = true;
      this.activeSession.lastUpdatedAt = Date.now();
    }
  }

  public setTtlMs(ttlMs: number): void {
    this.defaultTtlMs = ttlMs;
    if (this.activeSession) {
      this.activeSession.ttlMs = ttlMs;
    }
  }

  public getSnapshot(): ContextSnapshot | null {
    const session = this.getActiveSession();
    if (!session) return null;

    const entitiesSummary: Record<string, string> = {};
    for (const [key, record] of Object.entries(this.blackboard.getAllEntities())) {
      entitiesSummary[key] = record.value;
    }

    return {
      sessionId: session.sessionId,
      taskId: session.taskId,
      goal: session.goal,
      activeApp: session.activeApp,
      activeWindow: session.activeWindow,
      turnCount: session.turns.length,
      entitiesCount: Object.keys(entitiesSummary).length,
      entities: entitiesSummary,
      isExpired: session.isExpired,
      ageSeconds: Math.round((Date.now() - session.createdAt) / 1000),
    };
  }
}

export const taskContextManager = new TaskContextManager();
