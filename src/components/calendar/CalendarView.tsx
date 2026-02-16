"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Calendar, dateFnsLocalizer, View, Views } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import {
    addDays,
    addMonths,
    addWeeks,
    format,
    getDay,
    parse,
    startOfDay,
    startOfWeek,
    subDays,
    subMonths,
    subWeeks,
} from "date-fns";
import * as locales from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { trpc } from "@/lib/trpc/client";
import type { CalendarEvent } from "@/types/calendar";
import { toast } from "sonner";
import { CalendarFilters } from "./CalendarFilters";
import { CalendarSettings } from "./CalendarSettings";
import { BottomSheet } from "@/src/components/ui/BottomSheet";

// Setup DnD Calendar
const DnDCalendar = withDragAndDrop(Calendar);
const DnDCalendarAny = DnDCalendar as any;

// Setup localizer
const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

// Event style getter
const eventStyleGetter = (event: object) => {
    const resource = (event as { resource: CalendarEvent }).resource || (event as CalendarEvent); // fallback if resource not nested
    const colorMap: Record<string, string> = {
        blue: "#3b82f6",
        green: "#22c55e",
        red: "#ef4444",
        yellow: "#eab308",
        orange: "#f97316",
        gray: "#6b7280",
    };

    const backgroundColor = colorMap[resource.color] || resource.color || "#3b82f6";

    return {
        style: {
            backgroundColor,
            borderRadius: "4px",
            opacity: 0.9,
            color: "white",
            border: "0px",
            display: "block",
        },
    };
};

type CalendarPreferences = {
    defaultView: View;
    weekStartsOn: 0 | 1;
    showWeekends: boolean;
    eventDensity: 'compact' | 'comfortable' | 'spacious';
};

const DEFAULT_PREFERENCES: CalendarPreferences = {
    defaultView: Views.MONTH,
    weekStartsOn: 0, // Sunday default
    showWeekends: true,
    eventDensity: 'comfortable',
};

