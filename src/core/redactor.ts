/**
 * Redactor module for Janki Assistant
 * Ensures API keys, tokens, .env contents, and passwords are never exposed
 * in logs, UI, or sent to an LLM.
 */

const SENSITIVE_PATTERNS = [
  // Generic API Keys & Secrets
  /(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|private[_-]?key|password|bearer)[\s:=]+['"]?([a-zA-Z0-9_\-.~+/=]{8,})['"]?/gi,
  // GitHub Personal Access Tokens (ghp_, gho_, etc.)
  /gh[pousr]_[A-Za-z0-9_]{36,255}/g,
  // AWS Access Key ID
  /AKIA[0-9A-Z]{16}/g,
  // Binance API Secret & Key patterns
  /(?:binance[_-]?(?:api[_-]?)?(?:key|secret))[\s:=]+['"]?([a-zA-Z0-9]{32,64})['"]?/gi,
  // Private Key blocks (RSA, EC, OPENSSH)
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  // Environment variable lines with secrets (e.g. DATABASE_URL=postgres://..., SECRET=...)
  /^[A-Z0-9_]*(?:SECRET|KEY|PASSWORD|TOKEN|DATABASE_URL|AUTH)[A-Z0-9_]*\s*=\s*(.+)$/gim,
  // Google / OAuth tokens (ya29., refresh tokens, client secrets)
  /ya29\.[a-zA-Z0-9_\-]{20,}/g,
  /(?:1\/\/[a-zA-Z0-9_\-]{40,})/g,
  /GOCSPX-[a-zA-Z0-9_\-]{28}/g,
];

export function redactSensitiveData(input: string): { redactedText: string; hasRedactions: boolean } {
  if (!input || typeof input !== 'string') {
    return { redactedText: input, hasRedactions: false };
  }

  let text = input;
  let hasRedactions = false;

  for (const pattern of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    const replaced = text.replace(pattern, (match, ...args) => {
      hasRedactions = true;
      if (match.includes('PRIVATE KEY')) {
        return '-----BEGIN PRIVATE KEY-----\n[REDACTED_PRIVATE_KEY]\n-----END PRIVATE KEY-----';
      }
      const p1 = typeof args[0] === 'string' ? args[0] : undefined;
      if (p1) {
        return match.replace(p1, '[REDACTED_SECRET]');
      }
      return '[REDACTED_SECRET]';
    });
    text = replaced;
    pattern.lastIndex = 0;
  }

  return { redactedText: text, hasRedactions };
}

export function sanitizeObject<T>(obj: T): T {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    return redactSensitiveData(obj).redactedText as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('key') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        lowerKey.includes('credential')
      ) {
        sanitized[key] = '[REDACTED_CREDENTIAL]';
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized as T;
  }
  return obj;
}
