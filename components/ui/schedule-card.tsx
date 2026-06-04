import { completeBooking, deleteBooking } from "@/app/actions/bookings";
import { DeleteButton } from "@/components/forms/delete-button";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ToastActionForm } from "@/components/ui/toast-action-form";
import { formatBaht, formatTime } from "@/lib/format";
import Link from "next/link";
import type { DailyScheduleItem } from "@/types/database";

export function ScheduleCard({ item }: { item: DailyScheduleItem }) {
  const roomOrService = item.room_name || item.services_summary || "-";

  return (
    <article className="card">
      <div className="stack">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <strong>
              {formatTime(item.start_at)} - {formatTime(item.end_at)}
            </strong>
            <div className="muted" style={{ marginTop: 4 }}>
              {item.booking_no}
            </div>
          </div>
          <div className="stack" style={{ justifyItems: "end", gap: 6 }}>
            <StatusBadge status={item.status} />
            <PaymentStatusBadge status={item.payment_status} />
          </div>
        </div>

        <div className="grid-2">
          <div>
            <div className="muted">Pet</div>
            <strong>{item.pet_name}</strong>
          </div>
          <div>
            <div className="muted">Owner</div>
            <strong>{item.customer_name}</strong>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <div className="muted">Type</div>
            <strong>{item.booking_type === "grooming" ? "Grooming" : "Hotel"}</strong>
          </div>
          <div>
            <div className="muted">Room / service</div>
            <strong>{roomOrService}</strong>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="muted">Total</span>
          <strong>{formatBaht(item.total_amount)}</strong>
        </div>

        <div className="stack">
          {item.status !== "done" && item.status !== "cancelled" ? (
            <ToastActionForm action={completeBooking} className="stack">
              <input type="hidden" name="bookingId" value={item.booking_id} />
              <label className="label">
                ยอดปิดคิว
                <input
                  className="input"
                  name="totalAmount"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={item.total_amount}
                  required
                />
              </label>
              <button className="btn btn-primary" type="submit">
                ปิดคิวและบันทึกยอด
              </button>
            </ToastActionForm>
          ) : (
            <div />
          )}

          <div className="grid-2">
            <Link className="btn btn-secondary" href={`/payments/${item.booking_id}`}>
              รับชำระเงิน
            </Link>
            {item.payment_status === "paid" ? (
              <Link className="btn btn-secondary" href={`/receipts/${item.booking_id}`}>
                ใบเสร็จ
              </Link>
            ) : (
              <Link className="btn btn-secondary" href={`/payments/${item.booking_id}`}>
                ไปหน้าจ่ายเงิน
              </Link>
            )}
          </div>

          <DeleteButton action={deleteBooking.bind(null, item.booking_id)} label="Delete booking" />
        </div>
      </div>
    </article>
  );
}
