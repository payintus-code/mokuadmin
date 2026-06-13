import { formatDate } from "@/lib/format";
import type { BookingStatus, DailyScheduleItem } from "@/types/database";

export type WorkQueueBucket = {
  key: "upcoming" | "in_progress" | "unpaid" | "overdue" | "hotel_today";
  title: string;
  description: string;
  items: DailyScheduleItem[];
};

export type WorkRiskAlert = {
  key: string;
  tone: "warning" | "danger";
  title: string;
  description: string;
  item: DailyScheduleItem;
};

export type ScheduleWorkFilter =
  | "all"
  | "todo"
  | "in_progress"
  | "unpaid"
  | "hotel"
  | "grooming";

const activeStatuses: BookingStatus[] = ["pending", "confirmed", "in_progress"];

export const scheduleWorkFilterLabels: Record<ScheduleWorkFilter, string> = {
  all: "ทั้งหมด",
  todo: "รอทำ",
  in_progress: "กำลังทำ",
  unpaid: "ค้างชำระ",
  hotel: "โรงแรม",
  grooming: "อาบน้ำ/ตัดขน"
};

export function isOperationalBooking(item: DailyScheduleItem) {
  return item.status !== "done" && item.status !== "cancelled";
}

export function getNextBookingStatus(status: BookingStatus): BookingStatus | null {
  if (status === "pending") return "confirmed";
  if (status === "confirmed") return "in_progress";
  if (status === "in_progress") return "done";
  return null;
}

export function getNextBookingStatusLabel(status: BookingStatus) {
  if (status === "pending") return "ยืนยันคิว";
  if (status === "confirmed") return "เริ่มงาน";
  if (status === "in_progress") return "ปิดงาน";
  return "";
}

export function getTodayKey(date = new Date()) {
  return formatDate(date, "yyyy-MM-dd");
}

function isSameLocalDate(value: string, dateKey: string) {
  return formatDate(value, "yyyy-MM-dd") === dateKey;
}

function sortByStartAt(items: DailyScheduleItem[]) {
  return [...items].sort((left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime());
}

export function filterScheduleWorkItems(items: DailyScheduleItem[], filter: ScheduleWorkFilter) {
  if (filter === "todo") {
    return items.filter((item) => item.status === "pending" || item.status === "confirmed");
  }

  if (filter === "in_progress") {
    return items.filter((item) => item.status === "in_progress");
  }

  if (filter === "unpaid") {
    return items.filter((item) => item.payment_status === "pending" && item.status !== "cancelled");
  }

  if (filter === "hotel") {
    return items.filter((item) => item.booking_type === "hotel");
  }

  if (filter === "grooming") {
    return items.filter((item) => item.booking_type === "grooming");
  }

  return items;
}

export function buildTodayWorkQueue(items: DailyScheduleItem[], now = new Date()): WorkQueueBucket[] {
  const nowTime = now.getTime();
  const todayKey = getTodayKey(now);
  const upcoming = sortByStartAt(
    items.filter((item) => activeStatuses.includes(item.status) && new Date(item.start_at).getTime() >= nowTime)
  ).slice(0, 6);
  const inProgress = sortByStartAt(items.filter((item) => item.status === "in_progress"));
  const unpaid = sortByStartAt(items.filter((item) => item.payment_status === "pending" && item.status !== "cancelled"));
  const overdue = sortByStartAt(
    items.filter((item) => activeStatuses.includes(item.status) && new Date(item.end_at).getTime() < nowTime)
  );
  const hotelToday = sortByStartAt(
    items.filter(
      (item) =>
        item.booking_type === "hotel" &&
        item.status !== "cancelled" &&
        (isSameLocalDate(item.start_at, todayKey) || isSameLocalDate(item.end_at, todayKey))
    )
  );

  return [
    {
      key: "upcoming",
      title: "กำลังจะถึง",
      description: "คิวถัดไปที่ยังต้องดูแล",
      items: upcoming
    },
    {
      key: "in_progress",
      title: "กำลังทำ",
      description: "งานที่เริ่มแล้วและยังไม่ปิด",
      items: inProgress
    },
    {
      key: "unpaid",
      title: "รอรับเงิน",
      description: "คิวที่ยังเก็บเงินไม่ครบ",
      items: unpaid
    },
    {
      key: "overdue",
      title: "เลยเวลาแล้ว",
      description: "ควรเช็กสถานะก่อนจบวัน",
      items: overdue
    },
    {
      key: "hotel_today",
      title: "เช็กอิน/เช็กเอาต์โรงแรมวันนี้",
      description: "คิวโรงแรมที่เกี่ยวข้องกับวันนี้",
      items: hotelToday
    }
  ];
}

export function buildWorkRiskAlerts(items: DailyScheduleItem[], now = new Date()) {
  const nowTime = now.getTime();
  const soonTime = nowTime + 30 * 60 * 1000;
  const todayKey = getTodayKey(now);
  const alerts: WorkRiskAlert[] = [];

  for (const item of sortByStartAt(items)) {
    const startTime = new Date(item.start_at).getTime();
    const endTime = new Date(item.end_at).getTime();

    if (activeStatuses.includes(item.status) && startTime >= nowTime && startTime <= soonTime) {
      alerts.push({
        key: `soon-${item.booking_id}`,
        tone: "warning",
        title: "คิวเริ่มใน 30 นาที",
        description: `${item.pet_name} ${formatDate(item.start_at, "HH.mm")}`,
        item
      });
    }

    if (activeStatuses.includes(item.status) && endTime < nowTime) {
      alerts.push({
        key: `overdue-${item.booking_id}`,
        tone: "danger",
        title: "คิวเลยเวลาแล้วยังไม่ปิด",
        description: `${item.pet_name} สิ้นสุด ${formatDate(item.end_at, "HH.mm")}`,
        item
      });
    }

    if (item.payment_status === "pending" && item.status !== "cancelled") {
      alerts.push({
        key: `unpaid-${item.booking_id}`,
        tone: "warning",
        title: "ยังไม่ได้รับเงินครบ",
        description: `${item.pet_name} ยอดรวม ${new Intl.NumberFormat("th-TH").format(item.total_amount)} บาท`,
        item
      });
    }

    if (item.booking_type === "hotel" && item.status !== "cancelled" && isSameLocalDate(item.end_at, todayKey)) {
      alerts.push({
        key: `checkout-${item.booking_id}`,
        tone: "warning",
        title: "โรงแรมถึงวันเช็กเอาต์",
        description: `${item.pet_name} ${formatDate(item.end_at, "HH.mm")}`,
        item
      });
    }
  }

  return alerts.slice(0, 8);
}
