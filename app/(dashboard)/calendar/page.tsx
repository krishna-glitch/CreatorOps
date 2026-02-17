import dynamic from "next/dynamic";

const CalendarView = dynamic(
  () => import("@/src/components/calendar/CalendarView"),
  {
    loading: () => (
      <div className="rounded-2xl border dash-border dash-bg-card p-8 text-center dash-text-muted">
        Loading calendar...
      </div>
    ),
  },
);

export const metadata = {
  title: "Calendar | CreatorOps",
  description: "View your upcoming deliverables and payments",
};

export default function CalendarPage() {
  return (
    <div className="flex h-full flex-col dash-bg-panel">
      <div className="border-b dash-border dash-bg-card px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold dash-text">Calendar</h1>
          <p className="text-sm dash-text-muted">
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
