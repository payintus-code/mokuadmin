import Link from "next/link";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatBaht, formatTime } from "@/lib/format";
import type { DailyScheduleItem } from "@/types/database";

const bookingTypeLabel = {
  grooming: "อาบน้ำ / ตัดขน",
  hotel: "โรงแรม"
} as const;

export function ScheduleListItem({ item }: { item: DailyScheduleItem }) {
  const roomOrService = item.room_name || item.services_summary || "-";

  return (
    <Link className="schedule-list-link" href={`/bookings/${item.booking_id}`}>
      <article className="card schedule-list-card list-card">
        <div className="schedule-list-top">
          <div>
            <strong>
              {formatTime(item.start_at)} - {formatTime(item.end_at)}
            </strong>
            <div className="muted" style={{ marginTop: 4 }}>
              {item.booking_no}
            </div>
          </div>
          <div className="schedule-badge-stack">
            <StatusBadge status={item.status} />
            <PaymentStatusBadge status={item.payment_status} />
          </div>
        </div>

        <div className="meta-grid">
          <div className="meta-block">
            <div className="meta-label">สัตว์เลี้ยง</div>
            <div className="meta-value">{item.pet_name}</div>
          </div>
          <div className="meta-block">
            <div className="meta-label">เจ้าของ</div>
            <div className="meta-value">{item.customer_name}</div>
          </div>
        </div>

        <div className="meta-grid">
          <div className="meta-block">
            <div className="meta-label">ประเภท</div>
            <div className="meta-value">{bookingTypeLabel[item.booking_type]}</div>
          </div>
          <div className="meta-block">
            <div className="meta-label">บริการ / ห้อง</div>
            <div className="meta-value">{roomOrService}</div>
          </div>
        </div>

        <div className="schedule-list-footer">
          <span className="muted">รวม {formatBaht(item.total_amount)}</span>
          <span className="schedule-list-view">ดูรายละเอียด</span>
        </div>
      </article>
    </Link>
  );
}
