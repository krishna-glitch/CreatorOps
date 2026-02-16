export type CalendarEventType = 'deliverable' | 'payment' | 'reminder';

export interface CalendarEvent {
    eventType: CalendarEventType;
    sourceId: string;
    dealId: string;
    eventDate: Date;
    completedAt: Date | null;
    title: string;
    status: string;
    relatedAmount: number | null;
    color: string;
}
