import { PendingLink } from "@/components/ui/pending-link";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";
import type { DailyScheduleItem } from "@/types/database";

const bookingTypeLabel = {
  grooming: "อาบน้ำ / ตัดขน",
  hotel: "โรงแรม"
} as const;

function formatServiceWindow(item: DailyScheduleItem) {
  const startDate = new Date(item.start_at);
  const endDate = new Date(item.end_at);
  const sameDay =
    startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
    startDate.getUTCMonth() === endDate.getUTCMonth() &&
    startDate.getUTCDate() === endDate.getUTCDate();

  if (sameDay) {
    return `${formatDate(item.start_at, "dd/MM/yyyy HH:mm")} - ${formatDate(item.end_at, "HH:mm")}`;
  }

  return `${formatDate(item.start_at, "dd/MM/yyyy HH:mm")} - ${formatDate(item.end_at, "dd/MM/yyyy HH:mm")}`;
}

export function ScheduleListItem({ item }: { item: DailyScheduleItem }) {
  return (
    <PendingLink className="schedule-list-link" href={`/bookings/${item.booking_id}`} aria-label={`ดูรายละเอียดคิวของ ${item.pet_name}`}>
      <article className="card schedule-list-card schedule-list-card-compact list-card">
        <div className="schedule-list-compact-top">
          <div>
            <div className="meta-label">วันเวลาที่เข้าใช้บริการ</div>
            <h2 className="schedule-list-time">{formatServiceWindow(item)}</h2>
          </div>
          <div className="schedule-status-block">
            <div className="meta-label">สถานะ</div>
            <StatusBadge status={item.status} />
          </div>
        </div>

        <div className="schedule-summary-grid">
          <div className="schedule-summary-block">
            <div className="meta-label">สัตว์เลี้ยง</div>
            <div className="meta-value">{item.pet_name}</div>
          </div>
          <div className="schedule-summary-block">
            <div className="meta-label">ประเภทบริการ</div>
            <div className="meta-value">{bookingTypeLabel[item.booking_type]}</div>
          </div>
        </div>

        <div className="schedule-list-footer schedule-list-footer-compact">
          <span className="schedule-list-view">ดูรายละเอียด</span>
        </div>
      </article>
    </PendingLink>
  );
}
