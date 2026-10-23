import { SearchResultItem } from '../tools/web/web-search-tool';
import { languageEngine } from './language-engine';
import { defaultOllamaAdapter } from '../adapters/llm/ollama-adapter';

export interface RetrievedKnowledge {
  query: string;
  keySnippets: string[];
  recentFacts: string[];
  sources: Array<{ title: string; url: string; source: string }>;
  hasRecentInfo: boolean;
}

export interface SynthesizedAnswer {
  directAnswer: string;
  spokenSummary: string;
  detailedMarkdown: string;
  sources: Array<{ title: string; url: string; source: string }>;
  hasRecentInfo: boolean;
  language: 'en' | 'ml';
  durationMs: number;
}

export class AnswerGenerator {
  /**
   * Stage 1 & 2: Clean, deduplicate, and classify retrieved evidence.
   */
  public retrieve(query: string, rawResults: SearchResultItem[]): RetrievedKnowledge {
    const keySnippets: string[] = [];
    const recentFacts: string[] = [];
    const sources: Array<{ title: string; url: string; source: string }> = [];
    const seenUrls = new Set<string>();

    for (const item of rawResults) {
      if (!item.snippet || item.snippet.trim().length === 0) continue;

      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        sources.push({
          title: item.title,
          url: item.url,
          source: item.source,
        });
      }

      const cleanSnippet = item.snippet.replace(/\s+/g, ' ').trim();
      keySnippets.push(cleanSnippet);

      if (item.isRecent) {
        recentFacts.push(cleanSnippet);
      }
    }

    return {
      query,
      keySnippets: keySnippets.slice(0, 5),
      recentFacts: recentFacts.slice(0, 3),
      sources: sources.slice(0, 4),
      hasRecentInfo: recentFacts.length > 0,
    };
  }

  /**
   * Stage 3 & 4: Reason, synthesize, and generate the final structured and spoken responses.
   */
  public async synthesize(
    knowledge: RetrievedKnowledge,
    targetLang: 'en' | 'ml' = 'en'
  ): Promise<SynthesizedAnswer> {
    const startTime = performance.now();

    if (knowledge.keySnippets.length === 0) {
      const directAnswer =
        targetLang === 'ml'
          ? `ക്ഷമിക്കണം, "${knowledge.query}" എന്ന വിഷയത്തിൽ പുതിയ വിവരങ്ങളൊന്നും കണ്ടെത്താൻ സാധിച്ചില്ല.`
          : `I could not find specific recent information about "${knowledge.query}".`;
      return {
        directAnswer,
        spokenSummary: directAnswer,
        detailedMarkdown: directAnswer,
        sources: [],
        hasRecentInfo: false,
        language: targetLang,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // Attempt local LLM synthesis if Ollama is available
    let synthesizedText: string | null = null;
    try {
      const ollamaHealth = await defaultOllamaAdapter.checkHealth();
      if (ollamaHealth.available) {
        const prompt = `Synthesize a concise, fact-based response for the user query: "${knowledge.query}".
Retrieved Evidence:
${knowledge.keySnippets.join('\n')}
Provide a clear, 2-3 sentence answer. Do not use conversational filler or repeat whole URLs.`;
        synthesizedText = await defaultOllamaAdapter.generatePlanPrompt(prompt, 'You are an intelligent personal assistant.');
      }
    } catch {
      // Fallback to deterministic synthesis
    }

    // Deterministic factual synthesis
    if (!synthesizedText) {
      synthesizedText = this.deterministicSynthesis(knowledge);
    }

    let finalDirectAnswer = synthesizedText;
    let finalSpokenSummary = synthesizedText;

    if (targetLang === 'ml') {
      finalDirectAnswer = languageEngine.formatMalayalamResponse(synthesizedText);
      finalSpokenSummary = finalDirectAnswer;
    } else {
      // Clean spoken summary for voice: concise and natural
      finalSpokenSummary = this.formatSpokenSummary(finalDirectAnswer);
    }

    // Detailed markdown output for UI presentation
    const sourceList = knowledge.sources
      .map((s, idx) => `[${idx + 1}] [${s.title}](${s.url}) — *${s.source}*`)
      .join('\n');

    const detailedMarkdown = `### ${targetLang === 'ml' ? 'കണ്ടെത്തിയ വിവരങ്ങൾ' : 'Research Summary'}: ${knowledge.query}

${finalDirectAnswer}

${knowledge.hasRecentInfo ? `> **Notice**: Includes verified recent updates.\n` : ''}
${knowledge.sources.length > 0 ? `#### Sources & Citations\n${sourceList}` : ''}`;

    return {
      directAnswer: finalDirectAnswer,
      spokenSummary: finalSpokenSummary,
      detailedMarkdown,
      sources: knowledge.sources,
      hasRecentInfo: knowledge.hasRecentInfo,
      language: targetLang,
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  /**
   * End-to-end pipeline: Search Results -> Retrieval -> Synthesis -> Final Response.
   */
  public async generate(
    query: string,
    searchResults: SearchResultItem[],
    targetLang?: 'en' | 'ml'
  ): Promise<SynthesizedAnswer> {
    const lang = targetLang || languageEngine.determineResponseLanguage(query);
    const knowledge = this.retrieve(query, searchResults);
    return await this.synthesize(knowledge, lang);
  }

  private deterministicSynthesis(knowledge: RetrievedKnowledge): string {
    const preferredFacts = knowledge.recentFacts.length > 0 ? knowledge.recentFacts : knowledge.keySnippets;
    // Extract first sentences from top 2 facts
    const sentences: string[] = [];

    for (const fact of preferredFacts) {
      const match = fact.match(/([A-Z0-9][^.!?]*[.!?])/);
      if (match && match[1]) {
        sentences.push(match[1].trim());
      } else {
        sentences.push(fact.slice(0, 150).trim() + '.');
      }
      if (sentences.length >= 2) break;
    }

    return sentences.join(' ');
  }

  private formatSpokenSummary(text: string): string {
    return text
      .replace(/\[\d+\]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[*_#`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const answerGenerator = new AnswerGenerator();
