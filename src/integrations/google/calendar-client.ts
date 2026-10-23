import { googleAuthProvider, GoogleAuthProvider } from './google-auth-provider';

export interface CalendarEventItem {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  durationMinutes: number;
  location?: string;
}

export class GoogleCalendarClient {
  private authProvider: GoogleAuthProvider;

  private events: CalendarEventItem[] = [
    {
      id: 'cal_g_101',
      title: 'Phase 6 Production Intelligence Review',
      description: 'Review multimodal screen vision, memory retrieval, and OAuth adapters.',
      startTime: new Date(Date.now() + 3600 * 1000 * 2).toISOString(),
      endTime: new Date(Date.now() + 3600 * 1000 * 3).toISOString(),
      durationMinutes: 60,
      location: 'Antigravity Workspace Room A',
    },
    {
      id: 'cal_g_102',
      title: 'Kerala GST & Tech Advisory Sync',
      description: 'Discuss state compliance updates and automation strategies.',
      startTime: new Date(Date.now() + 3600 * 1000 * 5).toISOString(),
      endTime: new Date(Date.now() + 3600 * 1000 * 5.75).toISOString(),
      durationMinutes: 45,
      location: 'Google Meet',
    },
  ];

  constructor(authProvider = googleAuthProvider) {
    this.authProvider = authProvider;
  }

  public async listEvents(timeMin?: string, timeMax?: string): Promise<CalendarEventItem[]> {
    return [...this.events];
  }

  public async searchEvents(query: string): Promise<CalendarEventItem[]> {
    const q = query.toLowerCase();
    return this.events.filter(
      (e) => e.title.toLowerCase().includes(q) || (e.description && e.description.toLowerCase().includes(q))
    );
  }

  public async checkConflicts(startTime: string, endTime: string): Promise<CalendarEventItem[]> {
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();

    return this.events.filter((e) => {
      const eStart = new Date(e.startTime).getTime();
      const eEnd = new Date(e.endTime).getTime();
      return Math.max(startMs, eStart) < Math.min(endMs, eEnd);
    });
  }

  public async createEvent(
    title: string,
    startTime: string,
    durationMinutes: number = 30,
    description?: string,
    location?: string
  ): Promise<CalendarEventItem> {
    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const newEvent: CalendarEventItem = {
      id: `cal_g_${Date.now()}`,
      title,
      description,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes,
      location,
    };

    this.events.push(newEvent);
    return newEvent;
  }

  public async deleteEvent(id: string): Promise<boolean> {
    const idx = this.events.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    this.events.splice(idx, 1);
    return true;
  }
}

export const googleCalendarClient = new GoogleCalendarClient();
