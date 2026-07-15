import clsx from "clsx";
import { format, parseISO } from "date-fns";
import { PendingLink } from "@/components/ui/pending-link";
import { formatDate } from "@/lib/format";
import type { ScheduleWorkFilter } from "@/lib/frontdesk-work";
import type { BookingType } from "@/types/database";

const weekdayLabels = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const maxVisibleMonthQueueItems = 3;

const bookingTypeClassName = {
  grooming: "schedule-chip-grooming",
  hotel: "schedule-chip-hotel"
} as const;

const bookingTypeCompactLabel = {
  grooming: "อาบน้ำ",
  hotel: "โรงแรม"
} as const;

export type ScheduleCalendarVariant = "summary" | "queue";

export type ScheduleCalendarQueueItem = {
  booking_id: string;
  booking_type: BookingType;
  start_at: string;
  pet_name: string;
  services_summary: string;
};

export type ScheduleCalendarCell = {
  date: string;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  totalCount: number;
  groomingCount: number;
  hotelCount: number;
  items?: ScheduleCalendarQueueItem[];
};

type SharedScheduleQuery = {
  month: string;
  date: string;
  filters?: "custom";
  grooming?: "1";
  hotel?: "1";
  work?: ScheduleWorkFilter;
};

function buildTypeChips(cell: ScheduleCalendarCell) {
  const chips: Array<{ key: BookingType; label: string; count: number }> = [];

  if (cell.groomingCount) {
    chips.push({ key: "grooming", label: bookingTypeCompactLabel.grooming, count: cell.groomingCount });
  }

  if (cell.hotelCount) {
    chips.push({ key: "hotel", label: bookingTypeCompactLabel.hotel, count: cell.hotelCount });
  }

  return chips;
}

function buildDayQuery(
  cell: ScheduleCalendarCell,
  options: {
    groomingEnabled: boolean;
    hotelEnabled: boolean;
    useCustomFilters: boolean;
    workFilter: ScheduleWorkFilter;
  }
): SharedScheduleQuery {
  const dayDate = parseISO(cell.date);

  return {
    month: format(dayDate, "yyyy-MM"),
    date: cell.date,
    filters: options.useCustomFilters ? "custom" : undefined,
    grooming: options.groomingEnabled ? "1" : undefined,
    hotel: options.hotelEnabled ? "1" : undefined,
    work: options.workFilter !== "all" ? options.workFilter : undefined
  };
}

function getServiceLabel(item: ScheduleCalendarQueueItem) {
  return item.services_summary.trim() || bookingTypeCompactLabel[item.booking_type];
}

export function ScheduleCalendar({
  cells,
  groomingEnabled,
  hotelEnabled,
  useCustomFilters,
  workFilter = "all",
  variant = "summary"
}: {
  cells: ScheduleCalendarCell[];
  groomingEnabled: boolean;
  hotelEnabled: boolean;
  useCustomFilters: boolean;
  workFilter?: ScheduleWorkFilter;
  variant?: ScheduleCalendarVariant;
}) {
  const isQueueVariant = variant === "queue";

  return (
    <section className={clsx("panel stack", isQueueVariant && "schedule-month-calendar-panel")}>
      <div className="stack" style={{ gap: 8 }}>
        <div className="section-kicker">{isQueueVariant ? "Monthly queue" : "Monthly board"}</div>
        <h2 className="section-title">{isQueueVariant ? "ปฏิทินคิวรายเดือน" : "ภาพรวมคิวตลอดเดือน"}</h2>
      </div>

      {!isQueueVariant ? (
        <div className="schedule-mobile-strip">
          <div className="section-copy">เลือกวันจากแถบด้านล่าง แล้วดูรายการคิวของวันนั้นต่อในส่วนถัดไป</div>
          <div className="schedule-mobile-days" aria-label="เลือกวันที่">
            {cells.map((cell) => {
              const dayDate = parseISO(cell.date);

              return (
                <PendingLink
                  key={`mobile-${cell.date}`}
                  href={{
                    pathname: "/schedule",
                    query: buildDayQuery(cell, { groomingEnabled, hotelEnabled, useCustomFilters, workFilter })
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
      ) : null}

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
            const dayQuery = buildDayQuery(cell, { groomingEnabled, hotelEnabled, useCustomFilters, workFilter });
            const visibleTypeChips = buildTypeChips(cell).slice(0, 2);
            const visibleItems = (cell.items ?? []).slice(0, maxVisibleMonthQueueItems);
            const hiddenItemCount = Math.max(0, cell.totalCount - visibleItems.length);
            const dayClassName = clsx("schedule-day", {
              "schedule-day-outside": !cell.inCurrentMonth,
              "schedule-day-selected": cell.isSelected,
              "schedule-day-today": cell.isToday,
              "schedule-day-queue": isQueueVariant
            });

            if (isQueueVariant) {
              return (
                <article key={cell.date} className={dayClassName}>
                  <div className="schedule-day-top">
                    <PendingLink
                      href={{
                        pathname: "/schedule",
                        query: dayQuery
                      }}
                      className="schedule-day-number-link"
                      aria-label={`ดูรายการคิววันที่ ${format(dayDate, "d")}`}
                    >
                      <span className="schedule-day-number">{format(dayDate, "d")}</span>
                    </PendingLink>
                    <span className="schedule-day-count">{cell.totalCount || ""}</span>
                  </div>

                  <div className="schedule-day-queue-list">
                    {visibleItems.map((item) => (
                      <PendingLink
                        key={`${cell.date}-${item.booking_id}`}
                        href={`/bookings/${item.booking_id}`}
                        className={clsx("schedule-day-queue-item", bookingTypeClassName[item.booking_type])}
                        aria-label={`ดูคิวของ ${item.pet_name}`}
                      >
                        <span className="schedule-day-queue-time">{formatDate(item.start_at, "HH:mm")}</span>
                        <span className="schedule-day-queue-pet">{item.pet_name}</span>
                        <span className="schedule-day-queue-service">{getServiceLabel(item)}</span>
                      </PendingLink>
                    ))}

                    {hiddenItemCount ? (
                      <PendingLink
                        href={{
                          pathname: "/schedule",
                          query: dayQuery
                        }}
                        className="schedule-day-queue-more"
                      >
                        +{hiddenItemCount}
                      </PendingLink>
                    ) : null}
                  </div>
                </article>
              );
            }

            return (
              <PendingLink
                key={cell.date}
                href={{
                  pathname: "/schedule",
                  query: dayQuery
                }}
                className={dayClassName}
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
