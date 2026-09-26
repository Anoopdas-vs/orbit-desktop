/**
 * Text-to-Speech (TTS) Engine for Janki Voice Assistant
 * Speaks responses aloud using macOS Web Speech Synthesis API.
 * Configured with young Indian female voice profile (en-IN / ml-IN) and immediate barge-in.
 */

export class SpeechSynthesisEngine {
  private isMuted = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private isSpeakingNow = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadBestVoice();
      };
      this.loadBestVoice();
    }
  }

  public loadBestVoice(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();

    // Priority order:
    // 1. Indian English / Malayalam female voice (Veena, Lekha, Sangeeta, Kalyani, etc. with en-IN or ml-IN)
    // 2. Any en-IN or ml-IN voice
    // 3. Natural macOS English voices (Samantha, Karen, Victoria, Siri)
    // 4. Any English voice
    const indianFemale = voices.find(
      (v) =>
        (v.lang === 'en-IN' || v.lang === 'ml-IN' || v.lang.startsWith('en-IN') || v.lang.startsWith('ml-IN')) &&
        (v.name.includes('Veena') ||
          v.name.includes('Lekha') ||
          v.name.includes('Sangeeta') ||
          v.name.includes('Kalyani') ||
          v.name.toLowerCase().includes('female'))
    );

    const anyIndian = voices.find((v) => v.lang.startsWith('en-IN') || v.lang.startsWith('ml-IN'));
    const preferredWestern = voices.find(
      (v) =>
        (v.name.includes('Samantha') ||
          v.name.includes('Karen') ||
          v.name.includes('Victoria') ||
          v.name.includes('Siri')) &&
        v.lang.startsWith('en')
    );

    this.selectedVoice =
      indianFemale || anyIndian || preferredWestern || voices.find((v) => v.lang.startsWith('en')) || null;
  }

  public getSelectedVoice(): SpeechSynthesisVoice | null {
    return this.selectedVoice;
  }

  public setSelectedVoice(voice: SpeechSynthesisVoice | null): void {
    this.selectedVoice = voice;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeakingNow = false;
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public isSpeaking(): boolean {
    return this.isSpeakingNow;
  }

  public speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel(); // Stop any currently speaking audio
      this.isSpeakingNow = true;

      const cleanText = text
        .replace(/\[.*?\]/g, '') // remove brackets
        .replace(/https?:\/\/\S+/g, 'link') // don't read full URLs
        .replace(/[*_#`]/g, '') // remove markdown symbols
        .trim();

      if (!cleanText) {
        this.isSpeakingNow = false;
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = 1.05; // slightly brisk and natural
      utterance.pitch = 1.08; // slightly higher pitch for young female tone

      utterance.onend = () => {
        this.isSpeakingNow = false;
        resolve();
      };
      utterance.onerror = () => {
        this.isSpeakingNow = false;
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Immediate barge-in interruption. Stops any active speech synthesis instantly.
   */
  public bargeIn(): void {
    this.stop();
  }

  public stop(): void {
    this.isSpeakingNow = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speechSynth = new SpeechSynthesisEngine();
export const speechSynthesisEngine = speechSynth;
