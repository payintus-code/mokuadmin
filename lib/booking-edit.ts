import type { PaymentStatus } from "@/types/database";

export type BookingAmountEditValidation = {
  ok: boolean;
  message: string;
};

export function validateBookingAmountEdit(input: {
  currentTotalAmount: number;
  nextTotalAmount: number;
  paidAmount: number;
  paymentStatus?: PaymentStatus | null;
  receiptNo?: string | null;
}): BookingAmountEditValidation {
  const currentTotalAmount = Number(input.currentTotalAmount);
  const nextTotalAmount = Number(input.nextTotalAmount);
  const paidAmount = Number(input.paidAmount ?? 0);

  if (!Number.isFinite(nextTotalAmount) || nextTotalAmount < 0 || !Number.isInteger(nextTotalAmount)) {
    return {
      ok: false,
      message: "ยอดรวมต้องเป็นจำนวนเต็มตั้งแต่ 0 บาทขึ้นไป"
    };
  }

  if (
    input.paymentStatus === "paid" &&
    input.receiptNo &&
    nextTotalAmount !== currentTotalAmount
  ) {
    return {
      ok: false,
      message: "ไม่สามารถแก้ยอดรวมของคิวที่ชำระครบและออกใบเสร็จแล้ว"
    };
  }

  if (nextTotalAmount < paidAmount) {
    return {
      ok: false,
      message: `ยอดรวมต้องไม่น้อยกว่ายอดที่รับแล้ว ${paidAmount} บาท`
    };
  }

  return {
    ok: true,
    message: ""
  };
}

export function getBookingDurationMinutes(startAt: string, endAt: string) {
  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime <= startTime) {
    return null;
  }

  return Math.round((endTime - startTime) / 60_000);
}
