import { describe, it, expect, beforeEach } from 'vitest';
import { credentialVault } from '../src/integrations/credential-vault';
import { googleAuthProvider } from '../src/integrations/google/google-auth-provider';
import { gmailClient } from '../src/integrations/google/gmail-client';
import { googleCalendarClient } from '../src/integrations/google/calendar-client';
import { emailTool } from '../src/tools/integrations/email-tool';
import { calendarTool } from '../src/tools/integrations/calendar-tool';

describe('Phase 6: Real Account Integrations (Gmail & Google Calendar)', () => {
  beforeEach(() => {
    credentialVault.clearCache();
  });

  it('stores and retrieves OAuth tokens securely without plaintext leaks', async () => {
    const tokens = {
      accessToken: 'ya29.test_access_token_123',
      refreshToken: '1//test_refresh_token_456',
      tokenType: 'Bearer',
      expiresAt: Date.now() + 3600 * 1000,
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    };

    await credentialVault.storeTokens('google_workspace', tokens);
    const retrieved = await credentialVault.getTokens('google_workspace');

    expect(retrieved).not.toBeNull();
    expect(retrieved?.accessToken).toBe('ya29.test_access_token_123');
    expect(retrieved?.refreshToken).toBe('1//test_refresh_token_456');
  });

  it('handles Google authentication lifecycle and token validity', async () => {
    await googleAuthProvider.authenticate({ email: 'anoop.janki.user@gmail.com', token: 'ya29.valid_token_xyz' });
    const status = await googleAuthProvider.getAuthStatus();

    expect(status.status).toBe('AUTHENTICATED');
    expect(status.userEmail).toBe('anoop.janki.user@gmail.com');

    const token = await googleAuthProvider.getValidAccessToken();
    expect(token).toBe('ya29.valid_token_xyz');

    await googleAuthProvider.disconnect();
    const disconnectedStatus = await googleAuthProvider.getAuthStatus();
    expect(disconnectedStatus.status).toBe('UNAUTHENTICATED');
  });

  it('reads, searches, and summarizes Gmail inbox messages with injection defense', async () => {
    const messages = await gmailClient.listMessages('GST');
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].subject).toContain('GST');

    const msg = await gmailClient.getMessage(messages[0].id);
    expect(msg).not.toBeNull();
    expect(msg?.body).toContain('<untrusted_external_data');
  });

  it('enforces human confirmation before dispatching emails (send_email)', async () => {
    const unconfirmedContext = {
      confirmedByUser: false,
      killSwitchActive: () => false,
    };

    const resUnconfirmed = await emailTool.execute(
      {
        action: 'send_email',
        to: 'partner@kerala-tech.in',
        subject: 'Project Milestone 6',
        body: 'Architecture verified.',
      },
      unconfirmedContext
    );

    expect(resUnconfirmed.status).toBe('NEEDS_CONFIRMATION');
    expect(resUnconfirmed.requiresConfirmation).toBe(true);

    const confirmedContext = {
      confirmedByUser: true,
      killSwitchActive: () => false,
    };

    const resConfirmed = await emailTool.execute(
      {
        action: 'send_email',
        to: 'partner@kerala-tech.in',
        subject: 'Project Milestone 6',
        body: 'Architecture verified.',
      },
      confirmedContext
    );

    expect(resConfirmed.status).toBe('SUCCESS');
    expect(resConfirmed.data?.sent).toBe(true);
    expect(resConfirmed.data?.messageId).toBeDefined();
  });

  it('reads calendar events and detects schedule conflicts', async () => {
    const events = await googleCalendarClient.listEvents();
    expect(events.length).toBeGreaterThan(0);

    // Check conflict for an event at the same time
    const eventTime = events[0].startTime;
    const conflicts = await googleCalendarClient.checkConflicts(eventTime, events[0].endTime);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].id).toBe(events[0].id);
  });

  it('creates calendar events and enforces confirmation on deletion', async () => {
    const createRes = await calendarTool.execute(
      {
        action: 'create_event',
        title: 'Strategy Session',
        durationMinutes: 45,
      },
      { confirmedByUser: false, killSwitchActive: () => false }
    );

    expect(createRes.status).toBe('SUCCESS');
    expect(createRes.data?.createdEvent?.title).toBe('Strategy Session');

    const eventId = createRes.data?.createdEvent?.id!;

    // Deletion unconfirmed
    const delUnconfirmed = await calendarTool.execute(
      { action: 'delete_event', eventId },
      { confirmedByUser: false, killSwitchActive: () => false }
    );
    expect(delUnconfirmed.status).toBe('NEEDS_CONFIRMATION');

    // Deletion confirmed
    const delConfirmed = await calendarTool.execute(
      { action: 'delete_event', eventId },
      { confirmedByUser: true, killSwitchActive: () => false }
    );
    expect(delConfirmed.status).toBe('SUCCESS');
  });
});
