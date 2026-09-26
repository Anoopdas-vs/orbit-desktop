import { describe, it, expect, beforeEach, vi } from 'vitest';
import { documentSkill } from '../src/skills/document/document-skill';
import { officeSkill } from '../src/skills/office/office-skill';
import { systemSkill } from '../src/skills/system/system-skill';
import { mediaSkill } from '../src/skills/media/media-skill';
import { skillRegistry } from '../src/skills/skill-registry';
import { killSwitch } from '../src/core/kill-switch';
import { nativeBridge } from '../src/adapters/native/tauri-bridge';

describe('Phase 3 Stage 3: Domain Automation Skills (Document, Office, System, Media)', () => {
  beforeEach(() => {
    killSwitch.disengage();
    vi.restoreAllMocks();
  });

  describe('DocumentSkill', () => {
    it('is registered in skillRegistry', () => {
      expect(documentSkill.id).toBe('document_skill');
      expect(skillRegistry.hasSkill('document_skill')).toBe(true);
    });

    it('reads document content and computes word count', async () => {
      vi.spyOn(nativeBridge, 'readFile').mockResolvedValue('Hello world from automated test file!');

      const result = await skillRegistry.dispatch('document_skill', {
        action: 'read_document',
        path: '/Users/user/Documents/sample.md',
      }, {
        sessionId: 'session-doc-1',
        riskTier: 'LOW',
      });

      expect(result.success).toBe(true);
      expect(result.data?.content).toBe('Hello world from automated test file!');
      expect(result.data?.wordCount).toBe(6);
    });

    it('creates document with content', async () => {
      const createSpy = vi.spyOn(nativeBridge, 'createFile').mockResolvedValue(true);

      const result = await skillRegistry.dispatch('document_skill', {
        action: 'create_document',
        path: '/Users/user/Documents/report.txt',
        content: 'Report data',
      }, {
        sessionId: 'session-doc-2',
        riskTier: 'LOW',
      });

      expect(result.success).toBe(true);
      expect(createSpy).toHaveBeenCalledWith('/Users/user/Documents/report.txt', 'Report data', false);
    });

    it('rejects document action on protected paths', async () => {
      const result = await skillRegistry.dispatch('document_skill', {
        action: 'read_document',
        path: '/System/Library/Secret.plist',
      }, {
        sessionId: 'session-doc-3',
        riskTier: 'LOW',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('strictly prohibited');
    });
  });

  describe('OfficeSkill', () => {
    it('is registered in skillRegistry', () => {
      expect(officeSkill.id).toBe('office_skill');
      expect(skillRegistry.hasSkill('office_skill')).toBe(true);
    });

    it('creates a reminder via AppleScript/osascript', async () => {
      const execSpy = vi.spyOn(nativeBridge, 'execCommand').mockResolvedValue({
        success: true,
        command: 'osascript',
        exitCode: 0,
        stdout: '',
        stderr: '',
      });

      const result = await skillRegistry.dispatch('office_skill', {
        action: 'create_reminder',
        title: 'Review quarterly automation report',
      }, {
        sessionId: 'session-office-1',
        riskTier: 'LOW',
      });

      expect(result.success).toBe(true);
      expect(result.data?.itemTitle).toBe('Review quarterly automation report');
      expect(execSpy).toHaveBeenCalled();
    });

    it('creates an Apple Note', async () => {
      const execSpy = vi.spyOn(nativeBridge, 'execCommand').mockResolvedValue({
        success: true,
        command: 'osascript',
        exitCode: 0,
        stdout: '',
        stderr: '',
      });

      const result = await skillRegistry.dispatch('office_skill', {
        action: 'create_note',
        title: 'Meeting Notes',
        body: 'Action item: deploy Janki AI Phase 3',
      }, {
        sessionId: 'session-office-2',
        riskTier: 'LOW',
      });

      expect(result.success).toBe(true);
      expect(result.data?.itemTitle).toBe('Meeting Notes');
      expect(execSpy).toHaveBeenCalled();
    });

    it('supports dry run for reminders', async () => {
      const execSpy = vi.spyOn(nativeBridge, 'execCommand');
      const dryResult = await officeSkill.dryRun({
        action: 'create_reminder',
        title: 'Dry run reminder',
      }, {
        sessionId: 'session-office-dry',
        riskTier: 'LOW',
        killSwitchActive: () => false,
      });

      expect(dryResult.success).toBe(true);
      expect(dryResult.message).toContain('DRY RUN');
      expect(execSpy).not.toHaveBeenCalled();
    });
  });

  describe('SystemSkill', () => {
    it('is registered in skillRegistry', () => {
      expect(systemSkill.id).toBe('system_skill');
      expect(skillRegistry.hasSkill('system_skill')).toBe(true);
    });

    it('sets audio volume', async () => {
      const controlSpy = vi.spyOn(nativeBridge, 'controlAction').mockResolvedValue({ success: true, action: 'set_volume' });

      const result = await skillRegistry.dispatch('system_skill', {
        action: 'set_volume',
        volumeLevel: 65,
      }, {
        sessionId: 'session-sys-1',
        riskTier: 'LOW',
      });

      expect(result.success).toBe(true);
      expect(controlSpy).toHaveBeenCalledWith({ action: 'set_volume', volumeLevel: 65 });
      expect(result.data?.data?.volume).toBe(65);
    });

    it('queries battery status', async () => {
      vi.spyOn(nativeBridge, 'execCommand').mockResolvedValue({
        success: true,
        command: 'pmset -g batt',
        exitCode: 0,
        stdout: "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=123) 85%; discharging",
        stderr: '',
      });

      const result = await skillRegistry.dispatch('system_skill', {
        action: 'get_battery_status',
      }, {
        sessionId: 'session-sys-2',
        riskTier: 'LOW',
      });

      expect(result.success).toBe(true);
      expect(result.data?.data?.batteryPercent).toBe(85);
      expect(result.data?.data?.charging).toBe(false);
    });

    it('queries Wi-Fi status', async () => {
      vi.spyOn(nativeBridge, 'execCommand').mockResolvedValue({
        success: true,
        command: 'networksetup',
        exitCode: 0,
        stdout: 'Wi-Fi Power (en0): On\nCurrent Wi-Fi Network: Janki_HQ_5G',
        stderr: '',
      });

      const result = await skillRegistry.dispatch('system_skill', {
        action: 'get_wifi_status',
      }, {
        sessionId: 'session-sys-3',
        riskTier: 'LOW',
      });

      expect(result.success).toBe(true);
      expect(result.data?.data?.connected).toBe(true);
      expect(result.data?.data?.ssid).toBe('Janki_HQ_5G');
    });
  });

  describe('MediaSkill', () => {
    it('is registered in skillRegistry', () => {
      expect(mediaSkill.id).toBe('media_skill');
      expect(skillRegistry.hasSkill('media_skill')).toBe(true);
    });

    it('controls play/pause playback', async () => {
      const scriptSpy = vi.spyOn(nativeBridge, 'executeAppleScript').mockResolvedValue('ok');

      const result = await skillRegistry.dispatch('media_skill', {
        action: 'play_pause',
        appName: 'Spotify',
      }, {
        sessionId: 'session-media-1',
        riskTier: 'LOW',
      });

      expect(result.success).toBe(true);
      expect(result.data?.message).toContain('Toggled playback for Spotify');
      expect(scriptSpy).toHaveBeenCalled();
    });

    it('plays search query on YouTube via browser/URL', async () => {
      const openSpy = vi.spyOn(nativeBridge, 'openUrl').mockResolvedValue({
        success: true,
        url: 'https://www.youtube.com/results?search_query=Malayalam%20chill%20songs',
        browser: 'default',
        message: 'Opened YouTube',
      });

      const result = await skillRegistry.dispatch('media_skill', {
        action: 'play_youtube',
        query: 'Malayalam chill songs',
      }, {
        sessionId: 'session-media-2',
        riskTier: 'LOW',
      });

      expect(result.success).toBe(true);
      expect(openSpy).toHaveBeenCalledWith(
        'https://www.youtube.com/results?search_query=Malayalam%20chill%20songs'
      );
    });

    it('adjusts media volume', async () => {
      const controlSpy = vi.spyOn(nativeBridge, 'controlAction').mockResolvedValue({ success: true, action: 'set_volume' });

      const result = await skillRegistry.dispatch('media_skill', {
        action: 'set_volume',
        volumeLevel: 75,
      }, {
        sessionId: 'session-media-3',
        riskTier: 'LOW',
      });

      expect(result.success).toBe(true);
      expect(controlSpy).toHaveBeenCalledWith({ action: 'set_volume', volumeLevel: 75 });
    });
  });
});
