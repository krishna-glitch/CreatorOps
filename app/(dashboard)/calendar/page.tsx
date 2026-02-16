import CalendarView from "@/src/components/calendar/CalendarView";

export const metadata = {
  title: "Calendar | CreatorOps",
  description: "View your upcoming deliverables and payments",
};

export default function CalendarPage() {
  return (
    <div className="flex h-full flex-col bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
          <p className="text-sm text-slate-500">
            Manage your schedule, deadlines, and payments
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-6">
        <CalendarView />
      </div>
    </div>
  );
}
