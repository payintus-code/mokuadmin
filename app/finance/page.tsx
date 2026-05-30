import { Coins, PiggyBank, ReceiptText } from "lucide-react";
import Link from "next/link";
import { FinanceEntryForm } from "@/components/forms/finance-entry-form";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAdmin } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { formatBaht, formatDateInput } from "@/lib/format";
import { getActiveCustomers, getCashTransactions, getFinanceSummary } from "@/lib/finance";

export const dynamic = "force-dynamic";

const categoryLabelMap: Record<string, string> = {
  service_income: "ค่าบริการ",
  hotel_income: "ค่าโรงแรม",
  product_income: "ขายสินค้า",
  other_income: "รายรับอื่น ๆ",
  supplies_expense: "ค่าของใช้",
  wages_expense: "ค่าแรง",
  shampoo_expense: "ค่าน้ำยา",
  food_expense: "ค่าอาหาร",
  other_expense: "รายจ่ายอื่น ๆ"
};

const paymentMethodLabelMap: Record<string, string> = {
  cash: "เงินสด",
  promptpay_qr: "PromptPay QR",
  transfer: "โอน",
  card: "บัตร",
  other: "อื่น ๆ"
};

export default async function FinancePage({
  searchParams
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const date = params.date ?? formatDateInput();

  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="การเงิน" subtitle="บันทึกรายรับรายจ่ายประจำวัน" />
        <SetupNotice />
      </main>
    );
  }

  await requireAdmin();

  const [summary, transactions, customers] = await Promise.all([
    getFinanceSummary(date),
    getCashTransactions(date),
    getActiveCustomers()
  ]);

  return (
    <main className="stack">
      <PageHeader title="การเงิน" subtitle="บันทึกรายรับรายจ่ายประจำวันในมุมมองที่อ่านง่ายและใช้งานไวขึ้น" />

      <section className="btn-grid">
        <Link className="btn btn-secondary" href="/finance/report">
          ดูรายงาน
        </Link>
        <Link className="btn btn-secondary" href="/expenses/new">
          เพิ่มรายจ่ายทั่วไป
        </Link>
      </section>

      <form className="panel stack">
        <div className="section-kicker">Daily filter</div>
        <label className="label">
          วันที่
          <input className="input" type="date" name="date" defaultValue={date} />
        </label>
        <button className="btn btn-primary" type="submit">
          ดูรายการ
        </button>
      </form>

      <section className="grid-2">
        <MetricCard label="รายรับ" value={formatBaht(Number(summary.income_total ?? 0))} tone="success" icon={<Coins size={18} strokeWidth={2.1} />} />
        <MetricCard label="รายจ่าย" value={formatBaht(Number(summary.expense_total ?? 0))} tone="danger" icon={<ReceiptText size={18} strokeWidth={2.1} />} />
      </section>

      <MetricCard
        label="คงเหลือสุทธิ"
        value={formatBaht(Number(summary.net_total ?? 0))}
        tone={Number(summary.net_total ?? 0) >= 0 ? "success" : "danger"}
        detail="สรุปจากข้อมูลรายรับและรายจ่ายของวันที่เลือก"
        icon={<PiggyBank size={18} strokeWidth={2.1} />}
      />

      <FinanceEntryForm customers={customers} today={date} />

      <section className="stack">
        {transactions.length ? (
          transactions.map((transaction) => (
            <article key={transaction.id} className="card list-card">
              <div className="list-card-top">
                <h2 className="list-card-title">{transaction.title}</h2>
                <strong
                  className={
                    transaction.transaction_type === "income"
                      ? "finance-transaction-amount-income"
                      : "finance-transaction-amount-expense"
                  }
                >
                  {transaction.transaction_type === "income" ? "+" : "-"}
                  {formatBaht(transaction.amount)}
                </strong>
              </div>

              <div className="meta-grid">
                <div className="meta-block">
                  <div className="meta-label">ประเภทรายการ</div>
                  <div className="meta-value">{transaction.transaction_type === "income" ? "รายรับ" : "รายจ่าย"}</div>
                </div>
                <div className="meta-block">
                  <div className="meta-label">วิธีชำระ</div>
                  <div className="meta-value">{paymentMethodLabelMap[transaction.payment_method] ?? transaction.payment_method}</div>
                </div>
              </div>

              <div className="meta-block">
                <div className="meta-label">หมวดหมู่</div>
                <div className="meta-value">{categoryLabelMap[transaction.category] ?? transaction.category}</div>
              </div>

              {transaction.note ? <div className="soft-note">{transaction.note}</div> : null}
            </article>
          ))
        ) : (
          <EmptyState
            icon={<Coins size={24} strokeWidth={2.1} />}
            title="ยังไม่มีรายการในวันนี้"
            description="เพิ่มรายการรายรับหรือรายจ่ายจากฟอร์มด้านบนได้เลย"
          />
        )}
      </section>
    </main>
  );
}
