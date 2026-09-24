import { redactSensitiveData } from '../../core/redactor';

export interface OllamaModelInfo {
  name: string;
  modified_at: string;
  size: number;
}

export class OllamaAdapter {
  private baseUrl: string;
  private defaultModel: string;

  constructor(baseUrl = 'http://localhost:11434', defaultModel = 'llama3.2:latest') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultModel = defaultModel;
  }

  public async checkHealth(): Promise<{ available: boolean; models: string[]; error?: string }> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return { available: false, models: [], error: `Ollama returned HTTP ${response.status}` };
      }

      const data = await response.json();
      const models = (data.models || []).map((m: OllamaModelInfo) => m.name);
      return { available: true, models };
    } catch (err: any) {
      return {
        available: false,
        models: [],
        error: err.name === 'AbortError' ? 'Ollama connection timed out (is Ollama running?)' : err.message
      };
    }
  }

  public async generatePlanPrompt(userPrompt: string, systemContext: string): Promise<string | null> {
    const sanitizedPrompt = redactSensitiveData(userPrompt).redactedText;
    const sanitizedContext = redactSensitiveData(systemContext).redactedText;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.defaultModel,
          prompt: `System: ${sanitizedContext}\nUser Request: ${sanitizedPrompt}`,
          stream: false,
          format: 'json',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.response;
    } catch {
      // Return null to gracefully fallback to deterministic rule router
      return null;
    }
  }
}

export const defaultOllamaAdapter = new OllamaAdapter();
