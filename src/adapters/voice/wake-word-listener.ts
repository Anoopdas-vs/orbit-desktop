/**
 * Wake Word Listener for "Hey Janki" / "Janki" / "Hei Janki"
 * Continuous background listening using the Web Speech Recognition API.
 */

export interface WakeWordEvent {
  wakeWord: string;
  hasTrailingCommand: boolean;
  trailingCommand?: string;
  rawTranscript: string;
}

export class WakeWordListener {
  private isListening = false;
  private isEnabled = true;
  private recognition: any = null;
  private onWakeCallback: ((event: WakeWordEvent) => void) | null = null;
  private onStatusChangeCallback: ((active: boolean) => void) | null = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition(): void {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not available in this environment');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        this.processTranscript(transcript);
      }
    };

    this.recognition.onend = () => {
      // If still enabled, auto-restart continuous listening
      if (this.isEnabled && this.isListening) {
        try {
          this.recognition.start();
        } catch {
          // Ignore if already active
        }
      }
    };

    this.recognition.onerror = (err: any) => {
      if (err.error === 'not-allowed') {
        console.warn('Microphone permission denied for wake word detection');
        this.stop();
      }
    };
  }

  public processTranscript(transcript: string): WakeWordEvent | null {
    const wakeWordPattern = /(?:hei|hey|hi|hello)?\s*\bjanki\b/i;
    const match = transcript.match(wakeWordPattern);

    if (!match) return null;

    const wakeIndex = match.index ?? 0;
    const afterWake = transcript.slice(wakeIndex + match[0].length).trim();
    // Clean leading punctuation or "please"
    const cleanedCommand = afterWake.replace(/^[,:.\- ]+/, '').replace(/^please\s+/i, '').trim();

    const event: WakeWordEvent = {
      wakeWord: match[0].trim(),
      hasTrailingCommand: cleanedCommand.length > 0,
      trailingCommand: cleanedCommand.length > 0 ? cleanedCommand : undefined,
      rawTranscript: transcript,
    };

    if (this.onWakeCallback) {
      this.onWakeCallback(event);
    }

    return event;
  }

  public onWake(callback: (event: WakeWordEvent) => void): void {
    this.onWakeCallback = callback;
  }

  public onStatusChange(callback: (active: boolean) => void): void {
    this.onStatusChangeCallback = callback;
  }

  public start(): void {
    this.isEnabled = true;
    if (!this.recognition || this.isListening) return;

    try {
      this.recognition.start();
      this.isListening = true;
      if (this.onStatusChangeCallback) this.onStatusChangeCallback(true);
    } catch (err) {
      console.warn('Could not start wake word listener:', err);
    }
  }

  public stop(): void {
    this.isEnabled = false;
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop error
      }
    }
    if (this.onStatusChangeCallback) this.onStatusChangeCallback(false);
  }

  public getIsActive(): boolean {
    return this.isListening;
  }
}

export const wakeWordListener = new WakeWordListener();
