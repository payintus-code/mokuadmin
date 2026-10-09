"use server";

import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { updateBookingRecord, updateBookingStatus } from "@/lib/bookings";
import { confirmBookingPayment, prepareBookingPayment, updateBookingPayment } from "@/lib/payments";
import { revalidateBookingSurfaces, revalidateFinanceSurfaces } from "@/lib/revalidation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingType, PaymentMethod } from "@/types/database";

function withSaveToast(path: string) {
  return `${path}${path.includes("?") ? "&" : "?"}toast=save`;
}

function normalizeMoney(value: number) {
  return Number(value.toFixed(2));
}

function isSameMoney(left: number, right: number) {
  return Math.abs(left - right) <= 0.0001;
}

async function resolvePaymentPerformer(
  formData: FormData,
  booking: { bookingType: BookingType; performedById: string | null }
) {
  if (booking.bookingType !== "grooming" || !formData.has("performedById")) {
    return undefined;
  }

  const performedById = String(formData.get("performedById") ?? "").trim() || null;
  if (performedById === booking.performedById) {
    return undefined;
  }

  if (performedById) {
    const { data, error } = await createAdminClient()
      .from("app_users")
      .select("id")
      .eq("id", performedById)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      throw new Error("ไม่พบพนักงานผู้ให้บริการ หรือบัญชีถูกปิดใช้งานแล้ว");
    }
  }

  return performedById;
}

export async function confirmPayment(formData: FormData) {
  const currentUser = await requireAppUser();

  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const totalAmount = Number(formData.get("totalAmount") ?? 0);
  const method = String(formData.get("method") ?? "cash").trim() as PaymentMethod;
  const referenceNo = String(formData.get("referenceNo") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!bookingId) {
    throw new Error("ไม่พบรายการจอง");
  }

  if (Number.isNaN(totalAmount) || totalAmount < 0) {
    throw new Error("ยอดรวมไม่ถูกต้อง");
  }

  const paymentInfo = await prepareBookingPayment(bookingId, { useAdminClient: true, includeQr: false });
  const performedById = await resolvePaymentPerformer(formData, paymentInfo);
  const nextTotalAmount = normalizeMoney(totalAmount);
  const paidAmount = normalizeMoney(paymentInfo.paidAmount);

  if (nextTotalAmount + 0.0001 < paidAmount) {
    throw new Error("ยอดรวมต้องไม่น้อยกว่ายอดมัดจำที่รับแล้ว");
  }

  const remainingAmount = normalizeMoney(nextTotalAmount - paidAmount);

  if (remainingAmount < 0) {
    throw new Error("ยอดรวมต้องไม่น้อยกว่ายอดมัดจำที่รับแล้ว");
  }

  if (!isSameMoney(nextTotalAmount, paymentInfo.totalAmount)) {
    await updateBookingRecord(bookingId, { totalAmount: nextTotalAmount });
  }

  if (remainingAmount <= 0) {
    if (performedById !== undefined) {
      await updateBookingRecord(bookingId, { performedById });
    }
    if (paymentInfo.bookingStatus !== "cancelled") {
      await updateBookingStatus(bookingId, "done");
    }

    revalidateBookingSurfaces(bookingId);
    revalidateFinanceSurfaces({ includeReport: true });
    redirect(withSaveToast("/?open=unpaid"));
  }

  if (Number.isNaN(amount) || amount <= 0 || !isSameMoney(normalizeMoney(amount), remainingAmount)) {
    throw new Error("ยอดชำระต้องเท่ากับยอดคงเหลือ");
  }

  await confirmBookingPayment({
    bookingId,
    amount: remainingAmount,
    method,
    referenceNo: referenceNo || undefined,
    note: note || undefined,
    actorUserId: currentUser.id
  });

  if (performedById !== undefined) {
    await updateBookingRecord(bookingId, { performedById });
  }

  if (paymentInfo.bookingStatus !== "cancelled") {
    await updateBookingStatus(bookingId, "done");
  }

  revalidateBookingSurfaces(bookingId);
  revalidateFinanceSurfaces({ includeReport: true });
  redirect(withSaveToast("/?open=unpaid"));
}

export async function updateRecordedPayment(formData: FormData) {
  const currentUser = await requireAppUser();

  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "cash").trim() as PaymentMethod;
  const referenceNo = String(formData.get("referenceNo") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!bookingId) {
    throw new Error("ไม่พบรายการจอง");
  }

  const paymentInfo = await prepareBookingPayment(bookingId, { useAdminClient: true, includeQr: false });
  const performedById = await resolvePaymentPerformer(formData, paymentInfo);

  await updateBookingPayment({
    bookingId,
    amount,
    method,
    referenceNo: referenceNo || undefined,
    note: note || undefined,
    actorUserId: currentUser.id
  });

  if (performedById !== undefined) {
    await updateBookingRecord(bookingId, { performedById });
  }

  revalidateBookingSurfaces(bookingId);
  revalidateFinanceSurfaces({ includeReport: true });
  redirect(withSaveToast("/?open=unpaid"));
}
