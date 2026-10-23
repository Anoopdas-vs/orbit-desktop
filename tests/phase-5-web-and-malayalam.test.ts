import { describe, it, expect, beforeEach, vi } from 'vitest';
import { webSearchTool } from '../src/tools/web/web-search-tool';
import { browserResearchTool } from '../src/tools/browser/browser-research-tool';
import { answerGenerator } from '../src/core/answer-generator';
import { languageEngine } from '../src/core/language-engine';
import { speechSynth } from '../src/adapters/voice/speech-synthesis';
import { nativeBridge } from '../src/adapters/native/tauri-bridge';
import { fileWorkflowTool } from '../src/tools/integrations/file-workflow-tool';
import { killSwitch } from '../src/core/kill-switch';

describe('Phase 5: Web Intelligence, Answer Generation & Malayalam Response', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    killSwitch.disengage();
  });

  describe('3. Web Search & Intelligence', () => {
    it('executes dry-run search without network overhead', async () => {
      const res = await webSearchTool.execute(
        { query: 'Apple M4 MacBook Pro', maxResults: 3, recencyFilter: 'recent' },
        { isDryRun: true, killSwitchActive: () => false }
      );

      expect(res.status).toBe('SUCCESS');
      expect(res.success).toBe(true);
      expect(res.data?.results.length).toBe(1);
      expect(res.data?.results[0].title).toMatch(/dry[- ]run/i);
    });

    it('performs live search or mock fetch and tags recency', async () => {
      // Mock global fetch for deterministic response
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          AbstractText: "Apple announced the new MacBook Pro powered by the M4 family of chips in late 2024 and 2025, offering enhanced Neural Engine performance.",
          Heading: "MacBook Pro M4",
          AbstractURL: "https://apple.com/macbook-pro",
          AbstractSource: "Apple Knowledge",
          RelatedTopics: [
            {
              Text: "MacBook Pro M4 features 14-inch and 16-inch Liquid Retina XDR displays with quantum dot technology.",
              FirstURL: "https://apple.com/specs",
            },
          ],
        }),
      } as any);

      const res = await webSearchTool.execute(
        { query: "Apple's new MacBook Pro", maxResults: 3, recencyFilter: 'recent' },
        { isDryRun: false, killSwitchActive: () => false }
      );

      expect(res.status).toBe('SUCCESS');
      expect(res.success).toBe(true);
      expect(res.data?.results.length).toBeGreaterThan(0);
      expect(res.data?.hasRecentInfo).toBe(true);
      expect(res.data?.results[0].snippet).toContain('MacBook Pro');
    });

    it('verifies non-empty search results', async () => {
      const searchRes = {
        status: 'SUCCESS' as const,
        success: true,
        data: {
          query: 'Gold price',
          totalFound: 1,
          results: [{ title: 'Gold Market', url: 'https://gold.org', snippet: 'Current gold spot', isRecent: true, source: 'Market' }],
          hasRecentInfo: true,
          searchProvider: 'DuckDuckGo',
        },
        durationMs: 50,
      };

      const verifyRes = await webSearchTool.verify({ query: 'Gold price', maxResults: 5, recencyFilter: 'recent' }, searchRes);
      expect(verifyRes.verified).toBe(true);
      expect(verifyRes.actualState).toContain('verified results');
    });
  });

  describe('4. Search Failure & Truth-in-Failure', () => {
    it('returns explicit UNAVAILABLE status upon network/provider failure without faking results', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('fetch failed: network connection offline (ENOTFOUND)'));

      const res = await webSearchTool.execute(
        { query: 'Latest macroeconomic updates', maxResults: 3, recencyFilter: 'recent' },
        { isDryRun: false, killSwitchActive: () => false }
      );

      expect(res.status).toBe('UNAVAILABLE');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Web search service is currently unreachable');
      expect(res.error).toContain('network');
      // Must not generate fake results!
      expect(res.data).toBeUndefined();
    });

    it('returns PARTIAL_SUCCESS when provider responds but has no records for obscure query', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ AbstractText: '', Heading: '', RelatedTopics: [] }),
        text: async () => '<html><body>No results found</body></html>',
      } as any);

      const res = await webSearchTool.execute(
        { query: 'qwertyuiopxyz12345nonexistent', maxResults: 3, recencyFilter: 'recent' },
        { isDryRun: false, killSwitchActive: () => false }
      );

      expect(res.status).toBe('PARTIAL_SUCCESS');
      expect(res.data?.results.length).toBe(0);
      expect(res.message).toContain('No public web records found');
    });
  });

  describe('5. Answer Generation (Search -> Retrieval -> Synthesis -> Final Response)', () => {
    const sampleResults = [
      {
        title: "Apple introduces M4 MacBook Pro",
        url: "https://apple.com/news/m4",
        snippet: "In 2025, Apple unveiled the redesigned MacBook Pro featuring the powerful M4 Max chip with up to 128GB unified memory.",
        isRecent: true,
        source: "Apple Newsroom",
      },
      {
        title: "MacBook Benchmark Analysis",
        url: "https://tech-reviews.com/benchmarks",
        snippet: "Performance benchmarks confirm 3.5x faster ray-tracing performance compared to M1 models.",
        isRecent: true,
        source: "TechReviews",
      },
    ];

    it('retrieves and deduplicates evidence with recency tagging', () => {
      const retrieved = answerGenerator.retrieve("Apple MacBook", sampleResults);
      expect(retrieved.keySnippets.length).toBe(2);
      expect(retrieved.hasRecentInfo).toBe(true);
      expect(retrieved.sources.length).toBe(2);
    });

    it('synthesizes concise answer without reading raw snippets directly', async () => {
      const retrieved = answerGenerator.retrieve("Apple MacBook", sampleResults);
      const answer = await answerGenerator.synthesize(retrieved, 'en');

      expect(answer.directAnswer).toBeDefined();
      expect(answer.directAnswer.length).toBeGreaterThan(20);
      expect(answer.spokenSummary).not.toContain('http');
      expect(answer.spokenSummary).not.toContain('https://');
      expect(answer.detailedMarkdown).toContain('### Research Summary');
      expect(answer.detailedMarkdown).toContain('Sources & Citations');
      expect(answer.hasRecentInfo).toBe(true);
    });
  });

  describe('6. Malayalam Response Path & TTS Foundation', () => {
    it('detects Malayalam query and sets target language to ml', () => {
      const prompt = 'ഇന്നത്തെ പ്രധാന വാർത്തകൾ എന്തൊക്കെയാണ്?';
      const detection = languageEngine.detect(prompt);
      expect(detection.language).toBe('ml');
      expect(detection.hasMalayalamScript).toBe(true);

      const targetLang = languageEngine.determineResponseLanguage(prompt);
      expect(targetLang).toBe('ml');
    });

    it('synthesizes natural Malayalam response for Malayalam queries', async () => {
      const sampleResults = [
        {
          title: "Kerala News",
          url: "https://keralanews.in",
          snippet: "സംസ്ഥാനത്ത് പുതിയ വികസന പദ്ധതികൾ പ്രഖ്യാപിച്ചു. ഐടി മേഖലയിൽ പുതിയ നിക്ഷേപങ്ങൾ വരുന്നു.",
          isRecent: true,
          source: "Kerala News",
        },
      ];

      const retrieved = answerGenerator.retrieve('ഇന്നത്തെ പ്രധാന വാർത്തകൾ', sampleResults);
      const answer = await answerGenerator.synthesize(retrieved, 'ml');

      expect(answer.language).toBe('ml');
      expect(/[\u0D00-\u0D7F]/.test(answer.directAnswer)).toBe(true);
      expect(/[\u0D00-\u0D7F]/.test(answer.spokenSummary)).toBe(true);
    });

    it('targets Malayalam voice (ml-IN) when speaking Malayalam text', async () => {
      // Mock window.speechSynthesis and SpeechSynthesisUtterance
      class MockUtterance {
        public text: string;
        public lang = 'en-US';
        public voice: SpeechSynthesisVoice | null = null;
        public rate = 1;
        public pitch = 1;
        public onend: (() => void) | null = null;
        public onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }

      const speakMock = vi.fn((utterance: any) => {
        if (utterance.onend) utterance.onend();
      });
      const cancelMock = vi.fn();
      const mockVoice = { name: 'Lekha (ml-IN)', lang: 'ml-IN' } as SpeechSynthesisVoice;

      vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
      vi.stubGlobal('window', {
        SpeechSynthesisUtterance: MockUtterance,
        speechSynthesis: {
          speak: speakMock,
          cancel: cancelMock,
          getVoices: () => [mockVoice, { name: 'Samantha', lang: 'en-US' }],
          onvoiceschanged: null,
        },
      });

      const synth = speechSynth;
      synth.loadBestVoice();

      const malayalamSpeech = 'ഇന്നത്തെ പ്രധാന വിവരങ്ങൾ ഇതാ.';
      await synth.speak(malayalamSpeech, 'ml');

      expect(speakMock).toHaveBeenCalled();
      const utterance = speakMock.mock.calls[0][0];
      expect(utterance.lang).toBe('ml-IN');
      expect(utterance.voice?.lang).toBe('ml-IN');
    });
  });

  describe('12. Multi-Step Hybrid Workflow (Web Research -> Synthesis -> File Save)', () => {
    it('orchestrates web search, synthesizes output, and saves results to file', async () => {
      // 1. Search step
      const searchRes = await webSearchTool.execute(
        { query: 'GST Council Decisions', maxResults: 2, recencyFilter: 'recent' },
        { isDryRun: true, killSwitchActive: () => false }
      );
      expect(searchRes.success).toBe(true);

      // 2. Synthesis step
      const answer = await answerGenerator.generate('GST Council Decisions', searchRes.data!.results, 'en');
      expect(answer.directAnswer).toBeDefined();

      // 3. File workflow step: save to file
      const saveRes = await fileWorkflowTool.execute(
        {
          action: 'save_research_summary',
          filePath: '/Users/test/Documents/GST_Report.md',
          content: answer.detailedMarkdown,
        },
        { isDryRun: true, killSwitchActive: () => false }
      );

      expect(saveRes.status).toBe('SUCCESS');
      expect(saveRes.success).toBe(true);
      expect(saveRes.data?.bytesWritten).toBeGreaterThan(0);
    });
  });

  describe('Google Browser Research Execution', () => {
    it('opens browser search and observes page title and accessible nodes', async () => {
      vi.spyOn(nativeBridge, 'openUrl').mockResolvedValue({
        success: true,
        url: 'https://www.google.com/search?q=GST',
        browser: 'Safari',
        message: 'Opened Safari',
      });

      vi.spyOn(nativeBridge, 'getComputerState').mockResolvedValue({
        activeApp: 'Safari',
        activeWindow: 'GST - Google Search',
        runningApps: ['Safari'],
        volume: 50,
        isMuted: false,
      });

      vi.spyOn(nativeBridge, 'getUiTree').mockResolvedValue({
        appName: 'Safari',
        windowTitle: 'GST - Google Search',
        elements: [
          {
            id: 'e1',
            role: 'HEADING',
            title: 'GST Rate Revisions for Electronics and Services Announced',
            enabled: true,
            focused: false,
            x: 100,
            y: 200,
            width: 400,
            height: 30,
          },
        ],
        totalCount: 1,
      });

      const res = await browserResearchTool.execute(
        { query: 'GST changes', browser: 'Safari', searchEngine: 'google' },
        { killSwitchActive: () => false }
      );

      expect(res.status).toBe('SUCCESS');
      expect(res.success).toBe(true);
      expect(res.data?.browser).toBe('Safari');
      expect(res.data?.windowTitle).toContain('GST');
      expect(res.data?.extractedSnippet).toContain('GST Rate Revisions');

      const verifyRes = await browserResearchTool.verify(
        { query: 'GST changes', browser: 'Safari', searchEngine: 'google' },
        res
      );
      expect(verifyRes.verified).toBe(true);
    });
  });
});
