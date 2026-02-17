"use client";
"use no memo";

import { keepPreviousData } from "@tanstack/react-query";
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
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  type View,
  Views,
} from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/src/components/ui/BottomSheet";
import { formatDealCurrency } from "@/src/lib/utils/format-utils";
import {
  getDealStatusTone,
  getStatusBadgeClasses,
} from "@/src/lib/utils/status-utils";
import type { CalendarEvent } from "@/types/calendar";
import { CalendarFilters } from "./CalendarFilters";
import { CalendarSettings } from "./CalendarSettings";

// Setup DnD Calendar
const DnDCalendar = withDragAndDrop(Calendar);
const DnDCalendarAny = DnDCalendar as any;
const CALENDAR_VIEWS = [Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA];
const CALENDAR_STYLE = { height: "100%" };

type CalendarPreferences = {
  defaultView: View;
  weekStartsOn: 0 | 1;
  showWeekends: boolean;
  eventDensity: "compact" | "comfortable" | "spacious";
};

const DEFAULT_PREFERENCES: CalendarPreferences = {
  defaultView: Views.MONTH,
  weekStartsOn: 0, // Sunday default
  showWeekends: true,
  eventDensity: "comfortable",
};

const COLOR_MAP: Record<string, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  yellow: "#eab308",
  orange: "#f97316",
  gray: "#6b7280",
};

function mapServerEventsToCalendarEvents(events: CalendarEvent[]) {
  return events.map((event: CalendarEvent) => ({
    start: new Date(event.eventDate),
    end: new Date(event.eventDate),
    title: event.title,
    allDay: true,
    resource: event,
  }));
}

function getEventKey(resource: CalendarEvent) {
  return `${resource.eventType}:${resource.sourceId}`;
}

function isWeekendDate(value: Date) {
  const day = value.getDay();
  return day === 0 || day === 6;
}

