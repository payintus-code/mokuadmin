import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CashTransaction, Customer, PaymentMethod } from "@/types/database";

type TransactionSummary = {
  income_total: number;
  expense_total: number;
  net_total: number;
  service_income_total: number;
  hotel_income_total: number;
  other_income_total: number;
  deposit_total: number;
  income_by_payment_method: Record<PaymentMethod, number>;
};

export type FinanceReportSummary = TransactionSummary;

function toSingle<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function getFinanceSummary(day: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_finance_summary", { p_day: day });

  if (error) {
    throw new Error(error.message);
  }

  return data?.[0] ?? { income_total: 0, expense_total: 0, net_total: 0 };
}

export async function getCashTransactions(day: string): Promise<CashTransaction[]> {
  return getCashTransactionsByRange(day, day);
}

export async function getCashTransactionsByRange(
  startDate: string,
  endDate: string,
  options?: { offset?: number; limit?: number; transactionType?: "income" | "expense"; timeoutMs?: number }
): Promise<CashTransaction[]> {
  const supabase = await createClient({ timeoutMs: options?.timeoutMs });
  let query = supabase
    .from("cash_transactions")
    .select(
      `
        id,
        transaction_type,
        category,
        booking_id,
        customer_id,
        title,
        amount,
        payment_method,
        transaction_date,
        note,
        bookings!cash_transactions_booking_id_fkey(
          pets!bookings_pet_id_fkey(name),
          secondary_pets:pets!bookings_secondary_pet_id_fkey(name)
        )
      `
    )
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.transactionType) {
    query = query.eq("transaction_type", options.transactionType);
  }

  if (options?.limit) {
    const offset = Math.max(0, options.offset ?? 0);
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const booking = toSingle(
      row.bookings as
        | {
            pets?: { name?: string } | { name?: string }[] | null;
            secondary_pets?: { name?: string } | { name?: string }[] | null;
          }
        | {
            pets?: { name?: string } | { name?: string }[] | null;
            secondary_pets?: { name?: string } | { name?: string }[] | null;
          }[]
        | null
        | undefined
    );
    const primaryPet = toSingle(booking?.pets);
    const secondaryPet = toSingle(booking?.secondary_pets);

    return {
      id: row.id,
      transaction_type: row.transaction_type,
      category: row.category,
      booking_id: row.booking_id,
      customer_id: row.customer_id,
      title: row.title,
      pet_name: [primaryPet?.name, secondaryPet?.name].filter((name): name is string => Boolean(name)).join(", ") || null,
      amount: Number(row.amount ?? 0),
      payment_method: row.payment_method,
      transaction_date: row.transaction_date,
      note: row.note ?? null
    } satisfies CashTransaction;
  });
}

export async function getFinanceReportSummary(
  startDate: string,
  endDate: string,
  transactionType?: "income" | "expense"
): Promise<FinanceReportSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_finance_report_summary", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_transaction_type: transactionType ?? null
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = data?.[0];
  const paymentMethods = (row?.income_by_payment_method ?? {}) as Partial<Record<PaymentMethod, number | string>>;

  return {
    income_total: Number(row?.income_total ?? 0),
    expense_total: Number(row?.expense_total ?? 0),
    net_total: Number(row?.net_total ?? 0),
    service_income_total: Number(row?.service_income_total ?? 0),
    hotel_income_total: Number(row?.hotel_income_total ?? 0),
    other_income_total: Number(row?.other_income_total ?? 0),
    deposit_total: Number(row?.deposit_total ?? 0),
    income_by_payment_method: {
      cash: Number(paymentMethods.cash ?? 0),
      promptpay_qr: Number(paymentMethods.promptpay_qr ?? 0),
      transfer: Number(paymentMethods.transfer ?? 0),
      card: Number(paymentMethods.card ?? 0),
      other: Number(paymentMethods.other ?? 0)
    }
  };
}

export async function getPendingDepositTotalByRange(startDate: string, endDate: string): Promise<number> {
  const supabase = await createClient();
  const { data: transactions, error: transactionsError } = await supabase
    .from("cash_transactions")
    .select("booking_id, amount")
    .eq("transaction_type", "income")
    .gte("transaction_date", startDate)
    .lte("transaction_date", endDate)
    .not("booking_id", "is", null);

  if (transactionsError) {
    throw new Error(transactionsError.message);
  }

  const bookingIds = Array.from(
    new Set(
      (transactions ?? [])
        .map((row) => row.booking_id)
        .filter((bookingId): bookingId is string => Boolean(bookingId))
    )
  );

  if (!bookingIds.length) {
    return 0;
  }

  const { data: pendingPayments, error: paymentsError } = await supabase
    .from("booking_payments")
    .select("booking_id")
    .in("booking_id", bookingIds)
    .eq("status", "pending");

  if (paymentsError) {
    throw new Error(paymentsError.message);
  }

  const pendingBookingIds = new Set((pendingPayments ?? []).map((payment) => payment.booking_id));

  return (transactions ?? []).reduce((sum, row) => {
    if (!row.booking_id || !pendingBookingIds.has(row.booking_id)) {
      return sum;
    }

    return sum + Number(row.amount ?? 0);
  }, 0);
}

export function summarizeTransactions(transactions: CashTransaction[]) {
  return transactions.reduce(
    (acc, transaction) => {
      const amount = Number(transaction.amount ?? 0);

      if (transaction.transaction_type === "income") {
        acc.income_total += amount;
        acc.net_total += amount;
        acc.income_by_payment_method[transaction.payment_method] += amount;

        if (transaction.category === "service_income") {
          acc.service_income_total += amount;
        } else if (transaction.category === "hotel_income") {
          acc.hotel_income_total += amount;
        } else {
          acc.other_income_total += amount;
        }
      } else {
        acc.expense_total += amount;
        acc.net_total -= amount;
      }

      return acc;
    },
    {
      income_total: 0,
      expense_total: 0,
      net_total: 0,
      service_income_total: 0,
      hotel_income_total: 0,
      other_income_total: 0,
      deposit_total: 0,
      income_by_payment_method: {
        cash: 0,
        promptpay_qr: 0,
        transfer: 0,
        card: 0,
        other: 0
      }
    } satisfies TransactionSummary
  );
}

export function groupTransactionsByDate(transactions: CashTransaction[]) {
  const groups = new Map<string, CashTransaction[]>();

  for (const transaction of transactions) {
    const key = transaction.transaction_date;
    const current = groups.get(key) ?? [];
    current.push(transaction);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    items,
    summary: summarizeTransactions(items)
  }));
}

export async function getActiveCustomers(): Promise<Customer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, phone, facebook_name, note")
    .eq("is_active", true)
    .order("full_name");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Customer[];
}

export async function getCashTransactionById(transactionId: string): Promise<Pick<CashTransaction, "id" | "booking_id"> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cash_transactions").select("id, booking_id").eq("id", transactionId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    booking_id: data.booking_id ?? null
  };
}

export async function deleteCashTransactionRecord(transactionId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("cash_transactions").delete().eq("id", transactionId);

  if (error) {
    throw new Error(error.message);
  }
}
