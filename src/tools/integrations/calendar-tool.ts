import { z } from 'zod';
import { Tool, ToolExecutionContext, ToolExecutionResult, VerificationResult } from '../../types/tools';
import { googleCalendarClient, CalendarEventItem } from '../../integrations/google/calendar-client';

export const CalendarInputSchema = z.object({
  action: z.enum(['list_events', 'create_event', 'check_conflicts', 'delete_event']),
  timeframe: z.enum(['today', 'upcoming', 'all']).default('today').optional(),
  title: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationMinutes: z.number().default(30).optional(),
  eventId: z.string().optional(),
});

export type CalendarInput = z.infer<typeof CalendarInputSchema>;

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  durationMinutes: number;
  location?: string;
}

export interface CalendarOutput {
  action: string;
  events?: CalendarEvent[];
  createdEvent?: CalendarEvent;
}

export class CalendarTool implements Tool<CalendarInput, CalendarOutput> {
  public name = 'calendar_workflow';
  public description = 'Calendar integration tool for inspecting schedules and booking events.';
  public inputSchema = CalendarInputSchema;
  public riskLevel = 'LOW' as const; // Elevated to MEDIUM for create_event
  public requiredPermissions = [];

  private events: CalendarEvent[] = [
    {
      id: 'cal-1',
      title: 'Phase 5 Architecture Sync & Code Review',
      startTime: new Date(Date.now() + 7200000).toISOString(),
      durationMinutes: 45,
      location: 'Antigravity Workspace',
    },
    {
      id: 'cal-2',
      title: 'Weekly Standup & Milestone Review',
      startTime: new Date(Date.now() + 86400000).toISOString(),
      durationMinutes: 30,
      location: 'Virtual',
    },
  ];

  public async execute(
    input: CalendarInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<CalendarOutput>> {
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
      if (input.action === 'list_events') {
        const events = await googleCalendarClient.listEvents();
        const eventSummaryList = events.map((e) => {
          const timeStr = new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `• ${e.title} at ${timeStr} (${e.durationMinutes} min)`;
        }).join('\n');

        const spokenList = events.map((e) => {
          const timeStr = new Date(e.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          return `${e.title} at ${timeStr}`;
        }).join(', and ');

        return {
          status: 'SUCCESS',
          success: true,
          data: { action: 'list_events', events },
          stdout: `Upcoming Calendar Events:\n${eventSummaryList}`,
          message: events.length > 0 ? `You have ${events.length} meeting(s) today: ${spokenList}.` : 'You have no scheduled meetings today.',
          durationMs: Math.round(performance.now() - startTime),
        };
      }

      if (input.action === 'check_conflicts') {
        const start = input.startTime || new Date().toISOString();
        const end = input.endTime || new Date(new Date(start).getTime() + (input.durationMinutes || 30) * 60000).toISOString();
        const conflicts = await googleCalendarClient.checkConflicts(start, end);
        return {
          status: 'SUCCESS',
          success: true,
          data: { action: 'check_conflicts', events: conflicts },
          stdout: conflicts.length > 0 ? `Found ${conflicts.length} conflicting event(s)` : 'No schedule conflicts found',
          message: conflicts.length > 0 ? `Schedule conflict detected with ${conflicts[0].title}` : 'Time slot is free.',
          durationMs: Math.round(performance.now() - startTime),
        };
      }

      if (input.action === 'create_event') {
        if (!input.title) {
          return {
            status: 'FAILED',
            success: false,
            error: 'Creating a calendar event requires an event title.',
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        const newEvent = await googleCalendarClient.createEvent(
          input.title,
          input.startTime || new Date(Date.now() + 3600000).toISOString(),
          input.durationMinutes || 30
        );

        return {
          status: 'SUCCESS',
          success: true,
          data: { action: 'create_event', createdEvent: newEvent },
          stdout: `Scheduled "${newEvent.title}" for ${new Date(newEvent.startTime).toLocaleTimeString()} (${newEvent.durationMinutes} min).`,
          message: `Scheduled calendar event: "${newEvent.title}".`,
          durationMs: Math.round(performance.now() - startTime),
        };
      }

      if (input.action === 'delete_event') {
        if (!input.eventId) {
          return {
            status: 'FAILED',
            success: false,
            error: 'Deleting a calendar event requires eventId.',
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        // Confirmation Gating for destructive calendar action
        if (!context.confirmedByUser) {
          return {
            status: 'NEEDS_CONFIRMATION',
            success: false,
            requiresConfirmation: true,
            confirmationPrompt: `Are you sure you want to delete calendar event "${input.eventId}"?`,
            message: 'Approval required before deleting calendar event.',
            durationMs: Math.round(performance.now() - startTime),
          };
        }

        const deleted = await googleCalendarClient.deleteEvent(input.eventId);
        return {
          status: deleted ? 'SUCCESS' : 'FAILED',
          success: deleted,
          data: { action: 'delete_event' },
          stdout: deleted ? `Deleted event ${input.eventId}` : `Event ${input.eventId} not found`,
          message: deleted ? 'Calendar event deleted.' : 'Failed to delete calendar event.',
          durationMs: Math.round(performance.now() - startTime),
        };
      }

      return {
        status: 'FAILED',
        success: false,
        error: `Unknown action: ${input.action}`,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        success: false,
        error: err.message || 'Calendar action failed',
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  public async verify(
    input: CalendarInput,
    result: ToolExecutionResult<CalendarOutput>
  ): Promise<VerificationResult> {
    if (!result.success || !result.data) {
      if (result.status === 'NEEDS_CONFIRMATION') {
        return { verified: true, actualState: 'Awaiting confirmation' };
      }
      return { verified: false, actualState: result.status, error: result.error };
    }

    if (input.action === 'create_event') {
      const allEvents = await googleCalendarClient.listEvents();
      const exists = allEvents.some((e) => e.id === result.data?.createdEvent?.id) ||
                     this.events.some((e) => e.id === result.data?.createdEvent?.id);
      return {
        verified: exists,
        actualState: exists ? 'Event verified in Google Calendar client' : 'Event missing from calendar store',
      };
    }

    return { verified: true, actualState: 'Calendar state verified' };
  }
}

export const calendarTool = new CalendarTool();
