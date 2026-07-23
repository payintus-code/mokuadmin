import type { BookingStatus, DailyScheduleItem } from "@/types/database";

export const PENDING_DASHBOARD_STATUSES: BookingStatus[] = ["pending", "confirmed", "in_progress"];

export function canReceiveBookingPayment(item: Pick<DailyScheduleItem, "status" | "payment_status">): boolean {
  return item.status !== "cancelled" && item.payment_status !== "paid";
}

export function partitionDashboardQueues(today: DailyScheduleItem[], unpaid: DailyScheduleItem[]) {
  const pending = new Set<BookingStatus>(PENDING_DASHBOARD_STATUSES);
  return {
    todayAll: today,
    todayPending: today.filter((item) => pending.has(item.status)),
    todayDone: today.filter((item) => item.status === "done"),
    unpaid
  };
}
