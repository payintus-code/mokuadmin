import type { PaymentCollectionType } from "@/types/database";

export type DraftValidationResult = {
  ok: boolean;
  blocking: boolean;
  message: string;
};

export type PaymentDraftSummary = DraftValidationResult & {
  totalAmount: number;
  receivedAmount: number;
  remainingAmount: number;
};

function toTimestamp(value: string) {
  const parsed = new Date(value);
  return parsed.getTime();
}

export function isEndAfterStart(startAt: string, endAt: string) {
  const startTime = toTimestamp(startAt);
  const endTime = toTimestamp(endAt);

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return false;
  }

  return endTime > startTime;
}

export function validateHotelStayDates(startAt: string, endAt: string): DraftValidationResult {
  if (!startAt || !endAt) {
    return {
      ok: false,
      blocking: true,
      message: "กรุณาเลือกวันเช็กอินและเช็กเอาต์"
    };
  }

  if (!isEndAfterStart(startAt, endAt)) {
    return {
      ok: false,
      blocking: true,
      message: "วันที่เช็กเอาต์ต้องหลังวันที่เช็กอิน"
    };
  }

  return {
    ok: true,
    blocking: false,
    message: "ช่วงวันเข้าพักถูกต้อง"
  };
}

export function validatePaymentDraft(input: {
  showPaymentNow: boolean;
  paymentCollectionType: PaymentCollectionType;
  totalAmount: number;
  receivedAmount: number;
}): PaymentDraftSummary {
  const totalAmount = Math.max(0, Math.round(input.totalAmount || 0));
  const receivedAmount = Math.max(0, Math.round(input.receivedAmount || 0));
  const remainingAmount = Math.max(totalAmount - receivedAmount, 0);

  if (!input.showPaymentNow || input.paymentCollectionType === "none") {
    if (input.showPaymentNow && receivedAmount > 0) {
      return {
        ok: false,
        blocking: true,
        message: "เลือกประเภทการรับเงินก่อนบันทึกยอดที่รับ",
        totalAmount,
        receivedAmount,
        remainingAmount
      };
    }

    return {
      ok: true,
      blocking: false,
      message: "ยังไม่รับเงินตอนสร้างคิว",
      totalAmount,
      receivedAmount,
      remainingAmount
    };
  }

  if (receivedAmount <= 0) {
    return {
      ok: false,
      blocking: true,
      message: "กรุณากรอกจำนวนเงินที่รับ",
      totalAmount,
      receivedAmount,
      remainingAmount
    };
  }

  if (totalAmount <= 0) {
    return {
      ok: false,
      blocking: true,
      message: "กรุณาระบุยอดรวมก่อนรับเงิน",
      totalAmount,
      receivedAmount,
      remainingAmount
    };
  }

  if (receivedAmount > totalAmount) {
    return {
      ok: false,
      blocking: true,
      message: "จำนวนเงินที่รับต้องไม่เกินยอดรวม",
      totalAmount,
      receivedAmount,
      remainingAmount
    };
  }

  if (input.paymentCollectionType === "deposit" && receivedAmount >= totalAmount) {
    return {
      ok: false,
      blocking: true,
      message: "มัดจำต้องน้อยกว่ายอดรวม",
      totalAmount,
      receivedAmount,
      remainingAmount
    };
  }

  if (input.paymentCollectionType === "full" && receivedAmount !== totalAmount) {
    return {
      ok: false,
      blocking: true,
      message: "รับเต็มจำนวนต้องเท่ากับยอดรวม",
      totalAmount,
      receivedAmount,
      remainingAmount
    };
  }

  return {
    ok: true,
    blocking: false,
    message:
      input.paymentCollectionType === "deposit"
        ? `รับมัดจำแล้ว ${receivedAmount} บาท คงเหลือ ${remainingAmount} บาท`
        : "ยอดรับเงินตรงกับยอดรวมแล้ว",
    totalAmount,
    receivedAmount,
    remainingAmount
  };
}
