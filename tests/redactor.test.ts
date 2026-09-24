import { describe, it, expect } from 'vitest';
import { redactSensitiveData, sanitizeObject } from '../src/core/redactor';

describe('Sensitive Data Redaction Engine', () => {
  it('redacts GitHub personal access tokens', () => {
    const raw = 'My token is ghp_1234567890abcdefghijklmnopqrstuvwxyzAB and should be secret';
    const { redactedText, hasRedactions } = redactSensitiveData(raw);

    expect(hasRedactions).toBe(true);
    expect(redactedText).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyzAB');
    expect(redactedText).toContain('[REDACTED_SECRET]');
  });

  it('redacts AWS Access Keys', () => {
    const raw = 'AWS_KEY=AKIAIOSFODNN7EXAMPLE';
    const { redactedText, hasRedactions } = redactSensitiveData(raw);

    expect(hasRedactions).toBe(true);
    expect(redactedText).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(redactedText).toContain('[REDACTED_SECRET]');
  });

  it('redacts Bearer tokens and generic API keys', () => {
    const raw = 'Authorization: Bearer supersecrettokenvalue123456789';
    const { redactedText, hasRedactions } = redactSensitiveData(raw);

    expect(hasRedactions).toBe(true);
    expect(redactedText).not.toContain('supersecrettokenvalue123456789');
  });

  it('redacts RSA private key blocks', () => {
    const raw = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y+u1234567890abcdef
-----END RSA PRIVATE KEY-----`;
    const { redactedText, hasRedactions } = redactSensitiveData(raw);

    expect(hasRedactions).toBe(true);
    expect(redactedText).toContain('[REDACTED_PRIVATE_KEY]');
  });

  it('recursively sanitizes sensitive object properties', () => {
    const obj = {
      user: 'anoop',
      apiKey: 'secret_key_12345',
      settings: {
        password: 'mySuperPassword!',
        theme: 'dark'
      }
    };

    const sanitized = sanitizeObject(obj);
    expect(sanitized.apiKey).toBe('[REDACTED_CREDENTIAL]');
    expect(sanitized.settings.password).toBe('[REDACTED_CREDENTIAL]');
    expect(sanitized.settings.theme).toBe('dark');
  });
});