export default function CalendarView() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  // 1. State for preferences
  const [preferences, setPreferences] =
    useState<CalendarPreferences>(DEFAULT_PREFERENCES);

  // 2. State for filters
  const [filters, setFilters] = useState({
    eventTypes: ["deliverable", "payment", "reminder"],
    status: "all",
  });

  // 3. View & Date State
  const [view, setView] = useState<View>(DEFAULT_PREFERENCES.defaultView);
  const [date, setDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );

  // 4. Local state for optimistic date overrides
  const [optimisticDateOverrides, setOptimisticDateOverrides] = useState<
    Record<string, number>
  >({});

  // Load preferences on mount
  useEffect(() => {
    const saved = localStorage.getItem("calendar-preferences");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
        if (parsed.defaultView) setView(parsed.defaultView);
      } catch (e) {
        console.error("Failed to parse calendar preferences", e);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const apply = () => {
      setIsMobile(mediaQuery.matches);
    };

    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, []);

  // Save preferences when changed
  const handleSetPreference = useCallback((key: string, value: any) => {
    setPreferences((prev) => {
      if (prev[key as keyof CalendarPreferences] === value) {
        return prev;
      }
      const next = { ...prev, [key]: value };
      localStorage.setItem("calendar-preferences", JSON.stringify(next));
      return next;
    });

    if (key === "defaultView") {
      setView((previousView) =>
        previousView === value ? previousView : (value as View),
      );
    }

    if (key === "showWeekends") {
      const nextValue = Boolean(value);
      setView((previousView) => {
        if (!nextValue && previousView === Views.WEEK) {
          return Views.WORK_WEEK;
        }
        if (nextValue && previousView === Views.WORK_WEEK) {
          return Views.WEEK;
        }
        return previousView;
      });
    }
  }, []);

  // Stable Event Style Getter
  const eventStyleGetter = useCallback((event: any) => {
    const resource = event.resource || event;
    const backgroundColor =
      COLOR_MAP[resource.color] || resource.color || "#3b82f6";

    return {
      style: {
        backgroundColor,
        borderRadius: "8px",
        opacity: 0.9,
        color: "white",
        border: "0px",
        display: "block",
        padding: "2px 6px",
        fontSize: "0.75rem",
        fontWeight: "500",
      },
    };
  }, []);

  // Stable Localizer
  const currentLocalizer = useMemo(() => {
    return dateFnsLocalizer({
      format,
      parse,
      startOfWeek: (date: Date) =>
        startOfWeek(date, { weekStartsOn: preferences.weekStartsOn }),
      getDay,
      locales,
    });
  }, [preferences.weekStartsOn]);

  // Query Range
  const { startDate, endDate } = useMemo(() => {
    const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 2, 0);
    return { startDate: start, endDate: end };
  }, [date]);

  // API Query
  const { data, isLoading, refetch } = trpc.calendar.getEvents.useQuery(
    {
      startDate,
      endDate,
    },
    {
      staleTime: 60_000,
      placeholderData: keepPreviousData,
    },
  );

  // API Mutation
  const updateEventDateMutation = trpc.calendar.updateEventDate.useMutation();

  const calendarEvents = useMemo(() => {
    if (!data?.events) {
      return [];
    }

    const mapped = mapServerEventsToCalendarEvents(data.events);
    return mapped.map((event) => {
      const override = optimisticDateOverrides[getEventKey(event.resource)];
      if (!override) {
        return event;
      }

      const dateValue = new Date(override);
      return {
        ...event,
        start: dateValue,
        end: dateValue,
      };
    });
  }, [data?.events, optimisticDateOverrides]);

  // Filter Logic
  const filteredEvents = useMemo(() => {
    return calendarEvents.filter((event) => {
      const resource = event.resource as CalendarEvent;
      const eventDate = new Date(resource.eventDate);

      if (!preferences.showWeekends && isWeekendDate(eventDate)) {
        return false;
      }

      if (!filters.eventTypes.includes(resource.eventType)) {
        return false;
      }

      if (filters.status === "upcoming") {
        if (resource.completedAt) return false;
        if (resource.status === "POSTED" || resource.status === "PAID")
          return false;
      }
      if (filters.status === "completed") {
        const isCompleted =
          resource.completedAt ||
          resource.status === "POSTED" ||
          resource.status === "PAID";
        if (!isCompleted) return false;
      }
      if (filters.status === "overdue") {
        const isCompleted =
          resource.completedAt ||
          resource.status === "POSTED" ||
          resource.status === "PAID";
        if (isCompleted) return false;
        if (new Date(resource.eventDate) >= new Date()) return false;
      }

      return true;
    });
  }, [calendarEvents, filters, preferences.showWeekends]);

  const onNavigate = useCallback((newDate: Date) => {
    setDate((currentDate) =>
      currentDate.getTime() === newDate.getTime() ? currentDate : newDate,
    );
  }, []);
  const onView = useCallback((newView: View) => {
    setView((currentView) => (currentView === newView ? currentView : newView));
  }, []);

  const handleSelectEvent = useCallback((event: any) => {
    setSelectedEvent(event.resource || event);
  }, []);

  const startAccessor = useCallback((event: any) => new Date(event.start), []);
  const endAccessor = useCallback((event: any) => new Date(event.end), []);
  const draggableAccessor = useCallback((event: object) => {
    const resource = (event as { resource: CalendarEvent }).resource;
    return resource.status !== "POSTED" && resource.status !== "PAID";
  }, []);
  const closeEventSheet = useCallback(() => setSelectedEvent(null), []);

  const onEventDrop = useCallback(
    async ({ event, start }: { event: object; start: string | Date }) => {
      const resource = (event as { resource: CalendarEvent }).resource;
      const newDate = new Date(start);
      const todayStart = startOfDay(new Date());

      if (resource.status === "POSTED" || resource.status === "PAID") {
        toast.error(
          `Cannot reschedule ${resource.status.toLowerCase()} events`,
        );
        return;
      }

      if (newDate < todayStart) {
        toast.error("Cannot reschedule an event into the past");
        return;
      }

      if (!preferences.showWeekends && isWeekendDate(newDate)) {
        toast.error("Weekend scheduling is disabled in your preferences");
        return;
      }

      const eventKey = getEventKey(resource);
      const previousOverride = optimisticDateOverrides[eventKey];
      setOptimisticDateOverrides((current) => ({
        ...current,
        [eventKey]: newDate.getTime(),
      }));

      const toastId = toast.loading("Rescheduling...");

      try {
        await updateEventDateMutation.mutateAsync({
          sourceId: resource.sourceId,
          eventType: resource.eventType as "deliverable" | "payment",
          newDate: newDate,
        });

        toast.success("Event rescheduled", { id: toastId });
        await refetch();
      } catch (error: any) {
        console.error("DnD fail", error);
        toast.error(error.message || "Failed to reschedule", { id: toastId });
        setOptimisticDateOverrides((current) => {
          const next = { ...current };
          if (previousOverride === undefined) {
            delete next[eventKey];
          } else {
            next[eventKey] = previousOverride;
          }
          return next;
        });
      }
    },
    [
      optimisticDateOverrides,
      preferences.showWeekends,
      updateEventDateMutation,
      refetch,
    ],
  );

  const onTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const x = event.changedTouches[0]?.screenX ?? 0;
      event.currentTarget.dataset.swipeStartX = String(x);
    },
    [],
  );

  const onTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const startX = Number(event.currentTarget.dataset.swipeStartX ?? "0");
      const endX = event.changedTouches[0]?.screenX ?? 0;
      const delta = endX - startX;

      if (Math.abs(delta) < 50) return;

      const direction = delta > 0 ? "right" : "left";

      setDate((currentDate) => {
        switch (view) {
          case Views.MONTH:
            return direction === "left"
              ? addMonths(currentDate, 1)
              : subMonths(currentDate, 1);
          case Views.WEEK:
          case Views.WORK_WEEK:
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
    },
    [view],
  );

  const availableViews = useMemo<View[]>(
    () => {
      if (isMobile) {
        return preferences.showWeekends
          ? [Views.AGENDA, Views.WEEK, Views.DAY]
          : [Views.AGENDA, Views.WORK_WEEK, Views.DAY];
      }

      return preferences.showWeekends
        ? [...CALENDAR_VIEWS]
        : [Views.MONTH, Views.WORK_WEEK, Views.DAY, Views.AGENDA];
    },
    [isMobile, preferences.showWeekends],
  );

  useEffect(() => {
    if (!availableViews.some((value) => value === view)) {
      setView(availableViews[0]);
    }
  }, [availableViews, view]);

  if (isLoading && calendarEvents.length === 0) {
    return (
      <div className="p-8 text-center dash-text-muted">Loading calendar...</div>
    );
  }

  return (
    <div className="flex h-full flex-col dash-bg-panel">
      <div className="flex flex-col gap-2 border-b dash-border dash-bg-card px-3 py-3 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:px-4">
        <div className="flex-1 min-w-0">
          <CalendarFilters
            date={date}
            setDate={onNavigate}
            view={view}
            setView={onView}
            availableViews={availableViews}
            compact={isMobile}
            filters={filters}
            setFilters={setFilters}
          />
        </div>
        <div className="self-end sm:ml-4 sm:mt-4">
          <CalendarSettings
            preferences={preferences}
            setPreference={handleSetPreference}
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-2 sm:p-4">
        <div
          className={cn(
            "calendar-shell relative h-full overflow-hidden border dash-border dash-bg-card shadow-xl",
            isMobile ? "rounded-xl" : "rounded-2xl",
            preferences.eventDensity === "compact"
              ? "calendar-density-compact text-xs"
              : preferences.eventDensity === "spacious"
                ? "calendar-density-spacious"
                : "calendar-density-comfortable",
          )}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <DnDCalendarAny
            localizer={currentLocalizer}
            events={filteredEvents}
            startAccessor={startAccessor}
            endAccessor={endAccessor}
            style={CALENDAR_STYLE}
            view={view}
            onView={onView}
            date={date}
            onNavigate={onNavigate}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventStyleGetter}
            views={availableViews}
            toolbar={false}
            onEventDrop={onEventDrop}
            resizable={false}
            draggableAccessor={draggableAccessor}
          />
          {!isLoading && filteredEvents.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-[1px] pointer-events-none">
              <p className="rounded-xl border dash-border dash-bg-card px-6 py-3 text-sm dash-text-muted shadow-2xl font-bold uppercase tracking-widest">
                No Affairs Scheduled
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <BottomSheet
        isOpen={selectedEvent !== null}
        onClose={closeEventSheet}
        title={selectedEvent?.title ?? "Event"}
        showCloseButton
      >
        {selectedEvent ? (
          <div className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-widest dash-text-soft">
                  Type
                </p>
                <p className="text-sm font-bold dash-text uppercase">
                  {selectedEvent.eventType}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-widest dash-text-soft">
                  Status
                </p>
                <div className="flex">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      getStatusBadgeClasses(
                        getDealStatusTone(selectedEvent.status),
                      ),
                    )}
                  >
                    {selectedEvent.status}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-widest dash-text-soft">
                  Date
                </p>
                <p className="text-sm font-bold dash-text">
                  {format(new Date(selectedEvent.eventDate), "PPP")}
                </p>
              </div>
              {selectedEvent.relatedAmount !== null ? (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest dash-text-soft">
                    Amount
                  </p>
                  <p className="text-sm font-bold gold-text">
                    {formatDealCurrency(selectedEvent.relatedAmount, {
                      currency: selectedEvent.currency,
                    })}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="pt-4 border-t dash-border">
              <button
                type="button"
                onClick={() => {
                  router.push(`/deals/${selectedEvent.dealId}`);
                  setSelectedEvent(null);
                }}
                className="w-full dash-shell-primary-btn py-3 rounded-xl font-bold text-sm shadow-lg transition-transform active:scale-[0.98]"
              >
                View Detailed Deal
              </button>
            </div>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}
