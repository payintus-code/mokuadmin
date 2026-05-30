"use server";

import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/lib/auth";
import { confirmBookingPayment, updateBookingPayment } from "@/lib/payments";
import type { PaymentMethod } from "@/types/database";

export async function confirmPayment(formData: FormData) {
  const currentUser = await requireAppUser();

  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "cash").trim() as PaymentMethod;
  const referenceNo = String(formData.get("referenceNo") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!bookingId) {
    throw new Error("ไม่พบรายการจอง");
  }

  await confirmBookingPayment({
    bookingId,
    amount,
    method,
    referenceNo: referenceNo || undefined,
    note: note || undefined,
    actorUserId: currentUser.id
  });

  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/finance");
  revalidatePath(`/payments/${bookingId}`);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/receipts/${bookingId}`);
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

  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/finance");
  revalidatePath(`/payments/${bookingId}`);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath(`/receipts/${bookingId}`);
}
