import Link from "next/link";
import { deleteCashTransaction } from "@/app/actions/finance";
import { DeleteButton } from "@/components/forms/delete-button";
import { PageHeader } from "@/components/ui/page-header";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAdmin } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { formatBaht, formatDateInput } from "@/lib/format";
import { getCashTransactionsByRange, getPendingDepositTotalByRange, groupTransactionsByDate, summarizeTransactions } from "@/lib/finance";
import type { TransactionType } from "@/types/database";

export const dynamic = "force-dynamic";

type TransactionFilter = TransactionType | "all";

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
  transfer: "โอน",
  promptpay_qr: "PromptPay QR",
  card: "บัตร",
  other: "อื่น ๆ"
};

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDayOfMonth = new Date(year, monthNumber, 0).getDate();
  const paddedMonth = String(monthNumber).padStart(2, "0");

  return {
    startDate: `${year}-${paddedMonth}-01`,
    endDate: `${year}-${paddedMonth}-${String(lastDayOfMonth).padStart(2, "0")}`
  };
}

function getTransactionFilter(value: string | undefined): TransactionFilter {
  if (value === "income" || value === "expense") {
    return value;
  }

  return "all";
}

function calculateStaffCommission(serviceIncomeTotal: number) {
  const tiers = [
    { label: "0 - 30,000 บาท", cap: 30000, rate: 0.03 },
    { label: "30,001 - 60,000 บาท", cap: 60000, rate: 0.05 },
    { label: "60,001 - 100,000 บาท", cap: 100000, rate: 0.08 },
    { label: "ส่วนที่เกิน 100,000 บาท", cap: Number.POSITIVE_INFINITY, rate: 0.1 }
  ] as const;

  let previousCap = 0;
  let totalCommission = 0;
  const breakdown = tiers.map((tier) => {
    const tierAmount = Math.max(0, Math.min(serviceIncomeTotal, tier.cap) - previousCap);
    const commission = tierAmount * tier.rate;
    totalCommission += commission;

    if (Number.isFinite(tier.cap)) {
      previousCap = tier.cap;
    }

    return {
      ...tier,
      tierAmount,
      commission
    };
  });

  return { totalCommission, breakdown };
}

function getTransactionFilterLabel(type: TransactionFilter) {
  if (type === "income") {
    return "รายรับ";
  }

  if (type === "expense") {
    return "รายจ่าย";
  }

  return "ทั้งหมด";
}

