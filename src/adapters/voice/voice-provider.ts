export interface TranscriptionResult {
  text: string;
  confidence: number;
  durationMs: number;
  provider: 'web-speech' | 'whisper-cpp' | 'mock';
  error?: string;
}

export interface VoiceProvider {
  id: string;
  name: string;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<TranscriptionResult>;
  isRecording: () => boolean;
  onVolumeChange?: (callback: (volume: number) => void) => void;
  onTranscriptChange?: (callback: (text: string) => void) => void;
}

export class MockVoiceProvider implements VoiceProvider {
  public id = 'mock';
  public name = 'Mock Voice Provider';
  private recording = false;
  private startTime = 0;
  private mockPhrase = 'Hey Janki, open youtube and play some music';

  public setMockPhrase(phrase: string): void {
    this.mockPhrase = phrase;
  }

  public async startRecording(): Promise<void> {
    this.recording = true;
    this.startTime = performance.now();
  }

  public async stopRecording(): Promise<TranscriptionResult> {
    this.recording = false;
    const duration = performance.now() - this.startTime;
    return {
      text: this.mockPhrase,
      confidence: 0.98,
      durationMs: duration,
      provider: 'mock',
    };
  }

  public isRecording(): boolean {
    return this.recording;
  }
}

export class WebAudioVoiceProvider implements VoiceProvider {
  public id = 'web-speech';
  public name = 'macOS Web Speech / Microphone Engine';
  private recording = false;
  private startTime = 0;
  private recognition: any = null;
  private transcribedText = '';
  private lastError: string | null = null;
  private volumeCallback: ((vol: number) => void) | null = null;
  private transcriptCallback: ((text: string) => void) | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;

  public onVolumeChange(callback: (volume: number) => void): void {
    this.volumeCallback = callback;
  }

  public onTranscriptChange(callback: (text: string) => void): void {
    this.transcriptCallback = callback;
  }

  public async startRecording(): Promise<void> {
    this.recording = true;
    this.transcribedText = '';
    this.lastError = null;
    this.startTime = performance.now();

    // 1. Initialize Web Audio analyser for live VU meter
    if (typeof window !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
          const source = this.audioContext.createMediaStreamSource(this.mediaStream);
          const analyser = this.audioContext.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (!this.recording) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            if (this.volumeCallback) {
              this.volumeCallback(Math.min(100, Math.round((average / 128) * 100)));
            }
            requestAnimationFrame(updateVolume);
          };
          requestAnimationFrame(updateVolume);
        }
      } catch (err: any) {
        console.warn('Microphone stream error:', err);
        this.lastError = 'Microphone permission not granted';
      }
    }

    // 2. Always create a FRESH SpeechRecognition instance on every recording start
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        try {
          if (this.recognition) {
            try {
              this.recognition.abort();
            } catch {}
          }

          this.recognition = new SpeechRecognition();
          this.recognition.continuous = true;
          this.recognition.interimResults = true;
          this.recognition.lang = 'en-US';

          this.recognition.onresult = (event: any) => {
            let fullText = '';
            for (let i = 0; i < event.results.length; i++) {
              fullText += event.results[i][0].transcript;
            }
            this.transcribedText = fullText.trim();
            if (this.transcriptCallback) {
              this.transcriptCallback(this.transcribedText);
            }
          };

          this.recognition.onerror = (event: any) => {
            console.warn('SpeechRecognition error:', event.error);
            if (event.error !== 'no-speech') {
              this.lastError = event.error;
            }
          };

          this.recognition.start();
        } catch (err) {
          console.warn('Failed to start SpeechRecognition:', err);
        }
      } else {
        this.lastError = 'SpeechRecognition API not available';
      }
    }
  }

  public async stopRecording(): Promise<TranscriptionResult> {
    this.recording = false;
    const duration = performance.now() - this.startTime;

    // Gracefully await any pending recognition results before closing
    if (this.recognition) {
      await new Promise<void>((resolve) => {
        let resolved = false;
        const finish = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };

        const timer = setTimeout(finish, 400);

        try {
          this.recognition.onend = () => {
            clearTimeout(timer);
            finish();
          };
          this.recognition.stop();
        } catch {
          clearTimeout(timer);
          finish();
        }
      });
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    // Return the actual spoken text - NEVER fallback to arbitrary command!
    const finalResult = this.transcribedText.trim();

    return {
      text: finalResult,
      confidence: finalResult ? 0.95 : 0,
      durationMs: duration,
      provider: 'web-speech',
      error: this.lastError || undefined,
    };
  }

  public isRecording(): boolean {
    return this.recording;
  }
}
