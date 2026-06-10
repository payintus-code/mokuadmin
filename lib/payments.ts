import QRCode from "qrcode";
import { resolvePaymentStatus } from "@/lib/payment-status";
import { buildNextReceiptNo, getReceiptNoBase } from "@/lib/receipt-numbers";
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
  paymentStatus: BookingPayment["status"];
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

type DatabaseWriteError = {
  code?: string;
  message: string;
  details?: string | null;
};

const BUSINESS_TIME_ZONE = "Asia/Bangkok";
const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  id: 1,
  shop_name: "",
  shop_address: null,
  shop_phone: null,
  promptpay_target: null,
  bank_code: null,
  bank_name: null,
  bank_account_no: null,
  bank_account_name: null,
  receipt_prefix: "RC"
};

function toSingle<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatBusinessDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function isReceiptNoUniqueConflict(error: DatabaseWriteError) {
  const message = `${error.message} ${error.details ?? ""}`;
  return error.code === "23505" && message.includes("booking_payments_receipt_no_key");
}

function tlv(id: string, value: string) {
  return `${id}${String(Buffer.byteLength(value, "utf8")).padStart(2, "0")}${value}`;
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

export async function generatePromptPayQrForAmount(amount: number) {
  const shop = await getShopSettingsRecord(true);

  if (!shop.promptpay_target) {
    throw new Error("PromptPay is not configured for this shop");
  }

  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error("PromptPay QR amount is invalid");
  }

  const roundedAmount = Number(amount.toFixed(2));
  const payload = buildPromptPayPayload(shop.promptpay_target, roundedAmount);
  const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 320 });

  return {
    qrDataUrl,
    payload,
    amount: roundedAmount
  };
}

function normalizeQrText(value: string | null | undefined, fallback: string, maxLength: number) {
  const normalized = (value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  return (normalized || fallback).slice(0, maxLength);
}

function getBankAccountQrTarget(shop: Pick<ShopSettings, "bank_code" | "bank_account_no">) {
  const bankCode = shop.bank_code?.replace(/\D/g, "") ?? "";
  const accountNo = shop.bank_account_no?.replace(/\D/g, "") ?? "";
  const target = `${bankCode}${accountNo}`;

  if (bankCode.length !== 3 || accountNo.length < 1 || target.length > 43) {
    throw new Error("Bank account QR target is invalid");
  }

  return target;
}

export function hasBankAccountQrSettings(shop: Pick<ShopSettings, "bank_code" | "bank_account_no" | "bank_account_name">) {
  return Boolean(shop.bank_code?.trim() && shop.bank_account_no?.trim() && shop.bank_account_name?.trim());
}

export function buildBankAccountQrPayload(shop: Pick<ShopSettings, "bank_code" | "bank_account_no" | "bank_account_name" | "shop_name">, amount: number) {
  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error("Bank account QR amount is invalid");
  }

  const bankAccountInfo = tlv("04", getBankAccountQrTarget(shop));
  const amountText = tlv("54", amount.toFixed(2));
  const merchantName = tlv("59", normalizeQrText(shop.bank_account_name ?? shop.shop_name, "MOKU PET", 25));
  const merchantCity = tlv("60", "BANGKOK");
  const body = [
    tlv("00", "01"),
    tlv("01", "12"),
    bankAccountInfo,
    tlv("52", "0000"),
    tlv("53", "764"),
    amountText,
    tlv("58", "TH"),
    merchantName,
    merchantCity
  ].join("");

  return `${body}6304${crc16(`${body}6304`)}`;
}

async function getShopSettingsRecord(useAdminClient = false) {
  const supabase = useAdminClient ? createAdminClient() : await createClient();
  const { data, error } = await supabase
    .from("shop_settings")
    .select("id, shop_name, shop_address, shop_phone, promptpay_target, bank_code, bank_name, bank_account_no, bank_account_name, receipt_prefix")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    if (error.code === "42703" || error.message.includes("bank_")) {
      const { data: legacyData, error: legacyError } = await supabase
        .from("shop_settings")
        .select("id, shop_name, shop_address, shop_phone, promptpay_target, receipt_prefix")
        .eq("id", 1)
        .maybeSingle();

      if (legacyError) {
        throw new Error(legacyError.message);
      }

      if (!legacyData) {
        return DEFAULT_SHOP_SETTINGS;
      }

      return {
        ...DEFAULT_SHOP_SETTINGS,
        ...legacyData
      } as ShopSettings;
    }

    throw new Error(error.message);
  }

  if (!data) {
    return DEFAULT_SHOP_SETTINGS;
  }

  return {
    ...DEFAULT_SHOP_SETTINGS,
    ...data
  } as ShopSettings;
}

async function generateReceiptNo(prefix: string, issuedAt: Date, offset = 0) {
  const supabase = createAdminClient();
  const base = getReceiptNoBase(prefix, issuedAt);
  const { data, error } = await supabase
    .from("booking_payments")
    .select("receipt_no")
    .gte("receipt_no", base)
    .lt("receipt_no", `${base}\uffff`)
    .order("receipt_no", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(error.message);
  }

  return buildNextReceiptNo(
    prefix,
    issuedAt,
    (data ?? []).map((row) => row.receipt_no),
    offset
  );
}

