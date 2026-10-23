import { describe, it, expect, beforeEach } from 'vitest';
import { memoryEngine } from '../src/core/memory-engine';
import { SemanticVectorEngine } from '../src/core/memory/semantic-vector';

describe('Phase 6: Long-Term Structured Memory & Semantic Vector Retrieval', () => {
  beforeEach(() => {
    memoryEngine.clearCategory('personal_fact');
    memoryEngine.clearCategory('frequent_application');
    memoryEngine.clearCategory('historical_context');
  });

  it('computes cosine similarity correctly for related texts', () => {
    const textA = 'Safari web browser for searching tax portals';
    const textB = 'Safari internet browser for tax website';
    const textC = 'Bitcoin cryptocurrency algorithmic trading';

    const simAB = SemanticVectorEngine.cosineSimilarity(textA, textB);
    const simAC = SemanticVectorEngine.cosineSimilarity(textA, textC);

    expect(simAB).toBeGreaterThan(0.25);
    expect(simAB).toBeGreaterThan(simAC);
  });

  it('stores memories across new Phase 6 categories and performs semantic retrieval', () => {
    memoryEngine.saveMemory(
      'frequent_application',
      'xcode_usage',
      'User frequently uses Xcode to compile macOS desktop applications and Swift binaries.'
    );
    memoryEngine.saveMemory(
      'frequent_application',
      'vlc_usage',
      'User watches local video recordings and tutorials with VLC player.'
    );
    memoryEngine.saveMemory(
      'personal_fact',
      'user_location',
      'User is based in Kochi, Kerala and focuses on local state compliance.'
    );

    // Query relevant memories with semantic vector search
    const results = memoryEngine.searchRelevantMemories('Where does the user live and work?', undefined, 2);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].key).toBe('user_location');
    expect(results[0].value).toContain('Kochi, Kerala');
  });

  it('supports temporary session lifecycle vs persistent storage', () => {
    const tempItem = memoryEngine.saveMemory(
      'project_context',
      'current_scratchpad',
      'Working on Phase 6 screen vision tests',
      false,
      'temporary'
    );

    expect(tempItem.lifecycle).toBe('temporary');
    const retrieved = memoryEngine.getMemory('project_context', 'current_scratchpad');
    expect(retrieved?.value).toBe('Working on Phase 6 screen vision tests');
  });

  it('filters and ranks contextual memories to avoid LLM context bloat', () => {
    memoryEngine.saveMemory('historical_context', 'h1', 'Decided to use Tauri v2 instead of Electron for low resource overhead');
    memoryEngine.saveMemory('historical_context', 'h2', 'Configured DuckDuckGo for zero-API-key search');
    memoryEngine.saveMemory('historical_context', 'h3', 'Integrated Binance spot paper trading engine');

    const relevant = memoryEngine.searchRelevantMemories('Tauri vs Electron architecture decision', 'historical_context', 1);

    expect(relevant.length).toBe(1);
    expect(relevant[0].key).toBe('h1');
  });
});
