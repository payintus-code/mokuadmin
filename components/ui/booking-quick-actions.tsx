import { CreditCard, FileText, Phone, Repeat2 } from "lucide-react";
import Link from "next/link";
import { quickUpdateBookingStatusFromForm } from "@/app/actions/bookings";
import { ToastActionForm } from "@/components/ui/toast-action-form";
import { getNextBookingStatus, getNextBookingStatusLabel } from "@/lib/frontdesk-work";
import type { BookingStatus } from "@/types/database";

type BookingQuickActionsProps = {
  bookingId: string;
  status: BookingStatus;
  paymentStatus?: "pending" | "paid" | "cancelled";
  customerPhone?: string | null;
  showStatusAction?: boolean;
  showCall?: boolean;
  showDetail?: boolean;
  showRepeat?: boolean;
  showReceipt?: boolean;
  compact?: boolean;
};

function normalizePhoneHref(phone: string | null | undefined) {
  const normalized = phone?.replace(/[^\d+]/g, "") ?? "";
  return normalized ? `tel:${normalized}` : "";
}

export function BookingQuickActions({
  bookingId,
  status,
  paymentStatus,
  customerPhone,
  showStatusAction = true,
  showCall = true,
  showDetail = true,
  showRepeat = true,
  showReceipt = true,
  compact = false
}: BookingQuickActionsProps) {
  const nextStatus = getNextBookingStatus(status);
  const phoneHref = normalizePhoneHref(customerPhone);

  return (
    <div className={compact ? "booking-quick-actions booking-quick-actions-compact" : "booking-quick-actions"}>
      {showStatusAction && nextStatus ? (
        <ToastActionForm
          action={quickUpdateBookingStatusFromForm}
          className="booking-quick-action-form"
          message="อัปเดตสถานะแล้ว"
        >
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="status" value={nextStatus} />
          <button className="btn btn-primary" type="submit">
            {getNextBookingStatusLabel(status)}
          </button>
        </ToastActionForm>
      ) : null}

      {paymentStatus !== "paid" && status !== "cancelled" ? (
        <Link className="btn btn-secondary" href={`/payments/${bookingId}`}>
          <CreditCard size={18} strokeWidth={2.2} />
          <span>รับเงิน</span>
        </Link>
      ) : null}

      {showCall && phoneHref ? (
        <a className="btn btn-secondary" href={phoneHref}>
          <Phone size={18} strokeWidth={2.2} />
          <span>โทร</span>
        </a>
      ) : null}

      {showDetail ? (
        <Link className="btn btn-secondary" href={`/bookings/${bookingId}`}>
          <FileText size={18} strokeWidth={2.2} />
          <span>รายละเอียด</span>
        </Link>
      ) : null}

      {showRepeat ? (
        <Link className="btn btn-secondary" href={`/bookings/new?repeatBookingId=${bookingId}`}>
          <Repeat2 size={18} strokeWidth={2.2} />
          <span>สร้างซ้ำ</span>
        </Link>
      ) : null}

      {showReceipt && paymentStatus === "paid" ? (
        <Link className="btn btn-secondary" href={`/receipts/${bookingId}`}>
          <FileText size={18} strokeWidth={2.2} />
          <span>ใบเสร็จ</span>
        </Link>
      ) : null}
    </div>
  );
}
