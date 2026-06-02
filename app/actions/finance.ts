"use server";

import { deleteBookingRecord } from "@/lib/bookings";
import { requireAdmin } from "@/lib/auth";
import { deleteCashTransactionRecord, getCashTransactionById } from "@/lib/finance";
import { revalidateBookingCreationSurfaces, revalidateFinanceSurfaces } from "@/lib/revalidation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createCashTransaction(formData: FormData) {
  const currentUser = await requireAdmin();

  const supabase = createAdminClient();

  const transactionType = String(formData.get("transactionType") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const bookingId = String(formData.get("bookingId") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const amountValue = String(formData.get("amount") ?? "").trim();
  const paymentMethod = String(formData.get("paymentMethod") ?? "cash").trim();
  const transactionDate = String(formData.get("transactionDate") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!transactionType || !category || !title || !amountValue || !transactionDate) {
    throw new Error("Please fill in transaction type, category, title, amount, and date");
  }

  const amount = Number(amountValue);

  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  const { error } = await supabase.from("cash_transactions").insert({
    transaction_type: transactionType,
    category,
    booking_id: bookingId || null,
    customer_id: customerId || null,
    title,
    amount,
    payment_method: paymentMethod,
    transaction_date: transactionDate,
    note: note || null,
    created_by: currentUser.id
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidateFinanceSurfaces();
}

export async function deleteCashTransaction(transactionId: string) {
  await requireAdmin();

  if (!transactionId) {
    throw new Error("Transaction not found");
  }

  const transaction = await getCashTransactionById(transactionId);

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  if (transaction.booking_id) {
    await deleteBookingRecord(transaction.booking_id);
    revalidateBookingCreationSurfaces();
    revalidateFinanceSurfaces({ includeReport: true });
  } else {
    await deleteCashTransactionRecord(transactionId);
    revalidateFinanceSurfaces({ includeReport: true });
  }
}
