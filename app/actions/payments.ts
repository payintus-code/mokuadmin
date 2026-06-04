"use server";

import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth";
import { updateBookingRecord, updateBookingStatus } from "@/lib/bookings";
import { confirmBookingPayment, prepareBookingPayment, updateBookingPayment } from "@/lib/payments";
import { revalidateBookingSurfaces } from "@/lib/revalidation";
import type { PaymentMethod } from "@/types/database";

function withSaveToast(path: string) {
  return `${path}?toast=save`;
}

function normalizeMoney(value: number) {
  return Number(value.toFixed(2));
}

function isSameMoney(left: number, right: number) {
  return Math.abs(left - right) <= 0.0001;
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

  const paymentInfo = await prepareBookingPayment(bookingId, { useAdminClient: true });
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
    if (paymentInfo.bookingStatus !== "cancelled") {
      await updateBookingStatus(bookingId, "done");
    }

    revalidateBookingSurfaces(bookingId);
    redirect(withSaveToast(`/payments/${bookingId}`));
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

  if (paymentInfo.bookingStatus !== "cancelled") {
    await updateBookingStatus(bookingId, "done");
  }

  revalidateBookingSurfaces(bookingId);
  redirect(withSaveToast(`/payments/${bookingId}`));
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

  await updateBookingPayment({
    bookingId,
    amount,
    method,
    referenceNo: referenceNo || undefined,
    note: note || undefined,
    actorUserId: currentUser.id
  });

  revalidateBookingSurfaces(bookingId);
  redirect(withSaveToast(`/payments/${bookingId}`));
}
