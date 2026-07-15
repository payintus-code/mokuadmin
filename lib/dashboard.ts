import type { BookingStatus, DailyScheduleItem } from "@/types/database";

export const PENDING_DASHBOARD_STATUSES: BookingStatus[] = ["pending", "confirmed", "in_progress"];

export function partitionDashboardQueues(today: DailyScheduleItem[], unpaid: DailyScheduleItem[]) {
  const pending = new Set<BookingStatus>(PENDING_DASHBOARD_STATUSES);
  return {
    todayAll: today,
    todayPending: today.filter((item) => pending.has(item.status)),
    todayDone: today.filter((item) => item.status === "done"),
    unpaid
  };
}
