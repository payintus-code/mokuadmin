import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { BookingPayment, PaymentMethod, ReceiptViewModel, ShopSettings } from "@/types/database";

type BookingPaymentSummary = {
  bookingId: string;
  bookingNo: string;
  bookingType: "grooming" | "hotel";
  bookingStatus: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  customerId: string | null;
  customerName: string;
  petName: string;
  roomName: string | null;
  servicesSummary: string;
  payment: BookingPayment | null;
  shop: ShopSettings;
  promptpayPayload: string | null;
  promptpayQrDataUrl: string | null;
};

const BUSINESS_TIME_ZONE = "Asia/Bangkok";

function toSingle<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateKey(date = new Date()) {
  return formatBusinessDate(date).replaceAll("-", "");
}

function formatBusinessDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function tlv(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16(payload: string) {
  let crc = 0xffff;

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8;

    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }

      crc &= 0xffff;
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function buildPromptPayTargetValue(target: string) {
  const digits = target.replace(/\D/g, "");

  if (digits.length === 13) {
    return tlv("02", digits);
  }

  if (digits.length === 10 && digits.startsWith("0")) {
    return tlv("01", `0066${digits.slice(1)}`);
  }

  throw new Error("PromptPay target is invalid");
}

export function buildPromptPayPayload(target: string, amount: number) {
  const merchantAccountInfo = tlv("29", `${tlv("00", "A000000677010111")}${buildPromptPayTargetValue(target)}`);
  const amountText = amount > 0 ? tlv("54", amount.toFixed(2)) : "";
  const body = [tlv("00", "01"), tlv("01", amount > 0 ? "12" : "11"), merchantAccountInfo, tlv("58", "TH"), tlv("53", "764"), amountText, tlv("62", "")].join("");

  return `${body}6304${crc16(`${body}6304`)}`;
}

async function getShopSettingsRecord() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_settings")
    .select("id, shop_name, shop_address, shop_phone, promptpay_target, receipt_prefix")
    .eq("id", 1)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Shop settings not found");
  }

  return data as ShopSettings;
}

async function generateReceiptNo(prefix: string, issuedAt: Date) {
  const supabase = createAdminClient();
  const dayKey = formatDateKey(issuedAt);
  const start = `${issuedAt.toISOString().slice(0, 10)}T00:00:00.000Z`;
  const end = `${issuedAt.toISOString().slice(0, 10)}T23:59:59.999Z`;
  const { count, error } = await supabase
    .from("booking_payments")
    .select("*", { count: "exact", head: true })
    .gte("receipt_issued_at", start)
    .lte("receipt_issued_at", end);

  if (error) {
    throw new Error(error.message);
  }

  return `${prefix}${dayKey}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export async function prepareBookingPayment(bookingId: string): Promise<BookingPaymentSummary> {
  const supabase = await createClient();
  const shop = await getShopSettingsRecord();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
        id,
        booking_no,
        booking_type,
        status,
        total_amount,
        customer_id,
        customers!inner(full_name),
        pets!bookings_pet_id_fkey!inner(name),
        secondary_pets:pets!bookings_secondary_pet_id_fkey(name),
        rooms(name),
        booking_items(qty, unit_price, services(name)),
        booking_payments(id, booking_id, amount, method, status, reference_no, receipt_no, receipt_issued_at, paid_at, note)
      `
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Booking not found");
  }

  const customer = toSingle(data.customers);
  const primaryPet = toSingle(data.pets);
  const secondaryPet = toSingle(data.secondary_pets);
  const room = toSingle(data.rooms);
  const payment = toSingle(data.booking_payments) as BookingPayment | null;
  const paidAmount = Number(payment?.amount ?? 0);
  const totalAmount = Number(data.total_amount);
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);
  const promptpayPayload = shop.promptpay_target && remainingAmount > 0 ? buildPromptPayPayload(shop.promptpay_target, remainingAmount) : null;
  const promptpayQrDataUrl = promptpayPayload ? await QRCode.toDataURL(promptpayPayload, { margin: 1, width: 320 }) : null;

  return {
    bookingId: data.id,
    bookingNo: data.booking_no,
    bookingType: data.booking_type,
    bookingStatus: data.status,
    totalAmount,
    paidAmount,
    remainingAmount,
    customerId: data.customer_id ?? null,
    customerName: customer?.full_name ?? "-",
    petName: [primaryPet?.name, secondaryPet?.name].filter((name): name is string => Boolean(name)).join(", ") || "-",
    roomName: room?.name ?? null,
    servicesSummary:
      data.booking_items
        ?.map((item: { services?: { name?: string }[] | { name?: string } | null }) => toSingle(item.services)?.name)
        .filter((name: string | undefined): name is string => Boolean(name))
        .join(", ") ?? "",
    payment,
    shop,
    promptpayPayload,
    promptpayQrDataUrl
  };
}

