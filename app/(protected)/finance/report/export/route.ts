import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getCashTransactionsByRange, summarizeTransactions } from "@/lib/finance";
import { formatDateInput } from "@/lib/format";

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

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? "");

  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }

  return text;
}

function getTransactionFilter(value: string | null) {
  if (value === "income" || value === "expense") {
    return value;
  }

  return "all";
}

function getTransactionFilterLabel(type: "all" | "income" | "expense") {
  if (type === "income") {
    return "รายรับ";
  }

  if (type === "expense") {
    return "รายจ่าย";
  }

  return "ทั้งหมด";
}

export async function GET(request: Request) {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const today = formatDateInput();
  const mode = searchParams.get("mode") ?? "daily";
  const date = searchParams.get("date") ?? today;
  const month = searchParams.get("month") ?? today.slice(0, 7);
  const type = getTransactionFilter(searchParams.get("type"));

  let startDate = date;
  let endDate = date;

  if (mode === "month") {
    const range = getMonthRange(month);
    startDate = range.startDate;
    endDate = range.endDate;
  }

  if (mode === "range") {
    startDate = searchParams.get("start") ?? today;
    endDate = searchParams.get("end") ?? today;
  }

  const transactions = await getCashTransactionsByRange(startDate, endDate, { timeoutMs: 20_000 });
  const filteredTransactions =
    type === "all" ? transactions : transactions.filter((transaction) => transaction.transaction_type === type);
  const summary = summarizeTransactions(filteredTransactions);

  const lines = [
    [
      "ประเภท",
      "ตัวกรองรายการ",
      "ช่วงเริ่ม",
      "ช่วงสิ้นสุด",
      "รายรับรวม",
      "รายจ่ายรวม",
      "รายรับบริการ",
      "รายรับโรงแรม",
      "รายรับอื่น",
      "รายรับเงินสด",
      "รายรับโอน",
      "รายรับ PromptPay QR",
      "รายรับบัตร",
      "รายรับอื่น ๆ (ตามวิธีจ่าย)",
      "สุทธิ"
    ]
      .map(escapeCsv)
      .join(","),
    [
      mode,
      getTransactionFilterLabel(type),
      startDate,
      endDate,
      summary.income_total,
      summary.expense_total,
      summary.service_income_total,
      summary.hotel_income_total,
      summary.other_income_total,
      summary.income_by_payment_method.cash,
      summary.income_by_payment_method.transfer,
      summary.income_by_payment_method.promptpay_qr,
      summary.income_by_payment_method.card,
      summary.income_by_payment_method.other,
      summary.net_total
    ]
      .map(escapeCsv)
      .join(","),
    "",
    [
      "วันที่",
      "ประเภทรายการ",
      "หมวด",
      "ชื่อรายการ",
      "ชื่อสัตว์เลี้ยง",
      "วิธีชำระ",
      "จำนวนเงิน",
      "หมายเหตุ"
    ]
      .map(escapeCsv)
      .join(","),
    ...filteredTransactions.map((transaction) =>
      [
        transaction.transaction_date,
        transaction.transaction_type,
        transaction.category,
        transaction.title,
        transaction.pet_name ?? "",
        paymentMethodLabelMap[transaction.payment_method] ?? transaction.payment_method,
        transaction.amount,
        transaction.note ?? ""
      ]
        .map(escapeCsv)
        .join(",")
    )
  ];

  const csv = `\uFEFF${lines.join("\n")}`;
  const suffix = type === "all" ? "all" : type;
  const fileName = `finance-report-${suffix}-${startDate}-to-${endDate}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`
    }
  });
}
