"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateBooking } from "@/app/actions/bookings";
import { useToast } from "@/components/ui/toast-provider";
import { getBookingDurationMinutes, validateBookingAmountEdit } from "@/lib/booking-edit";
import { formatBaht } from "@/lib/format";
import type { BookingType, PaymentStatus } from "@/types/database";

type BookingEditFormProps = {
  bookingId: string;
  bookingType: BookingType;
  startAt: string;
  endAt: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  receiptNo: string | null;
  note: string | null;
  initialOpen?: boolean;
};

function toDateTimeLocalValue(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const hour = String(parsed.getUTCHours()).padStart(2, "0");
  const minute = String(parsed.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatDuration(minutes: number | null, bookingType: BookingType) {
  if (minutes === null) {
    return "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม";
  }

  if (bookingType === "hotel") {
    const days = Math.floor(minutes / 1_440);
    const remainingHours = Math.floor((minutes % 1_440) / 60);
    const remainingMinutes = minutes % 60;
    const parts = [
      days ? `${days} วัน` : "",
      remainingHours ? `${remainingHours} ชั่วโมง` : "",
      remainingMinutes ? `${remainingMinutes} นาที` : ""
    ].filter(Boolean);
    return `ระยะเวลาเข้าพัก ${parts.join(" ") || "0 นาที"}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const parts = [
    hours ? `${hours} ชั่วโมง` : "",
    remainingMinutes ? `${remainingMinutes} นาที` : ""
  ].filter(Boolean);
  return `ระยะเวลาบริการ ${parts.join(" ") || "0 นาที"}`;
}

export function BookingEditForm({
  bookingId,
  bookingType,
  startAt: initialStartAt,
  endAt: initialEndAt,
  totalAmount: initialTotalAmount,
  paidAmount,
  paymentStatus,
  receiptNo,
  note: initialNote,
  initialOpen = false
}: BookingEditFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [startAt, setStartAt] = useState(() => toDateTimeLocalValue(initialStartAt));
  const [endAt, setEndAt] = useState(() => toDateTimeLocalValue(initialEndAt));
  const [totalAmount, setTotalAmount] = useState(String(initialTotalAmount));
  const [note, setNote] = useState(initialNote ?? "");
  const [errorMessage, setErrorMessage] = useState("");

  const amountLocked = paymentStatus === "paid" && Boolean(receiptNo);
  const durationMinutes = useMemo(
    () => getBookingDurationMinutes(startAt, endAt),
    [endAt, startAt]
  );
  const nextTotalAmount = Number(totalAmount);
  const remainingAmount =
    Number.isFinite(nextTotalAmount) && nextTotalAmount >= 0
      ? Math.max(nextTotalAmount - paidAmount, 0)
      : 0;

  function resetDraft() {
    setStartAt(toDateTimeLocalValue(initialStartAt));
    setEndAt(toDateTimeLocalValue(initialEndAt));
    setTotalAmount(String(initialTotalAmount));
    setNote(initialNote ?? "");
    setErrorMessage("");
  }

  function handleCancel() {
    resetDraft();
    setIsOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (durationMinutes === null) {
      setErrorMessage("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม");
      return;
    }

    const amountValidation = validateBookingAmountEdit({
      currentTotalAmount: initialTotalAmount,
      nextTotalAmount,
      paidAmount,
      paymentStatus,
      receiptNo
    });

    if (!amountValidation.ok) {
      setErrorMessage(amountValidation.message);
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          await updateBooking({
            bookingId,
            startAt,
            endAt,
            totalAmount: nextTotalAmount,
            note
          });
          showToast("แก้ไขรายละเอียดคิวเรียบร้อยแล้ว");
          setIsOpen(false);
          router.refresh();
        } catch (error) {
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : "ไม่สามารถแก้ไขรายละเอียดคิวได้"
          );
        }
      })();
    });
  }

  if (!isOpen) {
    return (
      <button className="btn btn-secondary" type="button" onClick={() => setIsOpen(true)}>
        แก้ไขคิว
      </button>
    );
  }

  return (
    <form className="form-section stack" onSubmit={handleSubmit}>
      <div>
        <h2 className="form-section-title">แก้ไขวันเวลาและยอดเงิน</h2>
        <p className="form-section-copy">
          ข้อมูลลูกค้า สัตว์เลี้ยง {bookingType === "hotel" ? "และห้องพัก" : "และบริการ"} จะยังคงเดิม
        </p>
      </div>

      <div className="grid-2">
        <label className="label">
          {bookingType === "hotel" ? "วันเวลาเช็กอิน" : "วันเวลาเริ่ม"}
          <input className="input date-input-native" type="datetime-local" required value={startAt} onChange={(event) => setStartAt(event.target.value)} disabled={isPending} />
        </label>
        <label className="label">
          {bookingType === "hotel" ? "วันเวลาเช็กเอาต์" : "วันเวลาสิ้นสุด"}
          <input className="input date-input-native" type="datetime-local" required value={endAt} onChange={(event) => setEndAt(event.target.value)} disabled={isPending} />
        </label>
      </div>

      <div className={durationMinutes === null ? "state-note state-note-warning" : "soft-note"} aria-live="polite">
        {formatDuration(durationMinutes, bookingType)}
      </div>

      <div className="grid-2">
        <label className="label">
          ยอดรวม (บาท)
          <input className="input" type="number" inputMode="numeric" min={paidAmount} step="1" required value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} disabled={isPending || amountLocked} />
          <span className="label-hint">
            {amountLocked
              ? "ชำระครบและออกใบเสร็จแล้ว จึงไม่สามารถแก้ยอดรวมได้"
              : paidAmount > 0
                ? `ยอดใหม่ต้องไม่น้อยกว่ายอดที่รับแล้ว ${formatBaht(paidAmount)}`
                : "กรอกเป็นจำนวนเงินบาทเต็มบาท"}
          </span>
        </label>
        <div className="soft-note" aria-live="polite">
          <div className="muted">ยอดคงเหลือหลังแก้ไข</div>
          <strong>{formatBaht(remainingAmount)}</strong>
        </div>
      </div>

      <label className="label">
        หมายเหตุ
        <textarea className="textarea" value={note} onChange={(event) => setNote(event.target.value)} disabled={isPending} placeholder="รายละเอียดเพิ่มเติมของคิว" />
      </label>

      {errorMessage ? <div className="state-note state-note-danger" role="alert">{errorMessage}</div> : null}

      <div className="grid-2">
        <button className="btn btn-primary" type="submit" disabled={isPending}>
          {isPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={handleCancel} disabled={isPending}>
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
