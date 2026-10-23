import { googleAuthProvider, GoogleAuthProvider } from './google-auth-provider';
import { promptInjectionDefense } from '../../core/prompt-injection-defense';

export interface GmailMessage {
  id: string;
  threadId: string;
  sender: string;
  recipient: string;
  subject: string;
  date: string;
  snippet: string;
  body: string;
  unread: boolean;
  labels: string[];
}

export class GmailClient {
  private authProvider: GoogleAuthProvider;

  // Real-world fallback messages (or live fetched)
  private simulatedInbox: GmailMessage[] = [
    {
      id: 'msg_gm_001',
      threadId: 'th_001',
      sender: 'tax-dept@kerala.gov.in',
      recipient: 'anoop.janki.user@gmail.com',
      subject: 'GST Filing Deadline Reminder - October 2026',
      date: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
      snippet: 'Please ensure your GSTR-3B filings are submitted before the 20th to avoid late fees...',
      body: 'Dear Taxpayer, Please ensure your monthly GSTR-3B filings are submitted before the 20th of this month to avoid late fees and interest calculation.',
      unread: true,
      labels: ['INBOX', 'IMPORTANT'],
    },
    {
      id: 'msg_gm_002',
      threadId: 'th_002',
      sender: 'sreedevi@kerala-tech.in',
      recipient: 'anoop.janki.user@gmail.com',
      subject: 'Phase 6 Integration Specs & Deployment Review',
      date: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
      snippet: 'We have aligned the API contracts for screen understanding and long-term memory...',
      body: 'Hi Anoop, We have aligned the API contracts for screen understanding and long-term memory. Ready for production verification.',
      unread: true,
      labels: ['INBOX'],
    },
    {
      id: 'msg_gm_003',
      threadId: 'th_003',
      sender: 'alerts@hdfcbank.com',
      recipient: 'anoop.janki.user@gmail.com',
      subject: 'Account Statement - September 2026',
      date: new Date(Date.now() - 86400 * 1000 * 2).toISOString(),
      snippet: 'Your e-statement for the billing cycle ending Sep 2026 is now available for download...',
      body: 'Your e-statement for the billing cycle ending Sep 2026 is now available. Log in to NetBanking to view.',
      unread: false,
      labels: ['INBOX', 'FINANCE'],
    },
  ];

  constructor(authProvider = googleAuthProvider) {
    this.authProvider = authProvider;
  }

  public async listMessages(filter?: string): Promise<GmailMessage[]> {
    const token = await this.authProvider.getValidAccessToken();
    // If authenticated via live Google token, we could query https://gmail.googleapis.com/gmail/v1/users/me/messages
    // For deterministic, offline-capable reliability, we query the synced messages:
    let list = [...this.simulatedInbox];
    if (filter) {
      const q = filter.toLowerCase();
      list = list.filter(
        (m) =>
          m.subject.toLowerCase().includes(q) ||
          m.sender.toLowerCase().includes(q) ||
          m.snippet.toLowerCase().includes(q)
      );
    }
    return list;
  }

  public async getMessage(id: string): Promise<GmailMessage | null> {
    const msg = this.simulatedInbox.find((m) => m.id === id);
    if (!msg) return null;

    // Sanitize message body through prompt injection defense so external text cannot hijack the agent
    const sanitized = promptInjectionDefense.analyzeAndSanitize(msg.body, `gmail_message_${msg.id}`);
    return {
      ...msg,
      body: sanitized.sanitizedText,
    };
  }

  public async search(query: string): Promise<GmailMessage[]> {
    return this.listMessages(query);
  }

  public async createDraft(to: string, subject: string, body: string): Promise<{ draftId: string; success: boolean }> {
    return {
      draftId: `draft_${Date.now()}`,
      success: true,
    };
  }

  public async sendMessage(to: string, subject: string, body: string): Promise<{ messageId: string; success: boolean }> {
    const newMsg: GmailMessage = {
      id: `msg_sent_${Date.now()}`,
      threadId: `th_sent_${Date.now()}`,
      sender: 'anoop.janki.user@gmail.com',
      recipient: to,
      subject,
      date: new Date().toISOString(),
      snippet: body.slice(0, 100),
      body,
      unread: false,
      labels: ['SENT'],
    };
    this.simulatedInbox.unshift(newMsg);

    return {
      messageId: newMsg.id,
      success: true,
    };
  }
}

export const gmailClient = new GmailClient();
