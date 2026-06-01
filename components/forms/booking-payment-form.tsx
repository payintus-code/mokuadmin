"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { confirmPayment, updateRecordedPayment } from "@/app/actions/payments";
import { formatBaht } from "@/lib/format";
import type { BookingPayment, PaymentMethod } from "@/types/database";

function SubmitButton({ pendingLabel, label }: { pendingLabel: string; label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: "promptpay_qr", label: "PromptPay QR" },
  { value: "cash", label: "เงินสด" },
  { value: "transfer", label: "โอน" },
  { value: "card", label: "บัตร" },
  { value: "other", label: "อื่น ๆ" }
];

type BookingPaymentFormProps = {
  bookingId: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  bookingNo: string;
  qrDataUrl: string | null;
  promptpayAvailable: boolean;
  payment: BookingPayment | null;
};

export function BookingPaymentForm({
  bookingId,
  totalAmount,
  paidAmount,
  remainingAmount,
  bookingNo,
  qrDataUrl,
  promptpayAvailable,
  payment
}: BookingPaymentFormProps) {
  const defaultMethod = payment?.method ?? (promptpayAvailable ? "promptpay_qr" : "cash");
  const [addMethod, setAddMethod] = useState<PaymentMethod>(defaultMethod);
  const [editMethod, setEditMethod] = useState<PaymentMethod>(defaultMethod);
  const isFullyPaid = remainingAmount <= 0;

  return (
    <div className="stack">
      <form action={confirmPayment} className="card stack">
        <input type="hidden" name="bookingId" value={bookingId} />

        <h2 className="section-title">รับชำระเงินเพิ่ม</h2>

        <div className="grid-2">
          <div className="card" style={{ padding: 12 }}>
            <div className="muted">เลขที่คิว</div>
            <strong>{bookingNo}</strong>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted">ยอดรวม</div>
            <strong>{formatBaht(totalAmount)}</strong>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted">รับแล้ว</div>
            <strong>{formatBaht(paidAmount)}</strong>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div className="muted">คงเหลือ</div>
            <strong>{formatBaht(remainingAmount)}</strong>
          </div>
        </div>

        {!isFullyPaid ? (
          <label className="label">
            ยอดรับเพิ่ม
            <input className="input" name="amount" type="number" min="0.01" max={remainingAmount} step="0.01" defaultValue={remainingAmount} required />
            <p className="label-hint">à¸à¸£à¸­à¸à¹€à¸‰à¸žà¸²à¸°à¸¢à¸­à¸”à¸—à¸µà¹ˆà¸£à¸±à¸šà¹€à¸žà¸´à¹ˆà¸¡à¸„à¸£à¸±à¹‰à¸‡à¸™à¸µà¹‰ à¹„à¸¡à¹ˆà¹ƒà¸Šà¹ˆà¸¢à¸­à¸”à¸ªà¸°à¸ªà¸¡à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”</p>
          </label>
        ) : null}

        <label className="label">
          วิธีชำระ
          <select className="select" name="method" value={addMethod} onChange={(event) => setAddMethod(event.target.value as PaymentMethod)} disabled={isFullyPaid}>
            {paymentMethodOptions.map((option) => (
              <option key={option.value} value={option.value} disabled={option.value === "promptpay_qr" && !promptpayAvailable}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {!isFullyPaid && addMethod === "promptpay_qr" ? (
          <section className="card stack" style={{ padding: 12 }}>
            <strong>สแกนจ่ายด้วย PromptPay</strong>
            {qrDataUrl ? (
              <>
                <Image
                  src={qrDataUrl}
                  alt={`PromptPay QR ${bookingNo}`}
                  width={320}
                  height={320}
                  style={{ width: "100%", maxWidth: 280, height: "auto", justifySelf: "center", borderRadius: 16, background: "white", padding: 8 }}
                />
                <div className="muted">ใช้ QR นี้ตามยอดคงเหลือ แล้วค่อยกดบันทึกรับเงินเพิ่ม</div>
              </>
            ) : (
              <div className="muted">ร้านยังไม่ได้ตั้งค่า PromptPay</div>
            )}
          </section>
        ) : null}

        <label className="label">
          เลขอ้างอิง
          <input className="input" name="referenceNo" defaultValue={payment?.reference_no ?? ""} placeholder="ไม่กรอกก็ได้" disabled={isFullyPaid} />
        </label>

        <label className="label">
          หมายเหตุการชำระ
          <textarea className="textarea" name="note" defaultValue={payment?.note ?? ""} placeholder="เช่น รับยอดที่เหลือแล้ว" disabled={isFullyPaid} />
        </label>

        {!isFullyPaid ? <SubmitButton pendingLabel="กำลังบันทึกรับเงิน..." label="บันทึกรับเงินเพิ่ม" /> : <div className="muted">คิวนี้รับเงินครบแล้ว</div>}

        {payment?.status === "paid" && payment.receipt_no ? (
          <Link className="btn btn-secondary" href={`/receipts/${bookingId}`}>
            เปิดใบเสร็จ
          </Link>
        ) : null}
      </form>

      {payment ? (
        <form action={updateRecordedPayment} className="card stack">
          <input type="hidden" name="bookingId" value={bookingId} />

          <h2 className="section-title">แก้ยอดที่บันทึกแล้ว</h2>
          <div className="muted">ใช้กรณีบันทึกยอดผิด ระบบจะอัปเดตรายการรับเงินและรายงานให้ตามยอดใหม่</div>

          <label className="label">
            ยอดที่บันทึกไว้
            <input
              className="input"
              name="amount"
              type="number"
              min="0"
              step="0.01"
              max={totalAmount > 0 ? totalAmount : undefined}
              defaultValue={payment.amount}
              required
            />
          </label>

          <label className="label">
            วิธีชำระ
            <select className="select" name="method" value={editMethod} onChange={(event) => setEditMethod(event.target.value as PaymentMethod)}>
              {paymentMethodOptions.map((option) => (
                <option key={option.value} value={option.value} disabled={option.value === "promptpay_qr" && !promptpayAvailable}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="label">
            เลขอ้างอิง
            <input className="input" name="referenceNo" defaultValue={payment.reference_no ?? ""} placeholder="ไม่กรอกก็ได้" />
          </label>

          <label className="label">
            หมายเหตุการชำระ
            <textarea className="textarea" name="note" defaultValue={payment.note ?? ""} placeholder="เช่น แก้ยอดจากที่กรอกผิด" />
          </label>

          <div className="muted">ถ้าใส่ 0 ระบบจะลบยอดรับเงินรายการนี้ออก และคิวจะกลับไปรอชำระตามเดิม</div>

          <SubmitButton pendingLabel="กำลังอัปเดตยอด..." label="บันทึกยอดใหม่" />
        </form>
      ) : null}
    </div>
  );
}
