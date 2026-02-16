"use client";

import * as Popover from "@radix-ui/react-popover";
import { Settings, X } from "lucide-react";
import { View, Views } from "react-big-calendar";

interface CalendarSettingsProps {
    preferences: {
        defaultView: View;
        weekStartsOn: 0 | 1;
        showWeekends: boolean;
        eventDensity: 'compact' | 'comfortable' | 'spacious';
    };
    setPreference: (key: string, value: string | number | boolean) => void;
}

export function CalendarSettings({ preferences, setPreference }: CalendarSettingsProps) {
    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
                    <Settings className="w-5 h-5" />
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className="w-72 bg-white rounded-lg shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-200"
                    sideOffset={5}
                    align="end"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-900">Calendar Settings</h3>
                        <Popover.Close className="text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                        </Popover.Close>
                    </div>

                    <div className="space-y-4">
                        {/* Default View */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Default View</label>
                            <select
                                value={preferences.defaultView}
                                onChange={(e) => setPreference('defaultView', e.target.value)}
                                className="w-full rounded-md border border-slate-300 text-sm py-1.5 px-2 focus:ring-2 focus:ring-brand-500 outline-none"
                            >
                                <option value={Views.MONTH}>Month</option>
                                <option value={Views.WEEK}>Week</option>
                                <option value={Views.DAY}>Day</option>
                                <option value={Views.AGENDA}>Agenda</option>
                            </select>
                        </div>

                        {/* Week Starts On */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Week Starts On</label>
                            <div className="flex rounded-md border border-slate-300 overflow-hidden">
                                <button
                                    onClick={() => setPreference('weekStartsOn', 0)}
                                    className={`flex-1 py-1.5 text-sm ${preferences.weekStartsOn === 0 ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    Sunday
                                </button>
                                <div className="w-px bg-slate-300" />
                                <button
                                    onClick={() => setPreference('weekStartsOn', 1)}
                                    className={`flex-1 py-1.5 text-sm ${preferences.weekStartsOn === 1 ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    Monday
                                </button>
                            </div>
                        </div>

                        {/* Show Weekends */}
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-700">Show Weekends</label>
                            <button
                                onClick={() => setPreference('showWeekends', !preferences.showWeekends)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${preferences.showWeekends ? 'bg-brand-600' : 'bg-slate-200'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${preferences.showWeekends ? 'translate-x-4.5' : 'translate-x-0.5'
                                        }`}
                                />
                            </button>
                        </div>

                        {/* Event Density */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Event Density</label>
                            <select
                                value={preferences.eventDensity}
                                onChange={(e) => setPreference('eventDensity', e.target.value)}
                                className="w-full rounded-md border border-slate-300 text-sm py-1.5 px-2 focus:ring-2 focus:ring-brand-500 outline-none"
                            >
                                <option value="compact">Compact</option>
                                <option value="comfortable">Comfortable</option>
                                <option value="spacious">Spacious</option>
                            </select>
                        </div>

                    </div>

                    <Popover.Arrow className="fill-white" />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