export async function prepareBookingPayment(bookingId: string, options?: { useAdminClient?: boolean }): Promise<BookingPaymentSummary> {
  const useAdminClient = options?.useAdminClient ?? false;
  const supabase = useAdminClient ? createAdminClient() : await createClient();
  const shop = await getShopSettingsRecord(useAdminClient);
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
  const paymentStatus = resolvePaymentStatus({
    totalAmount,
    paidAmount,
    storedStatus: payment?.status ?? "pending"
  });
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);
  let promptpayPayload: string | null = null;
  let promptpayQrDataUrl: string | null = null;

  if (shop.promptpay_target && remainingAmount > 0) {
    try {
      promptpayPayload = buildPromptPayPayload(shop.promptpay_target, remainingAmount);
      promptpayQrDataUrl = await QRCode.toDataURL(promptpayPayload, { margin: 1, width: 320 });
    } catch (error) {
      console.error("Unable to generate PromptPay QR for booking payment", {
        bookingId,
        promptpayTarget: shop.promptpay_target,
        remainingAmount,
        error: error instanceof Error ? error.message : error
      });
      promptpayPayload = null;
      promptpayQrDataUrl = null;
    }
  }

  return {
    bookingId: data.id,
    bookingNo: data.booking_no,
    bookingType: data.booking_type,
    bookingStatus: data.status,
    totalAmount,
    paidAmount,
    remainingAmount,
    paymentStatus,
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

export async function generateBankAccountQrForAmount(amount: number) {
  const shop = await getShopSettingsRecord(true);

  if (!hasBankAccountQrSettings(shop)) {
    throw new Error("Bank account QR is not configured for this shop");
  }

  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error("Bank account QR amount is invalid");
  }

  const roundedAmount = Number(amount.toFixed(2));
  const payload = buildBankAccountQrPayload(shop, roundedAmount);
  const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 320 });

  return {
    qrDataUrl,
    payload,
    amount: roundedAmount,
    bankName: shop.bank_name,
    bankAccountNo: shop.bank_account_no,
    bankAccountName: shop.bank_account_name
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
  const paymentInfo = await prepareBookingPayment(input.bookingId, { useAdminClient: true });

  if (paymentInfo.bookingStatus === "cancelled") {
    throw new Error("Cannot receive payment for a cancelled booking");
  }

  if (input.method === "promptpay_qr" && !paymentInfo.shop.promptpay_target) {
    throw new Error("PromptPay is not configured for this shop");
  }

  if (Number.isNaN(input.amount) || input.amount <= 0) {
    throw new Error("Payment amount is invalid");
  }

  const hasKnownTotal = paymentInfo.totalAmount > 0;
  const remainingAmount = hasKnownTotal ? Math.max(paymentInfo.totalAmount - paymentInfo.paidAmount, 0) : 0;
  let incrementalAmount = Number(input.amount.toFixed(2));

  // Staff sometimes enter the full booking total here after a deposit already exists.
  // In that case, treat the submitted number as the desired cumulative paid amount.
  if (
    hasKnownTotal &&
    paymentInfo.paidAmount > 0 &&
    incrementalAmount - remainingAmount > 0.0001 &&
    Math.abs(incrementalAmount - paymentInfo.totalAmount) <= 0.0001
  ) {
    incrementalAmount = Number((paymentInfo.totalAmount - paymentInfo.paidAmount).toFixed(2));
  }

  const nextAmount = Number((paymentInfo.paidAmount + incrementalAmount).toFixed(2));

  if (hasKnownTotal && nextAmount - paymentInfo.totalAmount > 0.0001) {
    throw new Error(
      `Payment exceeds booking total (total ${paymentInfo.totalAmount.toFixed(2)}, paid ${paymentInfo.paidAmount.toFixed(2)}, remaining ${remainingAmount.toFixed(2)})`
    );
  }

  const paidAt = new Date();
  const nextStatus = resolvePaymentStatus({
    totalAmount: paymentInfo.totalAmount,
    paidAmount: nextAmount,
    storedStatus: hasKnownTotal && nextAmount >= paymentInfo.totalAmount ? "paid" : "pending"
  });
  let receiptNo: string | null = null;
  let paymentError: DatabaseWriteError | null = null;
  const existingReceiptNo = paymentInfo.payment?.receipt_no ?? null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    receiptNo = nextStatus === "paid" ? existingReceiptNo ?? (await generateReceiptNo(paymentInfo.shop.receipt_prefix, paidAt, attempt)) : null;

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

    const { error } = await supabase.from("booking_payments").upsert(upsertPayload, { onConflict: "booking_id" });
    paymentError = error;

    if (!paymentError) {
      break;
    }

    if (existingReceiptNo || nextStatus !== "paid" || !isReceiptNoUniqueConflict(paymentError)) {
      break;
    }
  }

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
  const paymentInfo = await prepareBookingPayment(input.bookingId, { useAdminClient: true });

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
  const nextStatus = resolvePaymentStatus({
    totalAmount: paymentInfo.totalAmount,
    paidAmount: nextAmount,
    storedStatus: hasKnownTotal && nextAmount >= paymentInfo.totalAmount ? "paid" : "pending"
  });
  let receiptNo: string | null = null;
  let paymentError: DatabaseWriteError | null = null;
  const existingReceiptNo = paymentInfo.payment.receipt_no ?? null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    receiptNo = nextStatus === "paid" ? existingReceiptNo ?? (await generateReceiptNo(paymentInfo.shop.receipt_prefix, paidAt, attempt)) : null;

    const { error } = await supabase
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

    paymentError = error;

    if (!paymentError) {
      break;
    }

    if (existingReceiptNo || nextStatus !== "paid" || !isReceiptNoUniqueConflict(paymentError)) {
      break;
    }
  }

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
  const paymentInfo = await prepareBookingPayment(bookingId, { useAdminClient: true });

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
