/**
 * Text-to-Speech (TTS) Engine for Janki Voice Assistant
 * Speaks responses aloud using macOS Web Speech Synthesis API.
 */

class SpeechSynthesisEngine {
  private isMuted = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadBestVoice();
      };
      this.loadBestVoice();
    }
  }

  private loadBestVoice(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    // Prefer natural macOS English voices like Samantha, Karen, Daniel, or Victoria
    const preferred = voices.find(
      (v) =>
        (v.name.includes('Samantha') ||
          v.name.includes('Karen') ||
          v.name.includes('Daniel') ||
          v.name.includes('Victoria') ||
          v.name.includes('Siri')) &&
        v.lang.startsWith('en')
    );
    this.selectedVoice = preferred || voices.find((v) => v.lang.startsWith('en')) || null;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel(); // Stop any currently speaking audio

      const cleanText = text
        .replace(/\[.*?\]/g, '') // remove brackets
        .replace(/https?:\/\/\S+/g, 'link') // don't read full URLs
        .replace(/[*_#`]/g, '') // remove markdown symbols
        .trim();

      if (!cleanText) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = 1.05; // slightly brisk and natural
      utterance.pitch = 1.0;

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  }

  public stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speechSynth = new SpeechSynthesisEngine();