async function syncBookingIncomeTransaction(input: {
  supabase: ReturnType<typeof createAdminClient>;
  bookingId: string;
  bookingType: "grooming" | "hotel";
  bookingNo: string;
  customerId: string | null;
  amount: number;
  method: PaymentMethod;
  note: string | null;
  transactionDate: string;
}) {
  const { data: existingIncomeRows, error: existingIncomeError } = await input.supabase
    .from("cash_transactions")
    .select("id, amount, transaction_date, created_at")
    .eq("booking_id", input.bookingId)
    .eq("transaction_type", "income")
    .order("transaction_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (existingIncomeError) {
    throw new Error(existingIncomeError.message);
  }

  const existingIncome = (existingIncomeRows ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount ?? 0)
  }));
  const nextAmount = Number(input.amount.toFixed(2));
  const existingAmount = existingIncome.reduce((sum, row) => sum + row.amount, 0);
  const amountDelta = Number((nextAmount - existingAmount).toFixed(2));

  if (nextAmount <= 0) {
    if (existingIncome.length) {
      const existingIds = existingIncome.map((row) => row.id);
      const { error: deleteIncomeError } = await input.supabase.from("cash_transactions").delete().in("id", existingIds);

      if (deleteIncomeError) {
        throw new Error(deleteIncomeError.message);
      }
    }

    return;
  }

  const incomePayload = {
    transaction_type: "income",
    category: input.bookingType === "hotel" ? "hotel_income" : "service_income",
    booking_id: input.bookingId,
    customer_id: input.customerId,
    title: input.bookingType === "hotel" ? `ชำระค่าโรงแรม ${input.bookingNo}` : `ชำระค่าบริการ ${input.bookingNo}`,
    payment_method: input.method,
    note: input.note
  };

  if (amountDelta > 0.0001) {
    const { error: insertIncomeError } = await input.supabase.from("cash_transactions").insert({
      ...incomePayload,
      amount: amountDelta,
      transaction_date: input.transactionDate
    });

    if (insertIncomeError) {
      throw new Error(insertIncomeError.message);
    }

    return;
  }

  if (amountDelta < -0.0001) {
    let remainingToReduce = Math.abs(amountDelta);

    for (const row of [...existingIncome].reverse()) {
      if (remainingToReduce <= 0.0001) {
        break;
      }

      if (row.amount <= remainingToReduce + 0.0001) {
        const { error: deleteIncomeError } = await input.supabase.from("cash_transactions").delete().eq("id", row.id);

        if (deleteIncomeError) {
          throw new Error(deleteIncomeError.message);
        }

        remainingToReduce = Number((remainingToReduce - row.amount).toFixed(2));
        continue;
      }

      const { error: updateIncomeError } = await input.supabase
        .from("cash_transactions")
        .update({
          ...incomePayload,
          amount: Number((row.amount - remainingToReduce).toFixed(2))
        })
        .eq("id", row.id);

      if (updateIncomeError) {
        throw new Error(updateIncomeError.message);
      }

      remainingToReduce = 0;
    }

    if (remainingToReduce > 0.0001) {
      throw new Error("Unable to reconcile booking income transactions");
    }

    return;
  }

  const latestIncome = existingIncome.at(-1);

  if (latestIncome) {
    const { error: updateIncomeError } = await input.supabase
      .from("cash_transactions")
      .update(incomePayload)
      .eq("id", latestIncome.id);

    if (updateIncomeError) {
      throw new Error(updateIncomeError.message);
    }
  }
}

