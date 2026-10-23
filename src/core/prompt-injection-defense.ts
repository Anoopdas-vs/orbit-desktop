/**
 * JANKI AI — PROMPT INJECTION DEFENSE & UNTRUSTED CONTENT SANITIZER (Phase 6)
 * 
 * Enforces the core invariant:
 * External web content, emails, document snippets, and OCR text are DATA, NOT AUTHORITY.
 * They must NEVER override user instructions, elevate permissions, or bypass confirmation gates.
 */

export interface ContentSanitizationResult {
  isSafe: boolean;
  sanitizedText: string;
  detectedSuspiciousPatterns: string[];
  riskWarning?: string;
}

const INJECTION_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  {
    pattern: /(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts|rules|commands)/i,
    description: 'Instruction override attempt ("ignore previous instructions")',
  },
  {
    pattern: /(?:system\s+prompt|developer\s+mode|jailbreak|dan\s+mode|unrestricted\s+mode)/i,
    description: 'System prompt extraction or mode evasion attempt',
  },
  {
    pattern: /(?:you\s+(?:are|must\s+act\s+as)\s+an?\s+unrestricted\s+ai|bypass\s+(?:all\s+)?safety\s+filters)/i,
    description: 'Safety filter bypass attempt',
  },
  {
    pattern: /(?:do\s+not\s+ask\s+for\s+confirmation|skip\s+confirmation|auto-approve|without\s+confirming)/i,
    description: 'Safety confirmation bypass attempt',
  },
  {
    pattern: /(?:send\s+email\s+to\s+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|delete\s+file|rm\s+-rf|format\s+drive|curl\s+https?:\/\/|wget\s+https?:\/\/)/i,
    description: 'Executable payload command hidden in untrusted content',
  },
  {
    pattern: /<\s*(?:script|iframe|object|embed)[^>]*>/i,
    description: 'HTML script/frame injection attempt',
  },
];

export class PromptInjectionDefense {
  /**
   * Inspect external content (scraped web text, incoming email, PDF/OCR text)
   * to detect prompt injection signatures and sanitize the content.
   */
  public analyzeAndSanitize(rawContent: string, sourceLabel: string = 'external_source'): ContentSanitizationResult {
    if (!rawContent || typeof rawContent !== 'string') {
      return {
        isSafe: true,
        sanitizedText: '',
        detectedSuspiciousPatterns: [],
      };
    }

    const detected: string[] = [];

    for (const item of INJECTION_PATTERNS) {
      if (item.pattern.test(rawContent)) {
        detected.push(item.description);
      }
    }

    // Wrap untrusted content in defensive markup boundaries so LLM adapters treat it as strictly external data
    const escaped = rawContent
      .replace(/<\/?(?:system|instruction|user_command|admin|developer)>/gi, '') // Strip fake system tags
      .trim();

    const fenced = `<untrusted_external_data source="${sourceLabel}" contains_potential_injection="${detected.length > 0}">\n${escaped}\n</untrusted_external_data>`;

    return {
      isSafe: detected.length === 0,
      sanitizedText: fenced,
      detectedSuspiciousPatterns: detected,
      riskWarning:
        detected.length > 0
          ? `Untrusted external content from "${sourceLabel}" contains ${detected.length} suspicious pattern(s). It has been quarantined as inert data.`
          : undefined,
    };
  }

  /**
   * Verify if a user prompt was manipulated by external content trying to issue commands on behalf of the user.
   */
  public isPromptHijacked(userPrompt: string, externalContext: string): boolean {
    if (!externalContext) return false;
    // Check if the user prompt is merely repeating a command injection found in the context
    for (const item of INJECTION_PATTERNS) {
      if (item.pattern.test(externalContext) && item.pattern.test(userPrompt)) {
        return true;
      }
    }
    return false;
  }
}

export const promptInjectionDefense = new PromptInjectionDefense();
