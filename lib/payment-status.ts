import type { PaymentStatus } from "@/types/database";

export function resolvePaymentStatus(input: {
  totalAmount: number;
  paidAmount: number;
  storedStatus?: PaymentStatus | null;
}): PaymentStatus {
  const totalAmount = Number(input.totalAmount ?? 0);
  const paidAmount = Number(input.paidAmount ?? 0);
  const storedStatus = input.storedStatus ?? "pending";

  if (storedStatus === "cancelled") {
    return "cancelled";
  }

  if (totalAmount > 0 && paidAmount >= totalAmount) {
    return "paid";
  }

  return storedStatus;
}
