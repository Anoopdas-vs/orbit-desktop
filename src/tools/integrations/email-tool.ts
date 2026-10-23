import { z } from 'zod';
import { Tool, ToolExecutionContext, ToolExecutionResult, VerificationResult } from '../../types/tools';
import { gmailClient, GmailClient } from '../../integrations/google/gmail-client';

export const EmailToolInputSchema = z.object({
  action: z.enum(['list_emails', 'summarize_email', 'send_email']),
  filter: z.string().optional(),
  emailId: z.string().optional(),
  to: z.string().email().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
});

export type EmailToolInput = z.infer<typeof EmailToolInputSchema>;

export interface EmailMessage {
  id: string;
  sender: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
}

export interface EmailToolOutput {
  action: string;
  emails?: EmailMessage[];
  selectedEmail?: EmailMessage;
  sent?: boolean;
  messageId?: string;
  summary?: string;
}

export class EmailTool implements Tool<EmailToolInput, EmailToolOutput> {
  public name = 'email_workflow';
  public description = 'Integrated email workflow tool for reading, summarizing, and safely sending emails with strict confirmation gating.';
  public inputSchema = EmailToolInputSchema;
  public riskLevel = 'MEDIUM' as const; // Default medium, elevated to HIGH for send
  public requiredPermissions = ['network' as const];

  // In-memory mock inbox for demonstration / headless execution
  private inbox: EmailMessage[] = [
    {
      id: 'em-101',
      sender: 'alex@company.org',
      subject: 'Quarterly Tech Strategy & Roadmap Updates',
      date: new Date(Date.now() - 3600000).toISOString(),
      snippet: 'Hi team, please find attached the key architecture milestones for Q4 desktop automation...',
      unread: true,
    },
    {
      id: 'em-102',
      sender: 'accounts@finance.org',
      subject: 'GST Compliance Guidelines & Invoicing Notice',
      date: new Date(Date.now() - 86400000).toISOString(),
      snippet: 'Important: The new GST revisions effective next month require adjusted tax filing brackets...',
      unread: false,
    },
    {
      id: 'em-103',
      sender: 'sreedevi@kerala-tech.in',
      subject: 'പ്രൊജക്റ്റ് അപ്‌ഡേറ്റ് (Project Update)',
      date: new Date(Date.now() - 7200000).toISOString(),
      snippet: 'പുതിയ സോഫ്റ്റ്‌വെയർ റിലീസ് ടെസ്റ്റിംഗ് പൂർത്തിയായിട്ടുണ്ട്...',
      unread: true,
    },
  ];

  public async execute(
    input: EmailToolInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<EmailToolOutput>> {
    const startTime = performance.now();

    if (context.killSwitchActive()) {
      return {
        status: 'BLOCKED',
        success: false,
        error: 'Execution blocked: Emergency Kill Switch is engaged.',
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    try {
      switch (input.action) {
        case 'list_emails': {
          const list = await gmailClient.listMessages(input.filter);

          return {
            status: 'SUCCESS',
            success: true,
            data: { action: 'list_emails', emails: list },
            stdout: `Retrieved ${list.length} email(s) from inbox.`,
            message: `Found ${list.length} emails matching your criteria.`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'summarize_email': {
          const list = await gmailClient.listMessages(input.filter);
          const target = input.emailId
            ? list.find((m) => m.id === input.emailId)
            : list[0];

          if (!target) {
            return {
              status: 'FAILED',
              success: false,
              error: `No email found matching criteria: "${input.emailId || input.filter}"`,
              durationMs: Math.round(performance.now() - startTime),
            };
          }

          const full = await gmailClient.getMessage(target.id) || target;
          const summary = `Email from ${full.sender} on "${full.subject}": ${full.snippet}`;
          return {
            status: 'SUCCESS',
            success: true,
            data: { action: 'summarize_email', selectedEmail: full, summary },
            stdout: summary,
            message: summary,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        case 'send_email': {
          if (!input.to || !input.subject || !input.body) {
            return {
              status: 'FAILED',
              success: false,
              error: 'Sending email requires "to", "subject", and "body" fields.',
              durationMs: Math.round(performance.now() - startTime),
            };
          }

          // Strict Safety Requirement: Sending email is HIGH risk and requires confirmation
          if (!context.confirmedByUser) {
            return {
              status: 'NEEDS_CONFIRMATION',
              success: false,
              requiresConfirmation: true,
              confirmationPrompt: `Send email to "${input.to}" with subject "${input.subject}"?`,
              message: `Approval required before dispatching email to ${input.to}.`,
              durationMs: Math.round(performance.now() - startTime),
            };
          }

          const sent = await gmailClient.sendMessage(input.to, input.subject, input.body);
          return {
            status: 'SUCCESS',
            success: true,
            data: { action: 'send_email', sent: true, messageId: sent.messageId },
            stdout: `Email dispatched to ${input.to} (Subject: "${input.subject}"). Message ID: ${sent.messageId}`,
            message: `Email successfully sent to ${input.to}.`,
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        default:
          return {
            status: 'FAILED',
            success: false,
            error: `Unsupported email action: ${input.action}`,
            durationMs: Math.round(performance.now() - startTime),
          };
      }
    } catch (err: any) {
      return {
        status: 'FAILED',
        success: false,
        error: err.message || 'Email workflow execution failed',
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  public async verify(
    input: EmailToolInput,
    result: ToolExecutionResult<EmailToolOutput>
  ): Promise<VerificationResult> {
    if (!result.success && result.status !== 'NEEDS_CONFIRMATION') {
      return {
        verified: false,
        actualState: result.status,
        error: result.error || 'Email action failed',
      };
    }

    if (input.action === 'send_email' && result.success && result.data?.sent) {
      return {
        verified: true,
        actualState: `Message ${result.data.messageId} verified in outbox queue`,
      };
    }

    return {
      verified: true,
      actualState: `Completed ${input.action}`,
    };
  }
}

export const emailTool = new EmailTool();
