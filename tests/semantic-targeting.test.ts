import { describe, it, expect } from 'vitest';
import { semanticTargetResolver } from '../src/core/semantic-targeting';
import { UiTreeResult } from '../src/adapters/native/tauri-bridge';

describe('Phase 2D: Semantic UI Targeting', () => {
  const mockTree: UiTreeResult = {
    appName: 'Safari',
    windowTitle: 'Google Search - Kerala News',
    elements: [
      {
        id: 'el_btn_send',
        role: 'BUTTON',
        title: 'Send',
        description: 'Send message to recipient',
        x: 450,
        y: 600,
        width: 100,
        height: 36,
        enabled: true,
        focused: false,
      },
      {
        id: 'el_btn_cancel',
        role: 'BUTTON',
        title: 'Cancel',
        description: 'Discard and close',
        x: 320,
        y: 600,
        width: 90,
        height: 36,
        enabled: true,
        focused: false,
      },
      {
        id: 'el_tf_search',
        role: 'TEXTFIELD',
        title: 'Search',
        description: 'Address and Search Bar',
        value: 'https://www.google.com',
        x: 200,
        y: 72,
        width: 600,
        height: 30,
        enabled: true,
        focused: true,
      },
      {
        id: 'el_link_first',
        role: 'LINK',
        title: 'Kerala Health Services Official Portal',
        description: 'Government medical updates',
        x: 220,
        y: 240,
        width: 400,
        height: 24,
        enabled: true,
        focused: false,
      },
    ],
    totalCount: 4,
  };

  it('resolves exact button title and computes center coordinates', () => {
    const resolved = semanticTargetResolver.resolve('Send', mockTree);
    expect(resolved).not.toBeNull();
    expect(resolved?.element.title).toBe('Send');
    expect(resolved?.confidence).toBe(1.0);
    // x = 450 + 50 = 500, y = 600 + 18 = 618
    expect(resolved?.clickX).toBe(500);
    expect(resolved?.clickY).toBe(618);
  });

  it('resolves role-specified query "the send button"', () => {
    const resolved = semanticTargetResolver.resolve('the send button', mockTree);
    expect(resolved).not.toBeNull();
    expect(resolved?.element.id).toBe('el_btn_send');
    expect(resolved?.element.role).toBe('BUTTON');
  });

  it('resolves browser address / search field heuristic', () => {
    const resolved = semanticTargetResolver.resolve('address bar', mockTree);
    expect(resolved).not.toBeNull();
    expect(resolved?.element.role).toBe('TEXTFIELD');
    expect(resolved?.element.id).toBe('el_tf_search');
  });

  it('resolves link element by partial text match', () => {
    const resolved = semanticTargetResolver.resolve('Kerala Health', mockTree);
    expect(resolved).not.toBeNull();
    expect(resolved?.element.role).toBe('LINK');
    expect(resolved?.element.title).toContain('Kerala Health');
  });

  it('safely returns null when no matching UI element exists', () => {
    const resolved = semanticTargetResolver.resolve('NonExistentButtonXYZ', mockTree);
    expect(resolved).toBeNull();
  });

  it('handles empty UI trees gracefully', () => {
    const emptyTree: UiTreeResult = { appName: 'Unknown', windowTitle: '', elements: [], totalCount: 0 };
    const resolved = semanticTargetResolver.resolve('Submit', emptyTree);
    expect(resolved).toBeNull();
  });
});
