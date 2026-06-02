import clsx from "clsx";
import { format, parseISO } from "date-fns";
import { PendingLink } from "@/components/ui/pending-link";
import type { DailyScheduleItem } from "@/types/database";

const weekdayLabels = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const bookingTypeClassName = {
  grooming: "schedule-chip-grooming",
  hotel: "schedule-chip-hotel"
} as const;

export type ScheduleCalendarCell = {
  date: string;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  items: DailyScheduleItem[];
};

export function ScheduleCalendar({
  cells,
  groomingEnabled,
  hotelEnabled,
  useCustomFilters
}: {
  cells: ScheduleCalendarCell[];
  groomingEnabled: boolean;
  hotelEnabled: boolean;
  useCustomFilters: boolean;
}) {
  return (
    <section className="panel stack">
      <div className="stack" style={{ gap: 8 }}>
        <div className="section-kicker">Monthly board</div>
        <h2 className="section-title">ภาพรวมคิวตลอดเดือน</h2>
      </div>

      <div className="schedule-mobile-strip">
        <div className="section-copy">เลือกวันจากแถบด้านล่าง แล้วดูรายการคิวของวันนั้นต่อในส่วนถัดไป</div>
        <div className="schedule-mobile-days" aria-label="เลือกวันที่">
          {cells.map((cell) => {
            const dayDate = parseISO(cell.date);
            const monthForLink = format(dayDate, "yyyy-MM");

            return (
              <PendingLink
                key={`mobile-${cell.date}`}
                href={{
                  pathname: "/schedule",
                  query: {
                    month: monthForLink,
                    date: cell.date,
                    filters: useCustomFilters ? "custom" : undefined,
                    grooming: groomingEnabled ? "1" : undefined,
                    hotel: hotelEnabled ? "1" : undefined
                  }
                }}
                className={clsx("schedule-mobile-day", {
                  "schedule-mobile-day-selected": cell.isSelected,
                  "schedule-day-outside": !cell.inCurrentMonth
                })}
                aria-current={cell.isSelected ? "date" : undefined}
              >
                <span className="schedule-mobile-weekday">{weekdayLabels[dayDate.getDay()]}</span>
                <span className="schedule-mobile-number">{format(dayDate, "d")}</span>
                <span className="schedule-mobile-count">{cell.items.length ? `${cell.items.length} คิว` : ""}</span>
              </PendingLink>
            );
          })}
        </div>
      </div>

      <div className="schedule-calendar-wrap">
        <div className="schedule-calendar-header">
          {weekdayLabels.map((label) => (
            <div key={label} className="schedule-weekday">
              {label}
            </div>
          ))}
        </div>

        <div className="schedule-calendar-grid">
          {cells.map((cell) => {
            const dayDate = parseISO(cell.date);
            const monthForLink = format(dayDate, "yyyy-MM");
            const visibleItems = cell.items.slice(0, 2);
            const remainingCount = Math.max(cell.items.length - visibleItems.length, 0);

            return (
              <PendingLink
                key={cell.date}
                href={{
                  pathname: "/schedule",
                  query: {
                    month: monthForLink,
                    date: cell.date,
                    filters: useCustomFilters ? "custom" : undefined,
                    grooming: groomingEnabled ? "1" : undefined,
                    hotel: hotelEnabled ? "1" : undefined
                  }
                }}
                className={clsx("schedule-day", {
                  "schedule-day-outside": !cell.inCurrentMonth,
                  "schedule-day-selected": cell.isSelected,
                  "schedule-day-today": cell.isToday
                })}
              >
                <div className="schedule-day-top">
                  <span className="schedule-day-number">{format(dayDate, "d")}</span>
                  <span className="schedule-day-count">{cell.items.length || ""}</span>
                </div>

                <div className="schedule-day-chips">
                  {visibleItems.map((item) => (
                    <span
                      key={`${cell.date}-${item.booking_id}`}
                      className={clsx("schedule-chip", bookingTypeClassName[item.booking_type])}
                    >
                      {item.booking_type === "grooming" ? "อาบน้ำ" : "โรงแรม"} {item.pet_name}
                    </span>
                  ))}
                  {remainingCount ? <span className="schedule-chip schedule-chip-more">+{remainingCount} คิว</span> : null}
                </div>
              </PendingLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}