export default async function FinanceReportPage({
  searchParams
}: {
  searchParams?: Promise<{ mode?: string; date?: string; start?: string; end?: string; month?: string; type?: string; commission?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const today = formatDateInput();
  const mode = params.mode ?? "daily";
  const date = params.date ?? today;
  const month = params.month ?? today.slice(0, 7);
  const type = getTransactionFilter(params.type);
  const showCommission = params.commission === "1";

  let startDate = date;
  let endDate = date;

  if (mode === "month") {
    const range = getMonthRange(month);
    startDate = range.startDate;
    endDate = range.endDate;
  }

  if (mode === "range") {
    startDate = params.start ?? today;
    endDate = params.end ?? today;
  }

  const exportHref = `/finance/report/export?mode=${encodeURIComponent(mode)}&date=${encodeURIComponent(date)}&month=${encodeURIComponent(month)}&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&type=${encodeURIComponent(type)}`;
  const reportQuery = `mode=${encodeURIComponent(mode)}&date=${encodeURIComponent(date)}&month=${encodeURIComponent(month)}&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}&type=${encodeURIComponent(type)}`;
  const commissionHref = `/finance/report?${reportQuery}&commission=1`;
  const closeCommissionHref = `/finance/report?${reportQuery}`;

  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="รายงานการเงิน" subtitle="สรุปรายวัน รายเดือน และช่วงวันที่" />
        <SetupNotice />
      </main>
    );
  }

  await requireAdmin();

  const [transactions, depositTotal] = await Promise.all([
    getCashTransactionsByRange(startDate, endDate),
    getPendingDepositTotalByRange(startDate, endDate)
  ]);
  const filteredTransactions =
    type === "all" ? transactions : transactions.filter((transaction) => transaction.transaction_type === type);
  const summary = summarizeTransactions(filteredTransactions);
  const groups = groupTransactionsByDate(filteredTransactions);
  const showIncomeSections = type !== "expense";
  const staffCommission = calculateStaffCommission(summary.service_income_total);

  return (
    <main className="stack">
      <PageHeader title="รายงานการเงิน" subtitle="สรุปรายวัน รายเดือน และช่วงวันที่" />

      <section className="card stack">
        <div className="stack">
          <Link className="btn btn-secondary" href="/finance">
            กลับหน้าการเงิน
          </Link>
          <Link className="btn btn-secondary" href="/expenses/new">
            เพิ่มรายจ่ายทั่วไป
          </Link>
          <Link className="btn btn-primary" href={exportHref}>
            ดาวน์โหลดรายงาน CSV
          </Link>
        </div>
      </section>

      <form className="card stack">
        <label className="label">
          รูปแบบรายงาน
          <select className="select" name="mode" defaultValue={mode}>
            <option value="daily">รายวัน</option>
            <option value="month">รายเดือน</option>
            <option value="range">ช่วงวันที่</option>
          </select>
        </label>

        <label className="label">
          ประเภทรายการ
          <select className="select" name="type" defaultValue={type}>
            <option value="all">ทั้งหมด</option>
            <option value="income">รายรับ</option>
            <option value="expense">รายจ่าย</option>
          </select>
        </label>

        <label className="label">
          วันที่
          <input className="input" type="date" name="date" defaultValue={date} />
        </label>

        <label className="label">
          เดือน
          <input className="input" type="month" name="month" defaultValue={month} />
        </label>

        <div className="grid-2">
          <label className="label">
            วันที่เริ่ม
            <input className="input" type="date" name="start" defaultValue={params.start ?? today} />
          </label>
          <label className="label">
            วันที่สิ้นสุด
            <input className="input" type="date" name="end" defaultValue={params.end ?? today} />
          </label>
        </div>

        <button className="btn btn-primary" type="submit">
          ดูรายงาน
        </button>
      </form>

      <section className="card stack">
        <Link className={`btn ${showCommission ? "btn-secondary" : "btn-primary"}`} href={showCommission ? closeCommissionHref : commissionHref}>
          {showCommission ? "ซ่อนค่าคอมพนักงาน" : "คำนวณค่าคอมพนักงาน"}
        </Link>
      </section>

      <section className="grid-2">
        <div className="card">
          <div className="muted">รายรับรวม</div>
          <h2 style={{ margin: "6px 0 0", color: "var(--success)" }}>{formatBaht(summary.income_total)}</h2>
        </div>
        <div className="card">
          <div className="muted">รายจ่ายรวม</div>
          <h2 style={{ margin: "6px 0 0", color: "var(--danger)" }}>{formatBaht(summary.expense_total)}</h2>
        </div>
      </section>

      {showIncomeSections ? (
        <>
          <section className="grid-2">
            <div className="card">
              <div className="muted">รายรับบริการ</div>
              <h2 style={{ margin: "6px 0 0", color: "var(--success)" }}>{formatBaht(summary.service_income_total)}</h2>
            </div>
            <div className="card">
              <div className="muted">รายรับโรงแรม</div>
              <h2 style={{ margin: "6px 0 0", color: "var(--success)" }}>{formatBaht(summary.hotel_income_total)}</h2>
            </div>
          </section>

          <section className="grid-2">
            <div className="card">
              <div className="muted">รายรับอื่น ๆ</div>
              <h2 style={{ margin: "6px 0 0", color: "var(--success)" }}>{formatBaht(summary.other_income_total)}</h2>
            </div>
            <div className="card">
              <div className="muted">ยอดมัดจำ (ยังไม่ paid)</div>
              <h2 style={{ margin: "6px 0 0", color: "var(--warning)" }}>{formatBaht(depositTotal)}</h2>
              <p className="muted" style={{ marginBottom: 0 }}>
                ยอดนี้รวมอยู่ในรายรับรวมแล้ว
              </p>
            </div>
          </section>

          {showCommission ? (
            <section className="card stack">
              <div>
                <div className="muted">ค่าคอมพนักงาน</div>
                <h2 style={{ margin: "6px 0 0", color: "var(--accent-strong)" }}>{formatBaht(staffCommission.totalCommission)}</h2>
                <p className="muted" style={{ marginBottom: 0 }}>
                  คิดจากรายรับบริการ {formatBaht(summary.service_income_total)} ตามอัตราแบบขั้นบันได
                </p>
              </div>

              <div className="stack">
                {staffCommission.breakdown.map((item) => (
                  <div key={item.label} className="card panel-muted">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <strong>{item.label}</strong>
                      <span>{Math.round(item.rate * 100)}%</span>
                    </div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      ยอดที่คิด: {formatBaht(item.tierAmount)} | ค่าคอม: {formatBaht(item.commission)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="card stack">
            <div className="muted">สรุปตามช่องทางรับเงิน</div>
            <div className="grid-2">
              {Object.entries(summary.income_by_payment_method).map(([method, amount]) => (
                <div key={method} className="card">
                  <div className="muted">{paymentMethodLabelMap[method] ?? method}</div>
                  <h2 style={{ margin: "6px 0 0", color: "var(--success)" }}>{formatBaht(amount)}</h2>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <section className="card">
        <div className="muted">กำไร / คงเหลือสุทธิ</div>
        <h2 style={{ margin: "6px 0 0", color: summary.net_total >= 0 ? "var(--success)" : "var(--danger)" }}>{formatBaht(summary.net_total)}</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          ช่วงข้อมูล: {startDate} ถึง {endDate} | {getTransactionFilterLabel(type)}
        </p>
      </section>

      <section className="stack">
        {groups.length ? (
          groups.map((group) => (
            <article key={group.date} className="card">
              <div className="stack">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <strong>{group.date}</strong>
                  <span>{formatBaht(group.summary.net_total)}</span>
                </div>
                {group.items.map((transaction) => (
                  <div key={transaction.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span>{transaction.title}</span>
                      <strong style={{ color: transaction.transaction_type === "income" ? "var(--success)" : "var(--danger)" }}>
                        {transaction.transaction_type === "income" ? "+" : "-"}
                        {formatBaht(transaction.amount)}
                      </strong>
                    </div>
                    <div className="muted">
                      {categoryLabelMap[transaction.category] ?? transaction.category} | {paymentMethodLabelMap[transaction.payment_method] ?? transaction.payment_method}
                    </div>
                    {transaction.pet_name ? <div className="muted">สัตว์เลี้ยง: {transaction.pet_name}</div> : null}
                    <div style={{ marginTop: 10 }}>
                      <DeleteButton
                        action={deleteCashTransaction.bind(null, transaction.id)}
                        label={transaction.booking_id ? "ลบรายการและคิวนี้" : "ลบรายการนี้"}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))
        ) : (
          <div className="card">
            <strong>ยังไม่มีข้อมูลในช่วงนี้</strong>
          </div>
        )}
      </section>
    </main>
  );
}
