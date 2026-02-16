"use client";

import { Button } from "@/components/ui/button"; // Assuming standard button exists or I'll use raw generic if not
// Checking `src/components/ui` earlier showed only BottomSheet, ContextMenu, QuickActionSheet. 
// I should probably check if Button exists or just use standard HTML button with tailwind classes.
// The user has `lucide-react` installed.

import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { format, addMonths, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, subWeeks, addDays, subDays } from "date-fns";
import { View, Views } from "react-big-calendar";
import { cn } from "@/lib/utils"; // Assuming utils exists, common in shadcn
// If not, I'll define a simple cn helper or just use string templates.
// I'll check lib/utils existence shortly, but generic implementation is safer for now.

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

export function CalendarFilters({
    date,
    setDate,
    view,
    setView,
    filters,
    setFilters,
}: CalendarFiltersProps) {

    const handleNavigate = (action: 'PREV' | 'NEXT' | 'TODAY') => {
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
    };

    const toggleEventType = (type: string) => {
        const current = filters.eventTypes;
        const next = current.includes(type)
            ? current.filter(t => t !== type)
            : [...current, type];
        setFilters({ ...filters, eventTypes: next });
    };

    const setStatus = (status: string) => {
        setFilters({ ...filters, status });
    };

    const dateLabel = () => {
        if (view === Views.MONTH) return format(date, 'MMMM yyyy');
        if (view === Views.WEEK) {
            const start = startOfWeek(date);
            const end = endOfWeek(date);
            return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
        }
        if (view === Views.DAY) return format(date, 'EEEE, MMMM d, yyyy');
        return format(date, 'MMMM yyyy');
    };

    return (
        <div className="flex flex-col gap-4 p-4 bg-white border-b border-slate-200">
            {/* Top Row: Navigation & Main Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleNavigate('TODAY')}
                        className="px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md border border-slate-300"
                    >
                        Today
                    </button>
                    <div className="flex items-center rounded-md border border-slate-300 bg-white">
                        <button onClick={() => handleNavigate('PREV')} className="p-1.5 hover:bg-slate-100 text-slate-600">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleNavigate('NEXT')} className="p-1.5 hover:bg-slate-100 text-slate-600">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <span className="ml-2 text-lg font-semibold text-slate-800">
                        {dateLabel()}
                    </span>
                </div>

                {/* View Switcher (Desktop usually, but here simple text buttons for now) */}
                {/* Actually settings popover might handle default view, but usually view switcher is on toolbar */}
                <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-1">
                    {[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA].map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${view === v
                                    ? 'bg-white text-brand-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {v === Views.AGENDA ? 'Agenda' : v.charAt(0).toUpperCase() + v.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Second Row: Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">

                {/* Event Types */}
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={filters.eventTypes.includes('deliverable')}
                            onChange={() => toggleEventType('deliverable')}
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        Deliverables
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={filters.eventTypes.includes('payment')}
                            onChange={() => toggleEventType('payment')}
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        Payments
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={filters.eventTypes.includes('reminder')}
                            onChange={() => toggleEventType('reminder')}
                            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        Reminders
                    </label>
                </div>

                {/* Status Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                    {['all', 'upcoming', 'overdue', 'completed'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatus(status)}
                            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${filters.status === status
                                    ? 'bg-slate-800 text-white border-slate-800'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
