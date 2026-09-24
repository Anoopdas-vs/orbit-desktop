import { describe, it, expect } from 'vitest';
import { WakeWordListener } from '../src/adapters/voice/wake-word-listener';

describe('Wake Word Listener ("Hey Janki" / "Janki")', () => {
  const listener = new WakeWordListener();

  it('detects "hey janki" with immediate trailing command', () => {
    const res = listener.processTranscript('hey janki open youtube and play some music');
    expect(res).not.toBeNull();
    expect(res?.wakeWord.toLowerCase()).toBe('hey janki');
    expect(res?.hasTrailingCommand).toBe(true);
    expect(res?.trailingCommand).toBe('open youtube and play some music');
  });

  it('detects alternative spelling "hei janki"', () => {
    const res = listener.processTranscript('hei janki run tests');
    expect(res).not.toBeNull();
    expect(res?.wakeWord.toLowerCase()).toBe('hei janki');
    expect(res?.trailingCommand).toBe('run tests');
  });

  it('detects standalone "janki"', () => {
    const res = listener.processTranscript('janki');
    expect(res).not.toBeNull();
    expect(res?.wakeWord.toLowerCase()).toBe('janki');
    expect(res?.hasTrailingCommand).toBe(false);
  });

  it('detects "janki" with colon or comma separation', () => {
    const res = listener.processTranscript('Janki, start the dev server');
    expect(res).not.toBeNull();
    expect(res?.trailingCommand).toBe('start the dev server');
  });

  it('ignores transcripts that do not include the wake word', () => {
    const res = listener.processTranscript('hello assistant how is the weather');
    expect(res).toBeNull();
  });
});
