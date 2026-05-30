import type { PaymentStatus } from "@/types/database";

const labelMap: Record<PaymentStatus, string> = {
  pending: "ยังไม่จ่าย",
  paid: "จ่ายแล้ว",
  cancelled: "ยกเลิกการจ่าย"
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <span className={`status-badge payment-status-${status}`}>{labelMap[status]}</span>;
}
