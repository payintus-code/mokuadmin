import type { PaymentStatus } from "@/types/database";

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const isPaid = status === "paid";

  return (
    <span className={`status-badge payment-status-${isPaid ? "paid" : "pending"}`}>
      {isPaid ? "ชำระเงินแล้ว" : "ยังไม่ชำระเงิน"}
    </span>
  );
}
