/**
 * Cloud LLM Adapter Placeholders
 * IMPORTANT: No hardcoded keys! All credentials must be provisioned via macOS Keychain.
 */

export interface CloudLlmConfig {
  provider: 'openai' | 'anthropic' | 'none';
  model: string;
  hasKeychainKey: boolean;
}

export class CloudLlmAdapter {
  private config: CloudLlmConfig = {
    provider: 'none',
    model: 'claude-3-5-sonnet-20241022',
    hasKeychainKey: false,
  };

  public isConfigured(): boolean {
    return this.config.provider !== 'none' && this.config.hasKeychainKey;
  }

  public getProviderInfo(): CloudLlmConfig {
    return { ...this.config };
  }

  public async generatePlanProposal(_prompt: string): Promise<string | null> {
    if (!this.isConfigured()) {
      return null; // Fallback to local Ollama or rule engine
    }
    // Placeholder for Keychain-backed authenticated call
    return null;
  }
}

export const cloudLlmAdapter = new CloudLlmAdapter();
