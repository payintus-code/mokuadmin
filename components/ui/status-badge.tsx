import type { BookingStatus } from "@/types/database";

const labelMap: Record<BookingStatus, string> = {
  pending: "รอยืนยัน",
  confirmed: "ยืนยันแล้ว",
  in_progress: "กำลังทำ",
  done: "เสร็จแล้ว",
  cancelled: "ยกเลิก"
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`status-badge status-${status}`}>{labelMap[status]}</span>;
}
