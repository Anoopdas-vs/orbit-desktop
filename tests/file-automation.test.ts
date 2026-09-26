import { describe, it, expect, beforeEach, vi } from 'vitest';
import { filesSkill, validateSafeFilePath } from '../src/skills/files/files-skill';
import { skillRegistry } from '../src/skills/skill-registry';
import { killSwitch } from '../src/core/kill-switch';
import { nativeBridge } from '../src/adapters/native/tauri-bridge';

describe('Phase 3 Stage 3: Filesystem Automation Skill & Safety Protections', () => {
  beforeEach(() => {
    killSwitch.disengage();
    vi.restoreAllMocks();
  });

  describe('Path Protection Policy (validateSafeFilePath)', () => {
    it('allows safe user paths in Documents or Downloads', () => {
      expect(validateSafeFilePath('/Users/user/Documents/report.txt').isSafe).toBe(true);
      expect(validateSafeFilePath('/Users/user/Downloads/invoice.pdf').isSafe).toBe(true);
      expect(validateSafeFilePath('/Users/user/Desktop/notes.md').isSafe).toBe(true);
    });

    it('rejects directory traversal attempts with double-dot (..)', () => {
      const res = validateSafeFilePath('/Users/user/Documents/../../etc/passwd');
      expect(res.isSafe).toBe(false);
      expect(res.reason).toContain('Directory traversal');
    });

    it('blocks access to macOS system directories', () => {
      expect(validateSafeFilePath('/System/Library/CoreServices').isSafe).toBe(false);
      expect(validateSafeFilePath('/Library/Preferences').isSafe).toBe(false);
      expect(validateSafeFilePath('/usr/bin/python').isSafe).toBe(false);
      expect(validateSafeFilePath('/bin/sh').isSafe).toBe(false);
      expect(validateSafeFilePath('/etc/hosts').isSafe).toBe(false);
    });

    it('blocks access to sensitive credentials and configuration files', () => {
      expect(validateSafeFilePath('/Users/user/.ssh/id_rsa').isSafe).toBe(false);
      expect(validateSafeFilePath('/Users/user/project/.env').isSafe).toBe(false);
      expect(validateSafeFilePath('/Users/user/project/.env.local').isSafe).toBe(false);
      expect(validateSafeFilePath('/Users/user/.git/config').isSafe).toBe(false);
      expect(validateSafeFilePath('/Users/user/.aws/credentials').isSafe).toBe(false);
      expect(validateSafeFilePath('/Users/user/.zshrc').isSafe).toBe(false);
    });
  });

  describe('FilesSkill Execution', () => {
    it('registers correctly in skill registry', () => {
      expect(filesSkill.id).toBe('files_skill');
      expect(skillRegistry.hasSkill('files_skill')).toBe(true);
      expect(filesSkill.riskLevel).toBe('MEDIUM');
    });

    it('retrieves file metadata safely', async () => {
      vi.spyOn(nativeBridge, 'getFileMetadata').mockResolvedValue({
        path: '/Users/user/Documents/sample.txt',
        name: 'sample.txt',
        is_dir: false,
        size_bytes: 1024,
        extension: 'txt',
        is_protected: false,
        modified_timestamp: 1700000000,
      });

      const result = await skillRegistry.dispatch('files_skill', {
        action: 'get_metadata',
        path: '/Users/user/Documents/sample.txt',
      }, {
        sessionId: 'session-file-1',
        riskTier: 'MEDIUM',
      });

      expect(result.success).toBe(true);
      expect(result.data?.metadata?.name).toBe('sample.txt');
      expect(result.data?.metadata?.size_bytes).toBe(1024);
    });

    it('creates file within safe directories', async () => {
      const createSpy = vi.spyOn(nativeBridge, 'createFile').mockResolvedValue(true);

      const result = await skillRegistry.dispatch('files_skill', {
        action: 'create_file',
        path: '/Users/user/Documents/output.txt',
        content: 'Automation results content',
      }, {
        sessionId: 'session-file-2',
        riskTier: 'MEDIUM',
      });

      expect(result.success).toBe(true);
      expect(createSpy).toHaveBeenCalledWith('/Users/user/Documents/output.txt', 'Automation results content', false);
    });

    it('rejects creation targeting protected paths', async () => {
      const result = await skillRegistry.dispatch('files_skill', {
        action: 'create_file',
        path: '/System/malicious.sh',
        content: 'test',
      }, {
        sessionId: 'session-file-3',
        riskTier: 'HIGH',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('strictly prohibited');
    });

    it('moves file to Trash without executing permanent rm', async () => {
      const trashSpy = vi.spyOn(nativeBridge, 'moveToTrash').mockResolvedValue(true);

      const result = await skillRegistry.dispatch('files_skill', {
        action: 'move_to_trash',
        path: '/Users/user/Downloads/old_temp.pdf',
      }, {
        sessionId: 'session-file-4',
        riskTier: 'HIGH',
      });

      expect(result.success).toBe(true);
      expect(trashSpy).toHaveBeenCalledWith('/Users/user/Downloads/old_temp.pdf');
      expect(result.message).toContain('Moved to Trash');
    });

    it('aborts filesystem operations if kill switch is engaged', async () => {
      killSwitch.engage('Filesystem emergency', 'user-ui');

      const result = await skillRegistry.dispatch('files_skill', {
        action: 'move_to_trash',
        path: '/Users/user/Downloads/test.txt',
      }, {
        sessionId: 'session-file-5',
        riskTier: 'HIGH',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Emergency Kill Switch');
    });
  });
});
