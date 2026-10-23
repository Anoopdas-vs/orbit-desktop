import { describe, it, expect, beforeEach, vi } from 'vitest';
import { voiceAnnouncer } from '../src/adapters/voice/voice-announcer';
import { wakeWordListener } from '../src/adapters/voice/wake-word-listener';
import { speechSynthesisEngine } from '../src/adapters/voice/speech-synthesis';
import { languageEngine } from '../src/core/language-engine';

describe('Phase 6: Voice-First Multilingual Experience & Progress Updates', () => {
  beforeEach(() => {
    // Polyfill SpeechSynthesis on globalThis for test execution
    if (typeof (globalThis as any).SpeechSynthesisUtterance === 'undefined') {
      (globalThis as any).SpeechSynthesisUtterance = class {
        text: string;
        lang: string = 'en-US';
        voice: any = null;
        rate: number = 1.0;
        pitch: number = 1.0;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      };
    }

    if (typeof (globalThis as any).speechSynthesis === 'undefined') {
      (globalThis as any).speechSynthesis = {
        speak: (utterance: any) => {
          setTimeout(() => {
            if (utterance.onend) utterance.onend();
          }, 5);
        },
        cancel: vi.fn(),
        getVoices: () => [
          { name: 'Lekha', lang: 'ml-IN' },
          { name: 'Samantha', lang: 'en-US' },
        ],
      };
    }
  });

  it('detects English vs Malayalam intents and selects appropriate voice language', () => {
    const enQuery = 'What is the latest status of GST revisions?';
    const mlQuery = 'ജിഎസ്ടി സംബന്ധിച്ച പുതിയ അറിയിപ്പുകൾ എന്തൊക്കെയാണ്?';

    const langEn = languageEngine.determineResponseLanguage(enQuery);
    const langMl = languageEngine.determineResponseLanguage(mlQuery);

    expect(langEn).toBe('en');
    expect(langMl).toBe('ml');
  });

  it('announces long-task progress steps naturally in English and Malayalam', async () => {
    const announceSpy = vi.spyOn(voiceAnnouncer, 'announce').mockResolvedValue(true);

    // English progress updates
    await voiceAnnouncer.announceProgress('searching', 'en');
    expect(announceSpy).toHaveBeenCalledWith('Searching...', expect.any(Object));

    await voiceAnnouncer.announceProgress('analyzing', 'en');
    expect(announceSpy).toHaveBeenCalledWith('Analyzing visible content...', expect.any(Object));

    // Malayalam progress updates
    await voiceAnnouncer.announceProgress('searching', 'ml');
    expect(announceSpy).toHaveBeenCalledWith('തിരയുന്നു...', expect.any(Object));

    await voiceAnnouncer.announceProgress('done', 'ml');
    expect(announceSpy).toHaveBeenCalledWith('പൂർത്തിയായി.', expect.any(Object));

    announceSpy.mockRestore();
  });

  it('supports instant voice interrupt (barge-in) and task cancellation', () => {
    const cancelSpy = vi.spyOn(speechSynthesisEngine, 'stop');

    // User interrupts or says "Hey Janki" while assistant is speaking
    wakeWordListener.interrupt();

    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });
});
