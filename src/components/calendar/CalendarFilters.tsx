"use client";

import { memo, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, subDays } from "date-fns";
import { View, Views } from "react-big-calendar";
import { cn } from "@/lib/utils";

interface CalendarFiltersProps {
    date: Date;
    setDate: (date: Date) => void;
    view: View;
    setView: (view: View) => void;
    filters: {
        eventTypes: string[];
        status: string;
    };
    setFilters: (filters: { eventTypes: string[]; status: string }) => void;
}

export const CalendarFilters = memo(function CalendarFilters({
    date,
    setDate,
    view,
    setView,
    filters,
    setFilters,
}: CalendarFiltersProps) {

    const handleNavigate = useCallback((action: 'PREV' | 'NEXT' | 'TODAY') => {
        if (action === 'TODAY') {
            setDate(new Date());
            return;
        }

        switch (view) {
            case Views.MONTH:
                setDate(action === 'NEXT' ? addMonths(date, 1) : subMonths(date, 1));
                break;
            case Views.WEEK:
                setDate(action === 'NEXT' ? addWeeks(date, 1) : subWeeks(date, 1));
                break;
            case Views.DAY:
                setDate(action === 'NEXT' ? addDays(date, 1) : subDays(date, 1));
                break;
            case Views.AGENDA:
                setDate(action === 'NEXT' ? addMonths(date, 1) : subMonths(date, 1));
                break;
        }
    }, [date, setDate, view]);

    const toggleEventType = useCallback((type: string) => {
        const current = filters.eventTypes;
        const next = current.includes(type)
            ? current.filter(t => t !== type)
            : [...current, type];
        setFilters({ ...filters, eventTypes: next });
    }, [filters, setFilters]);

    const setStatus = useCallback((status: string) => {
        setFilters({ ...filters, status });
    }, [filters, setFilters]);

    const dateLabel = useMemo(() => {
        if (view === Views.MONTH) return format(date, 'MMMM yyyy');
        if (view === Views.WEEK) {
            const start = startOfWeek(date);
            const end = endOfWeek(date);
            return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
        }
        if (view === Views.DAY) return format(date, 'EEEE, MMMM d, yyyy');
        return format(date, 'MMMM yyyy');
    }, [date, view]);

    return (
        <div className="flex flex-col gap-4 p-4 dash-bg-card border-b dash-border">
            {/* Top Row: Navigation & Main Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleNavigate('TODAY')}
                        className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest gold-text hover:opacity-80 transition-opacity"
                    >
                        Today
                    </button>
                    <div className="flex items-center rounded-xl border dash-border bg-white dark:bg-black/20 shadow-sm overflow-hidden">
                        <button 
                            onClick={() => handleNavigate('PREV')} 
                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 dash-text-muted transition-colors"
                            aria-label="Previous"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-slate-200 dark:bg-white/10" />
                        <button 
                            onClick={() => handleNavigate('NEXT')} 
                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 dash-text-muted transition-colors"
                            aria-label="Next"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <span className="ml-2 text-lg font-serif font-bold dash-text">
                        {dateLabel}
                    </span>
                </div>

                {/* View Switcher */}
                <div className="flex items-center dash-bg-panel rounded-xl p-1 shadow-inner border dash-border">
                    {[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA].map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={cn(
                                "px-3 py-1.5 text-[10px] uppercase font-bold tracking-widest rounded-lg transition-all",
                                view === v
                                    ? "pillowy-card gold-text bg-white dark:bg-black/40 shadow-sm"
                                    : "dash-text-soft hover:dash-text"
                            )}
                        >
                            {v === Views.AGENDA ? 'Agenda' : v}
                        </button>
                    ))}
                </div>
            </div>

            {/* Second Row: Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pt-2">

                {/* Event Types */}
                <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider dash-text-muted cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={filters.eventTypes.includes('deliverable')}
                            onChange={() => toggleEventType('deliverable')}
                            className="w-4 h-4 rounded border-slate-300 dark:border-white/10 text-brand-600 focus:ring-brand-500 bg-transparent"
                        />
                        <span className="group-hover:dash-text transition-colors">Deliverables</span>
                    </label>
                    <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider dash-text-muted cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={filters.eventTypes.includes('payment')}
                            onChange={() => toggleEventType('payment')}
                            className="w-4 h-4 rounded border-slate-300 dark:border-white/10 text-brand-600 focus:ring-brand-500 bg-transparent"
                        />
                        <span className="group-hover:dash-text transition-colors">Payments</span>
                    </label>
                    <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider dash-text-muted cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={filters.eventTypes.includes('reminder')}
                            onChange={() => toggleEventType('reminder')}
                            className="w-4 h-4 rounded border-slate-300 dark:border-white/10 text-brand-600 focus:ring-brand-500 bg-transparent"
                        />
                        <span className="group-hover:dash-text transition-colors">Reminders</span>
                    </label>
                </div>

                {/* Status Pills */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 w-full sm:w-auto">
                    {['all', 'upcoming', 'overdue', 'completed'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatus(status)}
                            className={cn(
                                "px-3 py-1 text-[10px] uppercase font-bold tracking-widest rounded-full border transition-all whitespace-nowrap",
                                filters.status === status
                                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-black dark:border-white"
                                    : "dash-bg-card dash-text-muted dash-border hover:dash-text"
                            )}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
});
