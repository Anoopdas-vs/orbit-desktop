import { jankiDb } from '../db/database';
import { redactSensitiveData } from './redactor';
import { SemanticVectorEngine } from './memory/semantic-vector';

export type MemoryCategory =
  | 'user_preference'
  | 'personal_fact'
  | 'project_context'
  | 'recurring_workflow'
  | 'business_context'
  | 'frequent_application'
  | 'previous_decision'
  | 'historical_context';

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  isSensitive: boolean;
  lifecycle?: 'temporary' | 'persistent';
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  preferredResponseLanguage: 'en' | 'ml' | 'manglish';
  speechRate: number;
  voiceGender: 'female' | 'male';
  defaultBrowser: 'Safari' | 'Google Chrome';
  webSearchProvider: 'duckduckgo' | 'google' | 'direct';
  autoConfirmLowRisk: boolean;
  businessContextSummary?: string;
}

export class MemoryEngine {
  private sessionContext: Map<string, any> = new Map();
  private inMemoryPreferences: Record<string, string> = {};
  private inMemoryMemories: Map<string, MemoryItem> = new Map();
  private inMemoryWorkflows: Map<string, any> = new Map();

  /**
   * Set a temporary in-memory session variable (erased on session end).
   */
  public setSessionContext(key: string, value: any): void {
    this.sessionContext.set(key, value);
  }

  /**
   * Retrieve a temporary session variable.
   */
  public getSessionContext<T = any>(key: string): T | undefined {
    return this.sessionContext.get(key);
  }

  /**
   * Clear all temporary session context.
   */
  public clearSessionContext(): void {
    this.sessionContext.clear();
  }