export async function createOrUpdateBookingPayment(input: {
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  referenceNo?: string;
  note?: string;
  actorUserId?: string | null;
}) {
  const supabase = createAdminClient();
  const paymentInfo = await prepareBookingPayment(input.bookingId);

  if (paymentInfo.bookingStatus === "cancelled") {
    throw new Error("Cannot receive payment for a cancelled booking");
  }

  if (input.method === "promptpay_qr" && !paymentInfo.shop.promptpay_target) {
    throw new Error("PromptPay is not configured for this shop");
  }

  if (Number.isNaN(input.amount) || input.amount <= 0) {
    throw new Error("Payment amount is invalid");
  }

  const nextAmount = Number((paymentInfo.paidAmount + input.amount).toFixed(2));
  const hasKnownTotal = paymentInfo.totalAmount > 0;

  if (hasKnownTotal && nextAmount - paymentInfo.totalAmount > 0.0001) {
    throw new Error("Payment exceeds booking total");
  }

  const paidAt = new Date();
  const nextStatus = hasKnownTotal && nextAmount >= paymentInfo.totalAmount ? "paid" : "pending";
  const receiptNo =
    nextStatus === "paid" ? paymentInfo.payment?.receipt_no ?? (await generateReceiptNo(paymentInfo.shop.receipt_prefix, paidAt)) : null;

  const upsertPayload = {
    booking_id: input.bookingId,
    amount: nextAmount,
    method: input.method,
    status: nextStatus,
    reference_no: input.referenceNo?.trim() || null,
    receipt_no: receiptNo,
    receipt_issued_at:
      nextStatus === "paid" ? paymentInfo.payment?.receipt_issued_at ?? paidAt.toISOString() : paymentInfo.payment?.receipt_issued_at ?? null,
    paid_at: nextStatus === "paid" ? paymentInfo.payment?.paid_at ?? paidAt.toISOString() : null,
    note: input.note?.trim() || null,
    confirmed_by: input.actorUserId ?? null
  };

  const { error: paymentError } = await supabase.from("booking_payments").upsert(upsertPayload, { onConflict: "booking_id" });

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  await syncBookingIncomeTransaction({
    supabase,
    bookingId: input.bookingId,
    bookingType: paymentInfo.bookingType,
    bookingNo: paymentInfo.bookingNo,
    customerId: paymentInfo.customerId,
    amount: nextAmount,
    method: input.method,
    note: input.note?.trim() || null,
    transactionDate: formatBusinessDate(paidAt)
  });

  return {
    receiptNo,
    status: nextStatus,
    paidAmount: nextAmount,
    remainingAmount: hasKnownTotal ? Math.max(paymentInfo.totalAmount - nextAmount, 0) : 0
  };
}

