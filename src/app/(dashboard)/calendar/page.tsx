import CalendarView from "@/src/components/calendar/CalendarView";

export const metadata = {
    title: "Calendar | CreatorOps",
    description: "View your upcoming deliverables and payments",
};

export default function CalendarPage() {
    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
                    <p className="text-sm text-slate-500">
                        Manage your schedule, deadlines, and payments
                    </p>
                </div>
            </div>

            <div className="flex-1 p-6 overflow-hidden">
                <CalendarView />
            </div>
        </div>
    );
}
