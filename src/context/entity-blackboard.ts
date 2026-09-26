import { EntityRecord, EntityType } from '../types/context';
import { redactSensitiveData } from '../core/redactor';

export class EntityBlackboard {
  private entities: Map<string, EntityRecord> = new Map();

  /**
   * Set or update an entity record in the blackboard.
   * Ensures value is redacted before storage.
   */
  public setEntity(
    name: string,
    valueOrRecord: string | Partial<EntityRecord>,
    type: EntityType = 'custom',
    turnNumber = 1
  ): EntityRecord {
    let rawValue: string;
    let recordType: EntityType = type;
    let confidence = 1.0;
    let sourceTurn = turnNumber;
    let metadata: Record<string, any> | undefined;

    if (typeof valueOrRecord === 'string') {
      rawValue = valueOrRecord;
    } else {
      rawValue = valueOrRecord.value || '';
      recordType = valueOrRecord.type || type;
      confidence = valueOrRecord.confidence ?? 1.0;
      sourceTurn = valueOrRecord.sourceTurn ?? turnNumber;
      metadata = valueOrRecord.metadata;
    }

    const { redactedText, hasRedactions } = redactSensitiveData(rawValue);

    const record: EntityRecord = {
      name: name.trim(),
      type: recordType,
      value: redactedText,
      sourceTurn,
      confidence,
      redacted: hasRedactions,
      timestamp: Date.now(),
      metadata,
    };

    this.entities.set(name.toLowerCase().trim(), record);
    return record;
  }

  public getEntity(name: string): EntityRecord | null {
    return this.entities.get(name.toLowerCase().trim()) || null;
  }

  public hasEntity(name: string): boolean {
    return this.entities.has(name.toLowerCase().trim());
  }

  public getAllEntities(): Record<string, EntityRecord> {
    const result: Record<string, EntityRecord> = {};
    for (const [key, value] of this.entities.entries()) {
      result[key] = { ...value };
    }
    return result;
  }

  public getEntitiesByType(type: EntityType): EntityRecord[] {
    const list: EntityRecord[] = [];
    for (const record of this.entities.values()) {
      if (record.type === type) {
        list.push({ ...record });
      }
    }
    return list;
  }

  public deleteEntity(name: string): boolean {
    return this.entities.delete(name.toLowerCase().trim());
  }

  public clear(): void {
    this.entities.clear();
  }

  /**
   * Automatically extract common entities (apps, URLs, queries, paths, quoted text, amounts)
   * from conversational text and record them.
   */
  public extractAndRecord(text: string, turnNumber = 1): EntityRecord[] {
    if (!text || typeof text !== 'string') return [];

    const extracted: EntityRecord[] = [];
    const cleanText = text.trim();

    // 1. Applications
    const knownApps = [
      'Safari',
      'Google Chrome',
      'Chrome',
      'Calculator',
      'TextEdit',
      'Finder',
      'Terminal',
      'System Settings',
      'Notes',
      'Visual Studio Code',
      'Cursor',
      'Antigravity',
      'Claude Code',
      'Binance',
    ];

    for (const app of knownApps) {
      const regex = new RegExp(`\\b${app.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (regex.test(cleanText)) {
        const canonical = app.toLowerCase() === 'chrome' ? 'Google Chrome' : app;
        const record = this.setEntity('activeApp', canonical, 'app', turnNumber);
        this.setEntity('targetApp', canonical, 'app', turnNumber);
        extracted.push(record);
        break;
      }
    }

    // 2. URLs
    const urlMatch = cleanText.match(/\bhttps?:\/\/[^\s]+/i);
    if (urlMatch && urlMatch[0]) {
      const record = this.setEntity('url', urlMatch[0], 'url', turnNumber);
      extracted.push(record);
    }

    // 3. Search Queries: "search for [Query]", "search [Query]", "Google ൽ [Query] search"
    let searchQuery = '';
    const matchMl = cleanText.match(/(?:Google\s*ൽ|ൽ)\s+(.+?)\s+(?:search\s*ചെയ്യൂ|തിരയൂ|search\s*cheyyu)/i);
    if (matchMl && matchMl[1]) {
      searchQuery = matchMl[1].trim();
    }
    if (!searchQuery) {
      const matchManglish = cleanText.match(/(?:open\s+cheythitu|open\s+cheythu|cheythitu)\s+(.+?)\s+(?:search\s*cheyyu|search)/i);
      if (matchManglish && matchManglish[1]) {
        searchQuery = matchManglish[1].trim();
      }
    }
    if (!searchQuery) {
      const matchEn = cleanText.match(/(?:search\s+for|search)\s+(.+)$/i);
      if (matchEn && matchEn[1]) {
        searchQuery = matchEn[1]
          .replace(/\b(?:in\s+safari|in\s+chrome|on\s+safari|on\s+chrome|on\s+https?:\/\/\S+|on\s+google|please|search\s*cheyyu|cheyyu)\b/gi, '')
          .replace(/https?:\/\/\S+/gi, '')
          .replace(/\bon\s*$/i, '')
          .replace(/[.,;!?]+$/, '')
          .trim();
      }
    }
    if (searchQuery && searchQuery.toLowerCase() !== 'safari' && searchQuery.toLowerCase() !== 'chrome') {
      const record = this.setEntity('searchQuery', searchQuery, 'searchQuery', turnNumber);
      extracted.push(record);
    }

    // 4. File Paths or Filenames with extensions
    const pathMatch = cleanText.match(/(?:(?:\/(?:Users|System|Library|Applications)|~)[^\s]+|\b[a-zA-Z0-9_\-.]+\.(?:txt|pdf|csv|json|md|py|ts|js|html|png|jpg)\b)/);
    if (pathMatch && pathMatch[0]) {
      const record = this.setEntity('filePath', pathMatch[0], 'filePath', turnNumber);
      extracted.push(record);
    }

    // 5. Quoted Strings
    const quoteMatch = cleanText.match(/["']([^"']+)["']/);
    if (quoteMatch && quoteMatch[1]) {
      const record = this.setEntity('quotedText', quoteMatch[1], 'text', turnNumber);
      extracted.push(record);
    }

    // 6. Numeric expressions or amounts (e.g., "125 * 48", "₹1,000")
    const mathExprMatch = cleanText.match(/\b\d+\s*[\+\-\*\/x]\s*\d+(?:\s*[\+\-\*\/x]\s*\d+)*\b/i);
    if (mathExprMatch && mathExprMatch[0]) {
      const record = this.setEntity('mathExpression', mathExprMatch[0].replace(/x/g, '*'), 'number', turnNumber);
      extracted.push(record);
    }

    const inrMatch = cleanText.match(/(?:₹|rs\.?|inr)\s*([0-9,]+)/i);
    if (inrMatch && inrMatch[1]) {
      const record = this.setEntity('amountInr', inrMatch[1].replace(/,/g, ''), 'number', turnNumber);
      extracted.push(record);
    }

    return extracted;
  }
}

export const entityBlackboard = new EntityBlackboard();
