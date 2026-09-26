import { describe, it, expect, beforeEach, vi } from 'vitest';
import { phoneticPreprocessor } from '../src/adapters/voice/phonetic-preprocessor';
import { voiceAnnouncer } from '../src/adapters/voice/voice-announcer';
import { speechSynthesisEngine } from '../src/adapters/voice/speech-synthesis';

describe('Phase 3 Stage 4: Voice Experience & Phonetic Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    voiceAnnouncer.setEnabled(true);
    voiceAnnouncer.bargeIn();
  });

  describe('Phonetic Preprocessor', () => {
    it('strips deep URLs into conversational webpage descriptions', () => {
      const input = 'Navigating to https://github.com/microsoft/vscode/issues/123 to check status';
      const cleaned = phoneticPreprocessor.cleanForSpeech(input);
      expect(cleaned).not.toContain('https://');
      expect(cleaned).toContain('the github.com webpage');
    });

    it('strips long technical UUIDs/GUIDs from speech text', () => {
      const input = 'Created task with ID 8d6c8271-b6b3-4290-94aa-85d65d26ae9b successfully';
      const cleaned = phoneticPreprocessor.cleanForSpeech(input);
      expect(cleaned).not.toContain('8d6c8271');
      expect(cleaned).toContain('Created task with ID item successfully');
    });

    it('strips deep UNIX file paths to file basenames', () => {
      const input = 'Reading /Users/anoopdasvs/Downloads/automation_report.pdf';
      const cleaned = phoneticPreprocessor.cleanForSpeech(input);
      expect(cleaned).not.toContain('/Users/anoopdasvs/Downloads/');
      expect(cleaned).toContain('Reading automation_report.pdf');
    });

    it('normalizes colloquial Manglish phrases for natural pronunciation', () => {
      const input = 'Safari close aakku and paatu vekk';
      const cleaned = phoneticPreprocessor.cleanForSpeech(input);
      expect(cleaned).toContain('adakkunnu');
      expect(cleaned).toContain('paattu play cheyyunnu');
    });

    it('detects language scripts accurately', () => {
      expect(phoneticPreprocessor.detectScript('Open Safari please')).toBe('en');
      expect(phoneticPreprocessor.detectScript('സഫാരി തുറക്കുക')).toBe('ml');
      expect(phoneticPreprocessor.detectScript('Safari തുറക്കൂ')).toBe('mixed');
    });
  });

  describe('Voice Announcer & Throttling', () => {
    it('announces message and throttles subsequent rapid calls within 1500ms', async () => {
      const speakSpy = vi.spyOn(speechSynthesisEngine, 'speak').mockResolvedValue(undefined);

      // First announcement passes
      const first = await voiceAnnouncer.announce('Starting file search');
      expect(first).toBe(true);
      expect(speakSpy).toHaveBeenCalledTimes(1);

      // Rapid second announcement within 10ms is throttled (returns false)
      const second = await voiceAnnouncer.announce('Found 3 files');
      expect(second).toBe(false);
      expect(speakSpy).toHaveBeenCalledTimes(1);
    });

    it('allows urgent priority announcements to bypass the 1500ms throttle', async () => {
      const speakSpy = vi.spyOn(speechSynthesisEngine, 'speak').mockResolvedValue(undefined);

      await voiceAnnouncer.announce('Normal step 1');
      expect(speakSpy).toHaveBeenCalledTimes(1);

      // Urgent announcement bypasses throttle
      const urgent = await voiceAnnouncer.announce('Emergency stop activated!', { priority: 'urgent' });
      expect(urgent).toBe(true);
      expect(speakSpy).toHaveBeenCalledTimes(2);
    });

    it('supports immediate barge-in interruption', () => {
      const stopSpy = vi.spyOn(speechSynthesisEngine, 'stop');
      voiceAnnouncer.bargeIn();
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('Indian Female Voice Profile Configuration', () => {
    it('prefers en-IN or ml-IN voices when available', () => {
      // Mock SpeechSynthesis voices list
      const mockVoices = [
        { name: 'Alex', lang: 'en-US' },
        { name: 'Veena', lang: 'en-IN' },
        { name: 'Samantha', lang: 'en-US' },
      ] as SpeechSynthesisVoice[];

      // Mock window.speechSynthesis
      const originalWindow = global.window;
      (global as any).window = {
        speechSynthesis: {
          getVoices: () => mockVoices,
          speak: vi.fn(),
          cancel: vi.fn(),
        },
      };

      speechSynthesisEngine.loadBestVoice();
      const selected = speechSynthesisEngine.getSelectedVoice();
      expect(selected?.name).toBe('Veena');
      expect(selected?.lang).toBe('en-IN');

      // Cleanup
      (global as any).window = originalWindow;
    });
  });
});
