import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { AuditLogEntry, ApprovalEvent, ExecutionLog, KillSwitchEvent } from '../types/audit';
import { ActionPlan } from '../types/action-plan';
import { RegisteredProject } from '../types/projects';
import { TradeJournalEntry, PreparedSpotOrder } from '../types/trading';

/**
 * Detect if running inside Tauri desktop environment
 */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Filesystem persistence layer — abstracts Tauri fs vs browser localStorage
 */
class PersistenceLayer {
  private dbPath: string | null = null;
  private isTauri = false;

  async initialize(): Promise<void> {
    this.isTauri = isTauriEnvironment();

    if (this.isTauri) {
      try {
        // Dynamic import to avoid bundling issues in browser mode
        const { appDataDir, join } = await import('@tauri-apps/api/path');
        const dataDir = await appDataDir();
        this.dbPath = await join(dataDir, 'orbit.db');
        console.log('[Orbit DB] Tauri mode — persisting to:', this.dbPath);
      } catch (err) {
        console.warn('[Orbit DB] Tauri path API failed, falling back to localStorage:', err);
        this.isTauri = false;
      }
    }

    if (!this.isTauri) {
      console.warn(
        '[Orbit DB] Browser mode — database stored in localStorage (ephemeral). ' +
        'Data will be lost if browser cache is cleared. ' +
        'Build and run as Tauri desktop app for persistent storage.'
      );
    }
  }

  async loadDatabase(): Promise<Uint8Array | undefined> {
    if (this.isTauri && this.dbPath) {
      try {
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const data = await readFile(this.dbPath);
        return new Uint8Array(data);
      } catch {
        // File doesn't exist yet — fresh database
        return undefined;
      }
    }

    // Browser fallback: localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem('orbit_sqlite_data');
      if (raw) {
        try {
          const binary = atob(raw);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return bytes;
        } catch (err) {
          console.error('[Orbit DB] Failed to decode localStorage data:', err);
        }
      }
    }

    return undefined;
  }

  async saveDatabase(data: Uint8Array): Promise<void> {
    if (this.isTauri && this.dbPath) {
      try {
        const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs');
        const { appDataDir } = await import('@tauri-apps/api/path');
        // Ensure app data directory exists
        try {
          await mkdir(await appDataDir(), { recursive: true });
        } catch {
          // Directory may already exist
        }
        await writeFile(this.dbPath, data);
        return;
      } catch (err) {
        console.error('[Orbit DB] Tauri file write failed:', err);
      }
    }

    // Browser fallback: localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        let binary = '';
        const len = data.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(data[i]);
        }
        window.localStorage.setItem('orbit_sqlite_data', btoa(binary));
      } catch (err) {
        console.error('[Orbit DB] Failed to persist database to localStorage:', err);
      }
    }
  }

  async deleteDatabase(): Promise<void> {
    if (this.isTauri && this.dbPath) {
      try {
        const { remove } = await import('@tauri-apps/plugin-fs');
        await remove(this.dbPath);
      } catch {
        // File may not exist
      }
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('orbit_sqlite_data');
    }
  }
}

