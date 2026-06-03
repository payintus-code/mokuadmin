"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { confirmPayment, updateRecordedPayment } from "@/app/actions/payments";
import { formatBaht } from "@/lib/format";
import type { BookingPayment, PaymentMethod } from "@/types/database";

function SubmitButton({ pendingLabel, label, disabled = false }: { pendingLabel: string; label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button className="btn btn-primary" type="submit" disabled={pending || disabled}>
      {pending ? pendingLabel : label}
    </button>
  );
}

const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: "promptpay_qr", label: "PromptPay QR" },
  { value: "cash", label: "เงินสด" },
  { value: "transfer", label: "โอน" }
];

function formatMoneyInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function parseMoneyInput(value: string) {
  if (!value.trim()) {
    return Number.NaN;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function PaymentOptionRadioGroup<TValue extends string>({
  name,
  options,
  value,
  onChange,
  isOptionDisabled,
  disabled = false
}: {
  name: string;
  options: Array<{ value: TValue; label: string }>;
  value: TValue;
  onChange: (value: TValue) => void;
  isOptionDisabled?: (value: TValue) => boolean;
  disabled?: boolean;
}) {
  return (
    <div className="payment-method-radio-grid" role="radiogroup" aria-label="วิธีการชำระเงิน">
      {options.map((option) => {
        const optionDisabled = disabled || Boolean(isOptionDisabled?.(option.value));

        return (
          <label key={option.value} className="payment-method-radio">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={optionDisabled}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

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
  qrDataUrl: initialPromptPayQrDataUrl,
  promptpayAvailable,
  payment
}: BookingPaymentFormProps) {
  const savedMethod = payment?.method;
  const defaultMethod = savedMethod === "promptpay_qr" && !promptpayAvailable ? "cash" : savedMethod ?? (promptpayAvailable ? "promptpay_qr" : "cash");
  const [addMethod, setAddMethod] = useState<PaymentMethod>(defaultMethod);
  const [editMethod, setEditMethod] = useState<PaymentMethod>(defaultMethod);
  const [totalAmountValue, setTotalAmountValue] = useState(formatMoneyInput(totalAmount));
  const [dynamicPromptPayQr, setDynamicPromptPayQr] = useState<{ amount: number; qrDataUrl: string | null; error: string }>({
    amount: 0,
    qrDataUrl: null,
    error: ""
  });
  const parsedTotalAmount = parseMoneyInput(totalAmountValue);
  const hasValidTotalAmount = !Number.isNaN(parsedTotalAmount) && parsedTotalAmount >= 0;
  const totalBelowDeposit = hasValidTotalAmount && roundMoney(parsedTotalAmount) + 0.0001 < paidAmount;
  const calculatedRemainingAmount = hasValidTotalAmount && !totalBelowDeposit ? Math.max(roundMoney(parsedTotalAmount - paidAmount), 0) : 0;
  const hasAmountDue = calculatedRemainingAmount > 0.0001;
  const canSubmitPayment = hasValidTotalAmount && !totalBelowDeposit;
  const totalAmountChanged = hasValidTotalAmount && Math.abs(roundMoney(parsedTotalAmount) - roundMoney(totalAmount)) > 0.0001;
  const promptPayQrMatchesInitialAmount = Math.abs(calculatedRemainingAmount - remainingAmount) <= 0.0001;
  const needsDynamicPromptPayQr = addMethod === "promptpay_qr" && promptpayAvailable && hasAmountDue && !promptPayQrMatchesInitialAmount;
  const dynamicPromptPayQrMatchesAmount = dynamicPromptPayQr.amount === calculatedRemainingAmount;
  const displayedPromptPayQrDataUrl = promptPayQrMatchesInitialAmount
    ? initialPromptPayQrDataUrl
    : dynamicPromptPayQrMatchesAmount
      ? dynamicPromptPayQr.qrDataUrl
      : null;
  const displayedPromptPayQrError = dynamicPromptPayQrMatchesAmount ? dynamicPromptPayQr.error : "";

  useEffect(() => {
    if (!needsDynamicPromptPayQr) {
      return;
    }

    const controller = new AbortController();

    fetch("/payments/promptpay-qr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ amount: calculatedRemainingAmount }),
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = (await response.json()) as { qrDataUrl?: string; error?: string };

        if (!response.ok || !payload.qrDataUrl) {
          throw new Error(payload.error ?? "ไม่สามารถสร้าง PromptPay QR ได้");
        }

        setDynamicPromptPayQr({ amount: calculatedRemainingAmount, qrDataUrl: payload.qrDataUrl, error: "" });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setDynamicPromptPayQr({
          amount: calculatedRemainingAmount,
          qrDataUrl: null,
          error: error instanceof Error ? error.message : "ไม่สามารถสร้าง PromptPay QR ได้"
        });
      });

    return () => controller.abort();
  }, [calculatedRemainingAmount, needsDynamicPromptPayQr]);

  return (
    <div className="stack">
      <form action={confirmPayment} className="stack">
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="amount" value={canSubmitPayment ? calculatedRemainingAmount.toFixed(2) : "0"} />
        <input type="hidden" name="method" value={addMethod} />

        <section className="card stack payment-card">
          <div className="payment-card-heading">
            <div>
              <h2 className="section-title">รายการรอชำระ</h2>
              <p className="form-section-copy">คิว {bookingNo}</p>
            </div>
          </div>

          <label className="label">
            ยอดรวม
            <input
              className="input payment-total-input"
              name="totalAmount"
              type="number"
              min="0"
              step="0.01"
              value={totalAmountValue}
              onChange={(event) => setTotalAmountValue(event.target.value)}
              required
            />
          </label>

          <div className="payment-summary-grid" aria-live="polite">
            <div className="payment-summary-item">
              <div className="muted">มัดจำ</div>
              <strong>{formatBaht(paidAmount)}</strong>
            </div>
            <div className="payment-summary-item payment-summary-item-due">
              <div className="muted">ยอดคงเหลือ</div>
              <strong>{formatBaht(calculatedRemainingAmount)}</strong>
            </div>
          </div>

          {!hasValidTotalAmount ? (
            <div className="state-note state-note-warning">กรุณาระบุยอดรวมเป็นตัวเลขที่ถูกต้อง</div>
          ) : null}

          {totalBelowDeposit ? (
            <div className="state-note state-note-warning">ยอดรวมต้องไม่น้อยกว่ายอดมัดจำที่รับแล้ว</div>
          ) : null}

          {hasValidTotalAmount && !totalBelowDeposit && !hasAmountDue ? (
            <div className="state-note state-note-success">ไม่มียอดคงเหลือที่ต้องชำระ</div>
          ) : null}
        </section>

        <section className="card stack payment-card">
          <div className="payment-card-heading">
            <div>
              <h2 className="section-title">วิธีการชำระเงิน</h2>
              <p className="form-section-copy">เลือกวิธีรับยอดคงเหลือ {formatBaht(calculatedRemainingAmount)}</p>
            </div>
          </div>

          <PaymentOptionRadioGroup
            name="paymentOption"
            options={paymentMethodOptions}
            value={addMethod}
            onChange={setAddMethod}
            disabled={!hasAmountDue}
            isOptionDisabled={(value) => value === "promptpay_qr" && !promptpayAvailable}
          />

          {hasAmountDue && addMethod === "promptpay_qr" ? (
            <div className="payment-qr-panel stack">
              <strong>สแกนจ่ายด้วย PromptPay</strong>
              {displayedPromptPayQrDataUrl ? (
                <>
                  <Image
                    src={displayedPromptPayQrDataUrl}
                    alt={`PromptPay QR ${bookingNo}`}
                    width={320}
                    height={320}
                    style={{ width: "100%", maxWidth: 280, height: "auto", justifySelf: "center", borderRadius: 16, background: "white", padding: 8 }}
                  />
                  <div className="muted">ใช้ QR นี้ตามยอดคงเหลือ {formatBaht(calculatedRemainingAmount)} แล้วค่อยกดบันทึกการชำระเงิน</div>
                </>
              ) : (
                <div className="state-note state-note-warning">
                  {!promptpayAvailable
                    ? "ร้านยังไม่ได้ตั้งค่า PromptPay"
                    : needsDynamicPromptPayQr && !dynamicPromptPayQrMatchesAmount
                      ? "กำลังสร้าง QR ตามยอดคงเหลือล่าสุด"
                      : displayedPromptPayQrError || (totalAmountChanged ? "ไม่สามารถสร้าง QR ตามยอดคงเหลือล่าสุดได้" : "ไม่สามารถสร้าง QR สำหรับคิวนี้ได้")}
                </div>
              )}
            </div>
          ) : null}

          <div className="payment-extra-fields">
            <label className="label">
              เลขอ้างอิง
              <input className="input" name="referenceNo" defaultValue={payment?.reference_no ?? ""} placeholder="ไม่กรอกก็ได้" disabled={!hasAmountDue} />
            </label>

            <label className="label">
              หมายเหตุการชำระ
              <textarea className="textarea" name="note" defaultValue={payment?.note ?? ""} placeholder="เช่น รับยอดที่เหลือแล้ว" disabled={!hasAmountDue} />
            </label>
          </div>

          <SubmitButton pendingLabel="กำลังบันทึกการชำระเงิน..." label="บันทึกการชำระเงิน" disabled={!canSubmitPayment} />
        </section>

        {payment?.status === "paid" && payment.receipt_no ? (
          <Link className="btn btn-secondary" href={`/receipts/${bookingId}`}>
            เปิดใบเสร็จ
          </Link>
        ) : null}
      </form>

      {payment ? (
        <details className="card stack booking-collapsible">
          <summary className="booking-collapsible-summary">
            <div>
              <h2 className="section-title">แก้ยอดที่บันทึกแล้ว</h2>
              <p className="form-section-copy">ใช้เฉพาะกรณีบันทึกยอดผิด</p>
            </div>
            <span className="status-badge status-confirmed">เปิดเมื่อต้องแก้</span>
          </summary>

          <form action={updateRecordedPayment} className="stack">
            <input type="hidden" name="bookingId" value={bookingId} />

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

            <div className="label">
              <span>วิธีชำระ</span>
              <PaymentOptionRadioGroup
                name="method"
                options={paymentMethodOptions}
                value={editMethod}
                onChange={setEditMethod}
              />
            </div>

            <label className="label">
              เลขอ้างอิง
              <input className="input" name="referenceNo" defaultValue={payment.reference_no ?? ""} placeholder="ไม่กรอกก็ได้" />
            </label>

            <label className="label">
              หมายเหตุการชำระ
              <textarea className="textarea" name="note" defaultValue={payment.note ?? ""} placeholder="เช่น แก้ยอดจากที่กรอกผิด" />
            </label>

            <div className="state-note state-note-warning">ถ้าใส่ 0 ระบบจะลบยอดรับเงินรายการนี้ออก และคิวจะกลับไปรอชำระตามเดิม</div>

            <SubmitButton pendingLabel="กำลังอัปเดตยอด..." label="บันทึกยอดใหม่" />
          </form>
        </details>
      ) : null}
    </div>
  );
}