export default function CalendarView() {
    // State for preferences
    const [preferences, setPreferences] = useState<CalendarPreferences>(DEFAULT_PREFERENCES);
    // State for filters
    const [filters, setFilters] = useState({
        eventTypes: ['deliverable', 'payment', 'reminder'],
        status: 'all',
    });

    // Load preferences on mount
    useEffect(() => {
        const saved = localStorage.getItem('calendar-preferences');
        if (saved) {
            try {
                setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(saved) });
            } catch (e) {
                console.error("Failed to parse calendar preferences", e);
            }
        }
    }, []);

    // Save preferences when changed
    const handleSetPreference = useCallback((key: string, value: any) => {
        setPreferences(prev => {
            const next = { ...prev, [key]: value };
            localStorage.setItem('calendar-preferences', JSON.stringify(next));
            return next;
        });

        // If view changed in settings, update view state
        if (key === 'defaultView') {
            setView(value as View);
        }
    }, []);

    const [view, setView] = useState<View>(preferences.defaultView);
    const [date, setDate] = useState(new Date());
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    // Update view if preference loads differently (initial load)
    useEffect(() => {
        setView(preferences.defaultView);
    }, [preferences.defaultView]);

    // Local state for optimistic updates
    const [optimisticEvents, setOptimisticEvents] = useState<any[]>([]);

    // Calculate range for query based on view and date
    const { startDate, endDate } = useMemo(() => {
        const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
        const end = new Date(date.getFullYear(), date.getMonth() + 2, 0);
        return { startDate: start, endDate: end };
    }, [date]);

    // Query
    const { data, isLoading, refetch } = trpc.calendar.getEvents.useQuery({
        startDate,
        endDate,
    });

    // Mutation
    const updateEventDateMutation = trpc.calendar.updateEventDate.useMutation();

    // Sync data to local state when fetched
    useEffect(() => {
        if (data?.events) {
            const mapped = data.events.map((event: CalendarEvent) => ({
                start: new Date(event.eventDate),
                end: new Date(event.eventDate),
                title: event.title,
                allDay: true,
                resource: event,
            }));
            setOptimisticEvents(mapped);
        }
    }, [data]);

    // Filter Logic
    const filteredEvents = useMemo(() => {
        return optimisticEvents.filter(event => {
            const resource = event.resource as CalendarEvent;

            // Event Type Filter
            if (!filters.eventTypes.includes(resource.eventType)) {
                return false;
            }

            // Status Filter
            if (filters.status === 'upcoming') {
                if (resource.completedAt) return false; // Must be incomplete
                if (resource.status === 'POSTED' || resource.status === 'PAID') return false;
            }
            if (filters.status === 'completed') {
                // Either completedAt is set OR status indicates completion
                const isCompleted = resource.completedAt || resource.status === 'POSTED' || resource.status === 'PAID';
                if (!isCompleted) return false;
            }
            if (filters.status === 'overdue') {
                const isCompleted = resource.completedAt || resource.status === 'POSTED' || resource.status === 'PAID';
                if (isCompleted) return false;
                // Check if past due
                if (new Date(resource.eventDate) >= new Date()) return false;
            }

            return true;
        });
    }, [optimisticEvents, filters]);

    // Update localizer if week start changes
    const currentLocalizer = useMemo(() => {
        return dateFnsLocalizer({
            format,
            parse,
            startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: preferences.weekStartsOn }),
            getDay,
            locales,
        });
    }, [preferences.weekStartsOn]);

    const onNavigate = useCallback((newDate: Date) => setDate(newDate), [setDate]);
    const onView = useCallback((newView: View) => setView(newView), [setView]);

    const handleSelectEvent = useCallback((event: { resource: CalendarEvent; title: string }) => {
        setSelectedEvent(event.resource);
    }, []);

    const onEventDrop = useCallback(
        async ({ event, start }: { event: object; start: string | Date }) => {
            const resource = (event as { resource: CalendarEvent }).resource;
            const newDate = new Date(start);
            const todayStart = startOfDay(new Date());

            // Validation: Don't allow dragging past/completed events?
            // The user said: "Can't drag completed events (posted deliverables, paid payments)"
            if (resource.status === 'POSTED' || resource.status === 'PAID') {
                toast.error(`Cannot reschedule ${resource.status.toLowerCase()} events`);
                return;
            }

            if (newDate < todayStart) {
                toast.error("Cannot reschedule an event into the past");
                return;
            }

            // Optimistic update
            const originalEvents = [...optimisticEvents];

            // Update local state immediately
            const updatedEvents = originalEvents.map(e => {
                if (e.resource.sourceId === resource.sourceId && e.resource.eventType === resource.eventType) {
                    return { ...e, start: newDate, end: newDate };
                }
                return e;
            });
            setOptimisticEvents(updatedEvents);

            // Show toast/indicator?
            const toastId = toast.loading("Rescheduling...");

            try {
                await updateEventDateMutation.mutateAsync({
                    sourceId: resource.sourceId,
                    eventType: resource.eventType as 'deliverable' | 'payment',
                    newDate: newDate,
                });

                toast.success("Event rescheduled", { id: toastId });
                // Refetch to ensure consistency (and update other derived data if any)
                await refetch();
            } catch (error: any) {
                console.error("DnD fail", error);
                toast.error(error.message || "Failed to reschedule", { id: toastId });
                // Revert
                setOptimisticEvents(originalEvents);
            }
        },
        [optimisticEvents, updateEventDateMutation, refetch]
    );

    if (isLoading && optimisticEvents.length === 0) {
        return <div className="p-8 text-center">Loading calendar...</div>
    }

    const navigateBySwipe = (direction: "left" | "right") => {
        setDate((currentDate) => {
            switch (view) {
                case Views.MONTH:
                    return direction === "left"
                        ? addMonths(currentDate, 1)
                        : subMonths(currentDate, 1);
                case Views.WEEK:
                    return direction === "left"
                        ? addWeeks(currentDate, 1)
                        : subWeeks(currentDate, 1);
                case Views.DAY:
                    return direction === "left"
                        ? addDays(currentDate, 1)
                        : subDays(currentDate, 1);
                case Views.AGENDA:
                    return direction === "left"
                        ? addMonths(currentDate, 1)
                        : subMonths(currentDate, 1);
                default:
                    return currentDate;
            }
        });
    };

    const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
        const x = event.changedTouches[0]?.screenX ?? 0;
        event.currentTarget.dataset.swipeStartX = String(x);
    };

    const onTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
        const startX = Number(event.currentTarget.dataset.swipeStartX ?? "0");
        const endX = event.changedTouches[0]?.screenX ?? 0;
        const delta = endX - startX;

        if (Math.abs(delta) < 50) return;
        if (delta > 0) navigateBySwipe("right");
        if (delta < 0) navigateBySwipe("left");
    };

    return (
        <div className="flex flex-col h-[calc(100vh-64px)]">
            <div className="flex items-start justify-between bg-white border-b border-slate-200 px-4 py-2">
                <div className="flex-1">
                    <CalendarFilters
                        date={date}
                        setDate={setDate}
                        view={view}
                        setView={setView}
                        filters={filters}
                        setFilters={setFilters}
                    />
                </div>
                <div className="ml-4 mt-4">
                    <CalendarSettings preferences={preferences} setPreference={handleSetPreference} />
                </div>
            </div>

            <div className="flex-1 p-4 bg-slate-50 overflow-hidden">
                <div
                    className={`relative h-full bg-white rounded-lg shadow ${preferences.eventDensity === 'compact' ? 'text-xs' : ''}`}
                    onTouchStart={onTouchStart}
                    onTouchEnd={onTouchEnd}
                >
                    <DnDCalendarAny
                        localizer={currentLocalizer}
                        events={filteredEvents}
                        startAccessor={(e: any) => new Date(e.start)}
                        endAccessor={(e: any) => new Date(e.end)}
                        style={{ height: "100%" }}
                        view={view}
                        onView={onView}
                        date={date}
                        onNavigate={onNavigate}
                        onSelectEvent={(e: any) => handleSelectEvent(e)}
                        eventPropGetter={eventStyleGetter}
                        views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}

                        // DnD props
                        onEventDrop={onEventDrop}
                        resizable={false}
                        draggableAccessor={(event: object) => {
                            const r = (event as { resource: CalendarEvent }).resource;
                            return r.status !== 'POSTED' && r.status !== 'PAID';
                        }}
                    />
                    {!isLoading && filteredEvents.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/70 pointer-events-none">
                            <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                                No events
                            </p>
                        </div>
                    ) : null}
                </div>
            </div>
            <BottomSheet
                isOpen={selectedEvent !== null}
                onClose={() => setSelectedEvent(null)}
                title={selectedEvent?.title ?? "Event"}
                showCloseButton
            >
                {selectedEvent ? (
                    <div className="space-y-2 text-sm">
                        <p><span className="font-semibold">Type:</span> {selectedEvent.eventType}</p>
                        <p><span className="font-semibold">Status:</span> {selectedEvent.status}</p>
                        <p>
                            <span className="font-semibold">Date:</span>{" "}
                            {format(new Date(selectedEvent.eventDate), "PPP")}
                        </p>
                        {selectedEvent.relatedAmount !== null ? (
                            <p>
                                <span className="font-semibold">Amount:</span> ${selectedEvent.relatedAmount}
                            </p>
                        ) : null}
                        <p className="text-xs text-slate-500">Deal: {selectedEvent.dealId}</p>
                    </div>
                ) : null}
            </BottomSheet>
        </div>
    );
}