class OrbitDatabase {
  private db: SqlJsDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private persistence = new PersistenceLayer();
  private persistDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  public async initialize(): Promise<void> {
    if (this.isInitialized && this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // Initialize persistence layer first
        await this.persistence.initialize();

        const SQL = await initSqlJs({
          locateFile: (file) => `https://sql.js.org/dist/${file}`
        });

        // Load existing database from filesystem or localStorage
        const savedDb = await this.persistence.loadDatabase();

        this.db = new SQL.Database(savedDb);
        this.runMigrations();
        this.isInitialized = true;
        console.log('[Orbit DB] Database initialized successfully.');
      } catch (err) {
        console.warn('[Orbit DB] WASM remote load failed, falling back to in-memory:', err);
        const SQL = await initSqlJs();
        this.db = new SQL.Database();
        this.runMigrations();
        this.isInitialized = true;
      }
    })();

    return this.initPromise;
  }

  private runMigrations(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        root_path TEXT NOT NULL UNIQUE,
        default_branch TEXT NOT NULL DEFAULT 'main',
        framework TEXT,
        package_scripts TEXT,
        instructions TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS command_requests (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL,
        raw_command TEXT NOT NULL,
        transcription_confidence REAL,
        interpreted_intent TEXT NOT NULL,
        overall_risk TEXT NOT NULL,
        has_redactions INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS action_plans (
        id TEXT PRIMARY KEY,
        command_request_id TEXT,
        created_at TEXT NOT NULL,
        user_prompt TEXT NOT NULL,
        interpreted_intent TEXT NOT NULL,
        overall_risk TEXT NOT NULL,
        is_dry_run INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        serialized_actions TEXT NOT NULL,
        clarification_needed TEXT
      );

      CREATE TABLE IF NOT EXISTS approval_events (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        action_id TEXT,
        risk_level TEXT NOT NULL,
        decision TEXT NOT NULL,
        decided_at TEXT NOT NULL,
        typed_phrase_entered TEXT,
        rejection_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS execution_logs (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        command_executed TEXT,
        stdout TEXT,
        stderr TEXT,
        exit_code INTEGER,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        error TEXT
      );

      CREATE TABLE IF NOT EXISTS trade_journal (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        inr_amount REAL NOT NULL,
        is_paper INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        exchange_order_id TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS kill_switch_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        triggered_by TEXT NOT NULL,
        reason TEXT NOT NULL,
        active_processes_killed INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    this.persist();
  }

  /**
   * Persist database to filesystem (debounced to avoid excessive writes)
   */
  public persist(): void {
    if (!this.db) return;

    // Debounce persistence — write at most once every 500ms
    if (this.persistDebounceTimer) {
      clearTimeout(this.persistDebounceTimer);
    }

    this.persistDebounceTimer = setTimeout(() => {
      if (!this.db) return;
      try {
        const data = this.db.export();
        this.persistence.saveDatabase(data).catch((err) => {
          console.error('[Orbit DB] Persistence failed:', err);
        });
      } catch (err) {
        console.error('[Orbit DB] Export failed:', err);
      }
    }, 500);
  }

  // --- Audit Log operations ---

  public logCommand(entry: AuditLogEntry): void {
    if (!this.db) return;
    this.db.run(
      `INSERT OR REPLACE INTO command_requests (id, timestamp, source, raw_command, transcription_confidence, interpreted_intent, overall_risk, has_redactions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.timestamp,
        entry.source,
        entry.rawCommand,
        entry.transcriptionConfidence ?? 1.0,
        entry.interpretedIntent,
        entry.overallRisk,
        entry.hasSensitiveRedactions ? 1 : 0,
      ]
    );
    this.persist();
  }

  public saveActionPlan(plan: ActionPlan): void {
    if (!this.db) return;
    this.db.run(
      `INSERT OR REPLACE INTO action_plans (id, command_request_id, created_at, user_prompt, interpreted_intent, overall_risk, is_dry_run, status, serialized_actions, clarification_needed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plan.id,
        plan.auditLogId ?? null,
        plan.createdAt,
        plan.userPrompt,
        plan.interpretedIntent,
        plan.overallRisk,
        plan.isDryRun ? 1 : 0,
        plan.status,
        JSON.stringify(plan.actions),
        plan.clarificationNeeded ?? null,
      ]
    );
    this.persist();
  }

  public logApproval(event: ApprovalEvent): void {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO approval_events (id, plan_id, action_id, risk_level, decision, decided_at, typed_phrase_entered, rejection_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.planId,
        event.actionId ?? null,
        event.riskLevel,
        event.decision,
        event.decidedAt,
        event.typedPhraseEntered ?? null,
        event.rejectionReason ?? null,
      ]
    );
    this.persist();
  }

  public logExecution(log: ExecutionLog): void {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO execution_logs (id, plan_id, action_id, skill_id, command_executed, stdout, stderr, exit_code, status, started_at, completed_at, duration_ms, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.planId,
        log.actionId,
        log.skillId,
        log.commandExecuted ?? null,
        log.stdout ?? null,
        log.stderr ?? null,
        log.exitCode ?? 0,
        log.status,
        log.startedAt,
        log.completedAt,
        log.durationMs,
        log.error ?? null,
      ]
    );
    this.persist();
  }

  public logKillSwitchEvent(event: KillSwitchEvent): void {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO kill_switch_events (id, timestamp, triggered_by, reason, active_processes_killed)
       VALUES (?, ?, ?, ?, ?)`,
      [
        event.id,
        event.timestamp,
        event.triggeredBy,
        event.reason,
        event.activeProcessesKilledCount,
      ]
    );
    this.persist();
  }

  public logTradeJournal(entry: TradeJournalEntry): void {
    if (!this.db) return;
    this.db.run(
      `INSERT INTO trade_journal (id, order_id, symbol, side, quantity, price, inr_amount, is_paper, timestamp, exchange_order_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.orderId,
        entry.symbol,
        entry.side,
        entry.executedQuantity,
        entry.executionPrice,
        entry.inrAmount,
        entry.isPaper ? 1 : 0,
        entry.timestamp,
        entry.exchangeOrderId ?? null,
        entry.notes ?? null,
      ]
    );
    this.persist();
  }

  // --- Querying ---

  public getProjects(): RegisteredProject[] {
    if (!this.db) return [];
    const res = this.db.exec(`SELECT * FROM projects ORDER BY created_at DESC`);
    if (res.length === 0) return [];
    return res[0].values.map((row) => ({
      id: row[0] as string,
      name: row[1] as string,
      rootPath: row[2] as string,
      defaultBranch: row[3] as string,
      framework: row[4] as string | undefined,
      packageScripts: JSON.parse((row[5] as string) || '{}'),
      instructions: row[6] as string | undefined,
      allowedCommands: ['npm test', 'npm run dev', 'npm run build', 'git status', 'git diff'],
      createdAt: row[7] as string,
    }));
  }

  public saveProject(project: RegisteredProject): void {
    if (!this.db) return;
    this.db.run(
      `INSERT OR REPLACE INTO projects (id, name, root_path, default_branch, framework, package_scripts, instructions, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        project.name,
        project.rootPath,
        project.defaultBranch,
        project.framework ?? null,
        JSON.stringify(project.packageScripts || {}),
        project.instructions ?? null,
        project.createdAt,
      ]
    );
    this.persist();
  }

  public exportAuditLogs(): {
    commands: any[];
    plans: any[];
    approvals: any[];
    executions: any[];
    trades: any[];
    killSwitches: any[];
  } {
    if (!this.db) {
      return { commands: [], plans: [], approvals: [], executions: [], trades: [], killSwitches: [] };
    }

    const query = (sql: string) => {
      const res = this.db!.exec(sql);
      if (res.length === 0) return [];
      const cols = res[0].columns;
      return res[0].values.map((row) => {
        const item: Record<string, any> = {};
        cols.forEach((col, idx) => {
          item[col] = row[idx];
        });
        return item;
      });
    };

    return {
      commands: query('SELECT * FROM command_requests ORDER BY timestamp DESC LIMIT 200'),
      plans: query('SELECT * FROM action_plans ORDER BY created_at DESC LIMIT 200'),
      approvals: query('SELECT * FROM approval_events ORDER BY decided_at DESC LIMIT 200'),
      executions: query('SELECT * FROM execution_logs ORDER BY started_at DESC LIMIT 200'),
      trades: query('SELECT * FROM trade_journal ORDER BY timestamp DESC LIMIT 200'),
      killSwitches: query('SELECT * FROM kill_switch_events ORDER BY timestamp DESC LIMIT 200'),
    };
  }

  public resetAllData(): void {
    if (!this.db) return;
    this.persistence.deleteDatabase().catch(console.error);
    this.runMigrations();
  }
}

export const orbitDb = new OrbitDatabase();
