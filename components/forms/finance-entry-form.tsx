"use client";

import { Wallet } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createCashTransaction } from "@/app/actions/finance";
import type { Customer } from "@/types/database";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? "กำลังบันทึก..." : "บันทึกรายการ"}
    </button>
  );
}

export function FinanceEntryForm({
  customers,
  today,
  initialType = "income",
  title = "บันทึกรายการเงินเข้าออก",
  hideBookingField = false
}: {
  customers: Customer[];
  today: string;
  initialType?: "income" | "expense";
  title?: string;
  hideBookingField?: boolean;
}) {
  const [transactionType, setTransactionType] = useState<"income" | "expense">(initialType);
  const categoryOptions =
    transactionType === "income"
      ? [
          { value: "service_income", label: "ค่าบริการ" },
          { value: "hotel_income", label: "ค่าโรงแรม" },
          { value: "product_income", label: "ขายสินค้า" },
          { value: "other_income", label: "รายรับอื่น ๆ" }
        ]
      : [
          { value: "supplies_expense", label: "ค่าของใช้" },
          { value: "wages_expense", label: "ค่าแรง" },
          { value: "shampoo_expense", label: "ค่าน้ำยา" },
          { value: "food_expense", label: "ค่าอาหาร" },
          { value: "other_expense", label: "รายจ่ายอื่น ๆ" }
        ];
  const [category, setCategory] = useState(categoryOptions[0].value);

  function handleTransactionTypeChange(nextType: "income" | "expense") {
    setTransactionType(nextType);
    setCategory(nextType === "income" ? "service_income" : "supplies_expense");
  }

  return (
    <form action={createCashTransaction} className="panel stack">
      <div className="section-kicker">
        <Wallet size={14} strokeWidth={2.2} />
        <span>Cash flow entry</span>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <h2 className="section-title">{title}</h2>
        <p className="section-copy" style={{ margin: 0 }}>
          ฟอร์มเดิมถูกจัด spacing และลำดับใหม่ให้กรอกง่ายขึ้น โดยยังใช้ action และ field เดิมทั้งหมด
        </p>
      </div>

      <div className="grid-2">
        <label className="label">
          ประเภทรายการ
          <select
            className="select"
            name="transactionType"
            value={transactionType}
            onChange={(event) => handleTransactionTypeChange(event.target.value as "income" | "expense")}
            required
          >
            <option value="income">รายรับ</option>
            <option value="expense">รายจ่าย</option>
          </select>
        </label>

        <label className="label">
          หมวดหมู่
          <select className="select" name="category" value={category} onChange={(event) => setCategory(event.target.value)} required>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="label">
        ชื่อรายการ
        <input className="input" name="title" placeholder="เช่น ค่าบริการอาบน้ำ / ซื้อแชมพู" required />
      </label>

      <div className="grid-2">
        <label className="label">
          จำนวนเงิน
          <input className="input" name="amount" type="number" min="0.01" step="0.01" required />
        </label>

        <label className="label">
          วันที่
          <input className="input" name="transactionDate" type="date" defaultValue={today} required />
        </label>
      </div>

      <div className="grid-2">
        <label className="label">
          วิธีรับ/จ่าย
          <select className="select" name="paymentMethod" defaultValue="cash">
            <option value="cash">เงินสด</option>
            <option value="promptpay_qr">PromptPay QR</option>
            <option value="transfer">โอน</option>
            <option value="card">บัตร</option>
            <option value="other">อื่น ๆ</option>
          </select>
        </label>

        <label className="label">
          ลูกค้า
          <select className="select" name="customerId">
            <option value="">ไม่ระบุ</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.full_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!hideBookingField ? (
        <label className="label">
          เลข booking
          <input className="input" name="bookingId" placeholder="ไม่กรอกก็ได้" />
        </label>
      ) : null}

      <label className="label">
        หมายเหตุ
        <textarea className="textarea" name="note" placeholder="รายละเอียดเพิ่มเติม" />
      </label>

      <SubmitButton />
    </form>
  );
}
