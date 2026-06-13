import clsx from "clsx";
import { format, parseISO } from "date-fns";
import { PendingLink } from "@/components/ui/pending-link";
import type { ScheduleWorkFilter } from "@/lib/frontdesk-work";
import type { BookingType } from "@/types/database";

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
  totalCount: number;
  groomingCount: number;
  hotelCount: number;
};

function buildTypeChips(cell: ScheduleCalendarCell) {
  const chips: Array<{ key: BookingType; label: string; count: number }> = [];

  if (cell.groomingCount) {
    chips.push({ key: "grooming", label: "อาบน้ำ", count: cell.groomingCount });
  }

  if (cell.hotelCount) {
    chips.push({ key: "hotel", label: "โรงแรม", count: cell.hotelCount });
  }

  return chips;
}

export function ScheduleCalendar({
  cells,
  groomingEnabled,
  hotelEnabled,
  useCustomFilters,
  workFilter = "all"
}: {
  cells: ScheduleCalendarCell[];
  groomingEnabled: boolean;
  hotelEnabled: boolean;
  useCustomFilters: boolean;
  workFilter?: ScheduleWorkFilter;
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
                    hotel: hotelEnabled ? "1" : undefined,
                    work: workFilter !== "all" ? workFilter : undefined
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
                <span className="schedule-mobile-count">{cell.totalCount ? `${cell.totalCount} คิว` : ""}</span>
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
            const visibleTypeChips = buildTypeChips(cell).slice(0, 2);

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
                    hotel: hotelEnabled ? "1" : undefined,
                    work: workFilter !== "all" ? workFilter : undefined
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
                  <span className="schedule-day-count">{cell.totalCount || ""}</span>
                </div>

                <div className="schedule-day-chips">
                  {visibleTypeChips.map((item) => (
                    <span
                      key={`${cell.date}-${item.key}`}
                      className={clsx("schedule-chip", bookingTypeClassName[item.key])}
                    >
                      {item.label} {item.count}
                    </span>
                  ))}
                </div>
              </PendingLink>
            );
          })}
        </div>
      </div>
    </section>
  );
}
