export type EntityType =
  | 'app'
  | 'url'
  | 'filePath'
  | 'searchQuery'
  | 'selectedItem'
  | 'number'
  | 'text'
  | 'custom';

export interface EntityRecord {
  name: string;
  type: EntityType;
  value: string;
  sourceTurn: number;
  confidence: number;
  redacted: boolean;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ConversationalTurn {
  turnId: string;
  turnNumber: number;
  timestamp: number;
  userPrompt: string; // Redacted
  interpretedIntent: string;
  activeApp?: string;
  actions: string[];
  success: boolean;
  entities: EntityRecord[];
  durationMs?: number;
  riskTier?: string;
}

export interface TaskSession {
  sessionId: string;
  taskId: string;
  goal: string;
  createdAt: number;
  lastUpdatedAt: number;
  currentTurn: number;
  activeApp?: string;
  activeWindow?: string;
  turns: ConversationalTurn[];
  entities: Record<string, EntityRecord>;
  isComplete: boolean;
  isExpired: boolean;
  ttlMs: number;
}

export interface ContextSnapshot {
  sessionId: string;
  taskId: string;
  goal: string;
  activeApp?: string;
  activeWindow?: string;
  turnCount: number;
  entitiesCount: number;
  entities: Record<string, string>;
  isExpired: boolean;
  ageSeconds: number;
}
