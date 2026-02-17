export type CalendarEventType = 'deliverable' | 'payment' | 'reminder';

export interface CalendarEvent {
    eventType: CalendarEventType;
    sourceId: string;
    dealId: string;
    currency: "USD" | "INR";
    eventDate: Date;
    completedAt: Date | null;
    title: string;
    status: string;
    relatedAmount: number | null;
    color: string;
    start?: Date;
    end?: Date;
    allDay?: boolean;
    resource?: CalendarEvent;
}