export async function updateBookingPayment(input: {
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  referenceNo?: string;
  note?: string;
  actorUserId?: string | null;
}) {
  const supabase = createAdminClient();
  const paymentInfo = await prepareBookingPayment(input.bookingId);

  if (!paymentInfo.payment) {
    throw new Error("Payment record not found");
  }

  if (paymentInfo.bookingStatus === "cancelled") {
    throw new Error("Cannot edit payment for a cancelled booking");
  }

  if (input.method === "promptpay_qr" && !paymentInfo.shop.promptpay_target) {
    throw new Error("PromptPay is not configured for this shop");
  }

  if (Number.isNaN(input.amount) || input.amount < 0) {
    throw new Error("Payment amount is invalid");
  }

  const nextAmount = Number(input.amount.toFixed(2));
  const hasKnownTotal = paymentInfo.totalAmount > 0;

  if (hasKnownTotal && nextAmount - paymentInfo.totalAmount > 0.0001) {
    throw new Error("Payment exceeds booking total");
  }

  if (nextAmount === 0) {
    const { error: deletePaymentError } = await supabase.from("booking_payments").delete().eq("booking_id", input.bookingId);

    if (deletePaymentError) {
      throw new Error(deletePaymentError.message);
    }

    await syncBookingIncomeTransaction({
      supabase,
      bookingId: input.bookingId,
      bookingType: paymentInfo.bookingType,
      bookingNo: paymentInfo.bookingNo,
      customerId: paymentInfo.customerId,
      amount: 0,
      method: input.method,
      note: input.note?.trim() || null,
      transactionDate: formatBusinessDate()
    });

    return {
      receiptNo: null,
      status: "pending" as const,
      paidAmount: 0,
      remainingAmount: hasKnownTotal ? paymentInfo.totalAmount : 0
    };
  }

  const paidAt = new Date();
  const nextStatus = hasKnownTotal && nextAmount >= paymentInfo.totalAmount ? "paid" : "pending";
  const receiptNo =
    nextStatus === "paid" ? paymentInfo.payment.receipt_no ?? (await generateReceiptNo(paymentInfo.shop.receipt_prefix, paidAt)) : null;

  const { error: paymentError } = await supabase
    .from("booking_payments")
    .update({
      amount: nextAmount,
      method: input.method,
      status: nextStatus,
      reference_no: input.referenceNo?.trim() || null,
      receipt_no: receiptNo,
      receipt_issued_at: nextStatus === "paid" ? paymentInfo.payment.receipt_issued_at ?? paidAt.toISOString() : null,
      paid_at: nextStatus === "paid" ? paymentInfo.payment.paid_at ?? paidAt.toISOString() : null,
      note: input.note?.trim() || null,
      confirmed_by: input.actorUserId ?? null
    })
    .eq("booking_id", input.bookingId);

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  await syncBookingIncomeTransaction({
    supabase,
    bookingId: input.bookingId,
    bookingType: paymentInfo.bookingType,
    bookingNo: paymentInfo.bookingNo,
    customerId: paymentInfo.customerId,
    amount: nextAmount,
    method: input.method,
    note: input.note?.trim() || null,
    transactionDate: formatBusinessDate(paidAt)
  });

  return {
    receiptNo,
    status: nextStatus,
    paidAmount: nextAmount,
    remainingAmount: hasKnownTotal ? Math.max(paymentInfo.totalAmount - nextAmount, 0) : 0
  };
}

export async function confirmBookingPayment(input: {
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  referenceNo?: string;
  note?: string;
  actorUserId?: string | null;
}) {
  return createOrUpdateBookingPayment(input);
}

export async function getReceiptData(bookingId: string): Promise<ReceiptViewModel> {
  const paymentInfo = await prepareBookingPayment(bookingId);

  if (!paymentInfo.payment || paymentInfo.payment.status !== "paid" || !paymentInfo.payment.receipt_no || !paymentInfo.payment.paid_at) {
    throw new Error("Receipt is not available for this booking yet");
  }

  return {
    booking_id: paymentInfo.bookingId,
    booking_no: paymentInfo.bookingNo,
    receipt_no: paymentInfo.payment.receipt_no,
    receipt_issued_at: paymentInfo.payment.receipt_issued_at ?? paymentInfo.payment.paid_at,
    shop_name: paymentInfo.shop.shop_name,
    shop_address: paymentInfo.shop.shop_address,
    shop_phone: paymentInfo.shop.shop_phone,
    customer_name: paymentInfo.customerName,
    pet_name: paymentInfo.petName,
    booking_type: paymentInfo.bookingType,
    services_summary: paymentInfo.servicesSummary,
    room_name: paymentInfo.roomName,
    total_amount: paymentInfo.totalAmount,
    payment_method: paymentInfo.payment.method,
    paid_at: paymentInfo.payment.paid_at
  };
}
