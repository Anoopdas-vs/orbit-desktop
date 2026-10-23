import { z } from 'zod';
import { Tool, ToolExecutionContext, ToolExecutionResult, VerificationResult } from '../../types/tools';

export const WebSearchInputSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty'),
  maxResults: z.number().min(1).max(10).default(5),
  recencyFilter: z.enum(['any', 'recent', 'latest']).default('recent'),
});

export type WebSearchInput = z.infer<typeof WebSearchInputSchema>;

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  isRecent: boolean;
  publishedDate?: string;
  source: string;
}

export interface WebSearchOutput {
  query: string;
  totalFound: number;
  results: SearchResultItem[];
  hasRecentInfo: boolean;
  searchProvider: string;
}

export class WebSearchTool implements Tool<WebSearchInput, WebSearchOutput> {
  public name = 'web_search';
  public description = 'Executes web search for real-world factual information, distinguishes current from outdated data, and provides citations.';
  public inputSchema = WebSearchInputSchema;
  public riskLevel = 'LOW' as const;
  public requiredPermissions = ['network' as const];

  public async execute(
    input: WebSearchInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<WebSearchOutput>> {
    const startTime = performance.now();

    if (context.killSwitchActive()) {
      return {
        status: 'BLOCKED',
        success: false,
        error: 'Execution blocked: Emergency Kill Switch is engaged.',
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    if (context.isDryRun) {
      return {
        status: 'SUCCESS',
        success: true,
        data: {
          query: input.query,
          totalFound: 1,
          results: [
            {
              title: `[DRY RUN] Search result for: ${input.query}`,
              url: 'https://example.com/dry-run',
              snippet: `Simulated dry-run search for query: "${input.query}"`,
              isRecent: true,
              source: 'DryRunEngine',
            },
          ],
          hasRecentInfo: true,
          searchProvider: 'DryRun',
        },
        stdout: `[DRY RUN] Would search web for: "${input.query}"`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      const results = await this.performLiveSearch(input.query, input.maxResults);

      if (results.length === 0) {
        return {
          status: 'PARTIAL_SUCCESS',
          success: true,
          data: {
            query: input.query,
            totalFound: 0,
            results: [],
            hasRecentInfo: false,
            searchProvider: 'DuckDuckGo Instant',
          },
          stdout: `No immediate search records found for query "${input.query}".`,
          message: `No public web records found for "${input.query}".`,
          durationMs: Math.round(performance.now() - startTime),
        };
      }

      const hasRecentInfo = results.some((r) => r.isRecent);

      return {
        status: 'SUCCESS',
        success: true,
        data: {
          query: input.query,
          totalFound: results.length,
          results,
          hasRecentInfo,
          searchProvider: 'DuckDuckGo Instant',
        },
        stdout: `Found ${results.length} results for "${input.query}" (${hasRecentInfo ? 'Includes recent updates' : 'Standard reference records'}).`,
        message: `Found ${results.length} search records.`,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err: any) {
      const isNetworkError =
        err.name === 'AbortError' ||
        err.message?.includes('fetch failed') ||
        err.message?.includes('ENOTFOUND') ||
        err.message?.includes('ECONNREFUSED') ||
        err.message?.includes('network');

      return {
        status: isNetworkError ? 'UNAVAILABLE' : 'FAILED',
        success: false,
        error: isNetworkError
          ? `Web search service is currently unreachable: ${err.message}. Internet connection or search provider may be unavailable.`
          : `Web search failed: ${err.message}`,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  public async verify(
    input: WebSearchInput,
    result: ToolExecutionResult<WebSearchOutput>
  ): Promise<VerificationResult> {
    if (!result.success || !result.data) {
      return {
        verified: false,
        actualState: result.status,
        error: result.error || 'Web search did not succeed',
      };
    }

    if (result.status === 'SUCCESS' && result.data.results.length === 0) {
      return {
        verified: false,
        actualState: 'EMPTY_RESULTS',
        error: 'Search marked as success but returned zero results',
      };
    }

    return {
      verified: true,
      actualState: `Found ${result.data.results.length} verified results`,
    };
  }

  private async performLiveSearch(query: string, maxResults: number): Promise<SearchResultItem[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      // 1. DuckDuckGo Instant Answer JSON API
      const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Search provider returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const items: SearchResultItem[] = [];

      // Primary Abstract
      if (data.AbstractText) {
        items.push({
          title: data.Heading || query,
          url: data.AbstractURL || 'https://duckduckgo.com',
          snippet: data.AbstractText,
          isRecent: this.evaluateRecency(data.AbstractText),
          source: data.AbstractSource || 'DuckDuckGo',
        });
      }

      // Related Topics
      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (items.length >= maxResults) break;
          if (topic.Text && topic.FirstURL) {
            items.push({
              title: topic.Text.split(' - ')[0] || query,
              url: topic.FirstURL,
              snippet: topic.Text,
              isRecent: this.evaluateRecency(topic.Text),
              source: 'DuckDuckGo Knowledge',
            });
          }
        }
      }

      // If DuckDuckGo instant answer gave 0 results, query public search aggregator or HTML fallback
      if (items.length === 0) {
        return await this.fallbackHtmlSearch(query, maxResults);
      }

      return items.slice(0, maxResults);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fallbackHtmlSearch(query: string, maxResults: number): Promise<SearchResultItem[]> {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(timeout);

      if (!res.ok) return [];

      const html = await res.text();
      const items: SearchResultItem[] = [];

      // Extract result snippets using regex
      const regex = /<a[^>]*class="result__snippet"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gis;
      let match;
      while ((match = regex.exec(html)) !== null && items.length < maxResults) {
        const snippet = match[2].replace(/<[^>]+>/g, '').trim();
        const rawUrl = match[1];
        if (snippet) {
          items.push({
            title: `Web Search: ${query}`,
            url: rawUrl.startsWith('http') ? rawUrl : `https://duckduckgo.com${rawUrl}`,
            snippet,
            isRecent: this.evaluateRecency(snippet),
            source: 'Web Index',
          });
        }
      }

      return items;
    } catch {
      return [];
    }
  }

  private evaluateRecency(text: string): boolean {
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;
    const lower = text.toLowerCase();

    // Check for explicit current year or terms indicating recency
    const hasYear = lower.includes(String(currentYear)) || lower.includes(String(lastYear));
    const hasRecencyKeyword =
      lower.includes('latest') ||
      lower.includes('announced') ||
      lower.includes('released') ||
      lower.includes('update') ||
      lower.includes('recent') ||
      lower.includes('current') ||
      lower.includes('new');

    return hasYear || hasRecencyKeyword;
  }
}

export const webSearchTool = new WebSearchTool();