  /**
   * Save a personal memory item with privacy filtering, secret rejection, and redaction.
   */
  public saveMemory(
    category: MemoryCategory,
    key: string,
    value: string,
    isSensitive = false,
    lifecycle: 'temporary' | 'persistent' = 'persistent'
  ): MemoryItem {
    // Redact sensitive patterns first
    const redaction = redactSensitiveData(value);
    const sanitizedValue = isSensitive || redaction.hasRedactions ? redaction.redactedText : value;

    // Strict Privacy Invariant: If sanitized value still contains an unredacted raw secret or password
    const unredactedForbiddenPattern = /(?:password[\s:=]+['"]?[^\s]{6,}|bearer\s+[a-zA-Z0-9_\-.~+/=]{15,}|ya29\.[a-zA-Z0-9_\-]{20,})/i;
    if (unredactedForbiddenPattern.test(sanitizedValue)) {
      throw new Error(`Privacy violation: Refusing to store raw credentials/secrets in long-term memory for key "${key}".`);
    }

    const id = `${category}:${key}`;
    const now = new Date().toISOString();

    const item: MemoryItem = {
      id,
      category,
      key,
      value: sanitizedValue,
      isSensitive: isSensitive || redaction.hasRedactions,
      lifecycle,
      createdAt: now,
      updatedAt: now,
    };

    this.inMemoryMemories.set(id, item);

    if (lifecycle === 'persistent') {
      try {
        jankiDb.savePersonalMemory({
          id,
          category,
          key,
          value: sanitizedValue,
          isSensitive: isSensitive || redaction.hasRedactions,
        });
      } catch {
        // Non-fatal if DB uninitialized in tests
      }
    }

    return item;
  }

  /**
   * Semantic vector search across all memories or a specific category.
   * Retrieves only relevant context (prevents context bloat in LLM prompts).
   */
  public searchRelevantMemories(
    query: string,
    category?: MemoryCategory,
    maxResults: number = 3,
    minThreshold: number = 0.15
  ): MemoryItem[] {
    const candidates = this.getMemories(category);
    if (candidates.length === 0) return [];

    const ranked = SemanticVectorEngine.searchTopK(
      query,
      candidates,
      (m) => `${m.key} ${m.value}`,
      maxResults,
      minThreshold
    );

    return ranked.map((r) => r.item);
  }

  /**
   * Get memories by category.
   */
  public getMemories(category?: MemoryCategory): MemoryItem[] {
    try {
      const raw = jankiDb.getPersonalMemories(category);
      if (raw && raw.length > 0) {
        return raw.map((r) => ({
          ...r,
          category: r.category as MemoryCategory,
        }));
      }
    } catch {
      // Fallback to in-memory
    }

    const items = Array.from(this.inMemoryMemories.values());
    return category ? items.filter((m) => m.category === category) : items;
  }

  /**
   * Look up a specific memory by category and key.
   */
  public getMemory(category: MemoryCategory, key: string): MemoryItem | null {
    const memories = this.getMemories(category);
    return memories.find((m) => m.key === key) || null;
  }

  /**
   * Delete a memory item.
   */
  public deleteMemory(id: string): void {
    this.inMemoryMemories.delete(id);
    try {
      jankiDb.deletePersonalMemory(id);
    } catch {
      // DB fallback
    }
  }

  /**
   * Clear all memories in a given category.
   */
  public clearCategory(category: MemoryCategory): void {
    for (const [id, item] of this.inMemoryMemories.entries()) {
      if (item.category === category) {
        this.inMemoryMemories.delete(id);
        try {
          jankiDb.deletePersonalMemory(id);
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Retrieve structured user preferences with sensible defaults.
   */
  public getUserPreferences(): UserPreferences {
    let prefs: Record<string, string> = { ...this.inMemoryPreferences };
    try {
      const dbPrefs = jankiDb.getAllUserPreferences();
      prefs = { ...prefs, ...dbPrefs };
    } catch {
      // in-memory fallback
    }

    return {
      preferredResponseLanguage: (prefs.preferredResponseLanguage as any) || 'en',
      speechRate: prefs.speechRate ? parseFloat(prefs.speechRate) : 1.05,
      voiceGender: (prefs.voiceGender as any) || 'female',
      defaultBrowser: (prefs.defaultBrowser as any) || 'Safari',
      webSearchProvider: (prefs.webSearchProvider as any) || 'duckduckgo',
      autoConfirmLowRisk: prefs.autoConfirmLowRisk === 'true',
      businessContextSummary: prefs.businessContextSummary || undefined,
    };
  }

  /**
   * Update a specific user preference.
   */
  public setUserPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    this.inMemoryPreferences[key] = String(value);
    try {
      jankiDb.setUserPreference(key, String(value));
    } catch {
      // in-memory fallback
    }
  }

  /**
   * Save a recurring workflow definition.
   */
  public saveRecurringWorkflow(
    id: string,
    name: string,
    triggerPattern: string,
    workflowDefinition: any
  ): void {
    const item = {
      id,
      name,
      triggerPattern,
      workflowDefinition: typeof workflowDefinition === 'string' ? JSON.parse(workflowDefinition) : workflowDefinition,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.inMemoryWorkflows.set(id, item);

    try {
      jankiDb.saveRecurringWorkflow({
        id,
        name,
        triggerPattern,
        workflowDefinition: typeof workflowDefinition === 'string' ? workflowDefinition : JSON.stringify(workflowDefinition),
      });
    } catch {
      // DB fallback
    }
  }

  /**
   * List saved recurring workflows.
   */
  public getRecurringWorkflows(): Array<{
    id: string;
    name: string;
    triggerPattern: string;
    workflowDefinition: any;
    createdAt: string;
    updatedAt: string;
  }> {
    try {
      const dbWorkflows = jankiDb.getRecurringWorkflows();
      if (dbWorkflows && dbWorkflows.length > 0) {
        return dbWorkflows.map((wf) => {
          let parsed = wf.workflowDefinition;
          try {
            parsed = JSON.parse(wf.workflowDefinition);
          } catch {
            // keep
          }
          return { ...wf, workflowDefinition: parsed };
        });
      }
    } catch {
      // in-memory fallback
    }

    return Array.from(this.inMemoryWorkflows.values());
  }
}

export const memoryEngine = new MemoryEngine();
