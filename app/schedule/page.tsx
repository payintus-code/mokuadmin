import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parse,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMilliseconds
} from "date-fns";
import { th } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ScheduleCalendar, type ScheduleCalendarCell } from "@/components/ui/schedule-calendar";
import { ScheduleListItem } from "@/components/ui/schedule-list-item";
import { SetupNotice } from "@/components/ui/setup-notice";
import { BookingQuickActions } from "@/components/ui/booking-quick-actions";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { getDailySchedule, getScheduleMonthSummaryInRange } from "@/lib/bookings";
import { formatDate } from "@/lib/format";
import {
  buildTodayWorkQueue,
  buildWorkRiskAlerts,
  filterScheduleWorkItems,
  scheduleWorkFilterLabels,
  type ScheduleWorkFilter
} from "@/lib/frontdesk-work";
import type { BookingType, ScheduleMonthSummaryItem } from "@/types/database";

type ScheduleSearchParams = Promise<{
  month?: string;
  date?: string;
  grooming?: string;
  hotel?: string;
  filters?: string;
  work?: string;
}>;

const bookingTypeLabel = {
  grooming: "อาบน้ำ / ตัดขน",
  hotel: "โรงแรม"
} as const;

function parseMonthParam(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return startOfMonth(new Date());
  }

  const parsed = parse(`${value}-01`, "yyyy-MM-dd", new Date());
  return Number.isNaN(parsed.getTime()) ? startOfMonth(new Date()) : startOfMonth(parsed);
}

function parseDateParam(value: string | undefined, fallback: Date) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fallback;
  }

  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function filterItems<T extends { booking_type: BookingType }>(items: T[], groomingEnabled: boolean, hotelEnabled: boolean) {
  return items.filter((item) => {
    if (item.booking_type === "grooming") {
      return groomingEnabled;
    }

    if (item.booking_type === "hotel") {
      return hotelEnabled;
    }

    return false;
  });
}

function parseWorkFilter(value: string | undefined): ScheduleWorkFilter {
  const allowedFilters = Object.keys(scheduleWorkFilterLabels) as ScheduleWorkFilter[];
  return allowedFilters.includes(value as ScheduleWorkFilter) ? (value as ScheduleWorkFilter) : "all";
}

function getUtcDateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function addDaysToDateKey(value: string, days: number) {
  return format(addDays(parseISO(value), days), "yyyy-MM-dd");
}

function groupItemsByDate<T extends { start_at: string; end_at: string }>(items: T[], visibleStart: Date, visibleEnd: Date) {
  const grouped = new Map<string, T[]>();
  const visibleStartKey = format(visibleStart, "yyyy-MM-dd");
  const visibleEndKey = format(visibleEnd, "yyyy-MM-dd");

  for (const item of items) {
    const startKey = getUtcDateKey(item.start_at);
    const adjustedEnd = subMilliseconds(new Date(item.end_at), 1);
    const endKey = getUtcDateKey(adjustedEnd.toISOString());

    if (Number.isNaN(adjustedEnd.getTime()) || endKey < startKey) {
      continue;
    }

    const loopStartKey = startKey > visibleStartKey ? startKey : visibleStartKey;
    const loopEndKey = endKey < visibleEndKey ? endKey : visibleEndKey;

    for (let key = loopStartKey; key <= loopEndKey; key = addDaysToDateKey(key, 1)) {
      const dayItems = grouped.get(key) ?? [];
      dayItems.push(item);
      grouped.set(key, dayItems);
    }
  }

  for (const dayItems of grouped.values()) {
    dayItems.sort((left, right) => {
      const leftTime = new Date(left.start_at).getTime();
      const rightTime = new Date(right.start_at).getTime();
      return leftTime - rightTime;
    });
  }

  return grouped;
}

function buildCalendarSummary(items: ScheduleMonthSummaryItem[]) {
  let groomingCount = 0;
  let hotelCount = 0;

  for (const item of items) {
    if (item.booking_type === "grooming") {
      groomingCount += 1;
    } else if (item.booking_type === "hotel") {
      hotelCount += 1;
    }
  }

  return {
    totalCount: items.length,
    groomingCount,
    hotelCount
  };
}

export const dynamic = "force-dynamic";

export default async function SchedulePage({ searchParams }: { searchParams?: ScheduleSearchParams }) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="ตารางคิว" subtitle="ภาพรวมคิวรายเดือน พร้อมกดดูรายละเอียดแต่ละวัน" actionLabel="สร้างคิวใหม่" actionHref="/bookings/new" />
        <SetupNotice />
      </main>
    );
  }

  await requireAppUser();

  const params = (await searchParams) ?? {};
  const selectedMonthDate = parseMonthParam(params.month);
  const today = startOfDay(new Date());
  const selectedDateFallback = isSameMonth(selectedMonthDate, today) ? today : selectedMonthDate;
  const selectedDate = startOfDay(parseDateParam(params.date, selectedDateFallback));
  const useCustomFilters = params.filters === "custom";
  const groomingEnabled = useCustomFilters ? params.grooming === "1" : true;
  const hotelEnabled = useCustomFilters ? params.hotel === "1" : true;
  const workFilter = parseWorkFilter(params.work);

  const visibleStart = startOfWeek(selectedMonthDate, { weekStartsOn: 0 });
  const visibleEnd = endOfWeek(endOfMonth(selectedMonthDate), { weekStartsOn: 0 });
  const rangeEndExclusive = addDays(visibleEnd, 1);

  const rangeStartIso = `${format(visibleStart, "yyyy-MM-dd")}T00:00:00.000Z`;
  const rangeEndExclusiveIso = `${format(rangeEndExclusive, "yyyy-MM-dd")}T00:00:00.000Z`;
  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const [rangeSummaryItems, selectedDayItems] = await Promise.all([
    getScheduleMonthSummaryInRange(rangeStartIso, rangeEndExclusiveIso),
    getDailySchedule(selectedDateKey)
  ]);
  const filteredSummaryItems = filterItems(rangeSummaryItems, groomingEnabled, hotelEnabled);
  const groupedSummaryItems = groupItemsByDate(filteredSummaryItems, visibleStart, visibleEnd);
  const selectedItems = filterItems(selectedDayItems, groomingEnabled, hotelEnabled);

  const cells: ScheduleCalendarCell[] = [];

  for (let cursor = visibleStart; cursor <= visibleEnd; cursor = addDays(cursor, 1)) {
    const key = format(cursor, "yyyy-MM-dd");
    const summary = buildCalendarSummary(groupedSummaryItems.get(key) ?? []);

    cells.push({
      date: key,
      inCurrentMonth: isSameMonth(cursor, selectedMonthDate),
      isSelected: isSameDay(cursor, selectedDate),
      isToday: isSameDay(cursor, today),
      ...summary
    });
  }

  const visibleSelectedItems = filterScheduleWorkItems(selectedItems, workFilter);
  const selectedTypeSummary = selectedItems.reduce(
    (summary, item) => ({
      grooming: summary.grooming + (item.booking_type === "grooming" ? 1 : 0),
      hotel: summary.hotel + (item.booking_type === "hotel" ? 1 : 0)
    }),
    { grooming: 0, hotel: 0 }
  );
  const workReferenceDate = isSameDay(selectedDate, today) ? new Date() : selectedDate;
  const selectedWorkQueue = buildTodayWorkQueue(selectedItems, workReferenceDate);
  const selectedRiskAlerts = buildWorkRiskAlerts(selectedItems, workReferenceDate);
  const prevMonth = format(addMonths(selectedMonthDate, -1), "yyyy-MM");
  const nextMonth = format(addMonths(selectedMonthDate, 1), "yyyy-MM");
  const currentMonth = format(today, "yyyy-MM");
  const currentDate = format(today, "yyyy-MM-dd");
  const monthTitle = format(selectedMonthDate, "MMMM yyyy", { locale: th });
  const activeTypes = (Object.keys(bookingTypeLabel) as BookingType[]).filter((type) =>
    type === "grooming" ? groomingEnabled : hotelEnabled
  );

  return (
    <main className="stack schedule-page">
      <div className="schedule-mobile-hidden">
        <PageHeader title="ตารางคิว" subtitle="มุมมองรายเดือนสำหรับกดดูคิวแต่ละวันได้ง่ายทั้งบนคอมและมือถือ" actionLabel="สร้างคิวใหม่" actionHref="/bookings/new" />
      </div>

      <section className="panel stack schedule-month-overview-panel">
        <div className="schedule-month-nav">
          <Link
            className="btn btn-secondary"
            href={{
              pathname: "/schedule",
              query: {
                month: prevMonth,
                filters: useCustomFilters ? "custom" : undefined,
                grooming: groomingEnabled ? "1" : undefined,
                hotel: hotelEnabled ? "1" : undefined,
                work: workFilter !== "all" ? workFilter : undefined
              }
            }}
          >
            เดือนก่อน
          </Link>
          <div className="schedule-month-title">{monthTitle}</div>
          <Link
            className="btn btn-secondary"
            href={{
              pathname: "/schedule",
              query: {
                month: nextMonth,
                filters: useCustomFilters ? "custom" : undefined,
                grooming: groomingEnabled ? "1" : undefined,
                hotel: hotelEnabled ? "1" : undefined,
                work: workFilter !== "all" ? workFilter : undefined
              }
            }}
          >
            เดือนถัดไป
          </Link>
        </div>

        <form className="stack schedule-mobile-hidden" method="get">
          <input type="hidden" name="month" value={format(selectedMonthDate, "yyyy-MM")} />
          <input type="hidden" name="date" value={selectedDateKey} />
          <input type="hidden" name="filters" value="custom" />

          <div className="schedule-filter-row">
            <label className="schedule-toggle">
              <input type="checkbox" name="grooming" value="1" defaultChecked={groomingEnabled} />
              <span>อาบน้ำ / ตัดขน</span>
            </label>
            <label className="schedule-toggle">
              <input type="checkbox" name="hotel" value="1" defaultChecked={hotelEnabled} />
              <span>โรงแรม</span>
            </label>
          </div>

          <div className="schedule-filter-actions">
            <button className="btn btn-primary" type="submit">
              แสดงผล
            </button>
            <Link className="btn btn-secondary" href="/schedule">
              รีเซ็ตตัวกรอง
            </Link>
          </div>
        </form>

        <div className="soft-note schedule-mobile-hidden">
          กำลังแสดง: {activeTypes.length ? activeTypes.map((type) => bookingTypeLabel[type]).join(" / ") : "ไม่มีประเภทที่เลือก"}
        </div>

        <div className="schedule-filter-actions schedule-mobile-hidden">
          <Link
            className="btn btn-secondary"
            href={{
              pathname: "/schedule",
              query: {
                month: currentMonth,
                date: currentDate,
                filters: useCustomFilters ? "custom" : undefined,
                grooming: groomingEnabled ? "1" : undefined,
                hotel: hotelEnabled ? "1" : undefined,
                work: workFilter !== "all" ? workFilter : undefined
              }
            }}
          >
            วันนี้
          </Link>
        </div>
      </section>

      <ScheduleCalendar
        cells={cells}
        groomingEnabled={groomingEnabled}
        hotelEnabled={hotelEnabled}
        useCustomFilters={useCustomFilters}
        workFilter={workFilter}
      />

      <section className="panel stack schedule-mobile-hidden">
        <div className="frontdesk-section-heading">
          <div>
            <div className="section-kicker">Daily filters</div>
            <h2 className="section-title">มุมมองงานของวันที่เลือก</h2>
          </div>
        </div>

        <div className="work-filter-tabs">
          {(Object.keys(scheduleWorkFilterLabels) as ScheduleWorkFilter[]).map((filter) => (
            <Link
              key={filter}
              className={filter === workFilter ? "work-filter-tab work-filter-tab-active" : "work-filter-tab"}
              href={{
                pathname: "/schedule",
                query: {
                  month: format(selectedMonthDate, "yyyy-MM"),
                  date: selectedDateKey,
                  filters: useCustomFilters ? "custom" : undefined,
                  grooming: groomingEnabled ? "1" : undefined,
                  hotel: hotelEnabled ? "1" : undefined,
                  work: filter === "all" ? undefined : filter
                }
              }}
            >
              {scheduleWorkFilterLabels[filter]}
            </Link>
          ))}
        </div>
      </section>

      {selectedRiskAlerts.length ? (
        <section className="panel stack schedule-mobile-hidden">
          <div>
            <div className="section-kicker">Risk Alerts</div>
            <h2 className="section-title">งานที่ควรเช็กในวันที่เลือก</h2>
          </div>
          <div className="work-alert-grid">
            {selectedRiskAlerts.map((alert) => (
              <article key={alert.key} className={`work-alert-card work-alert-card-${alert.tone}`}>
                <div>
                  <strong>{alert.title}</strong>
                  <div className="muted">{alert.description}</div>
                </div>
                <Link className="tap-row-link" href={`/bookings/${alert.item.booking_id}`}>
                  <span>เปิดคิว</span>
                  <span aria-hidden="true">›</span>
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel stack schedule-mobile-hidden">
        <div>
          <div className="section-kicker">Today Work Queue</div>
          <h2 className="section-title">กลุ่มงานของวันที่เลือก</h2>
        </div>
        <div className="work-queue-grid">
          {selectedWorkQueue.map((bucket) => (
            <section key={bucket.key} className="work-queue-column">
              <div className="work-queue-head">
                <div>
                  <strong>{bucket.title}</strong>
                  <p>{bucket.description}</p>
                </div>
                <span>{bucket.items.length}</span>
              </div>
              {bucket.items.length ? (
                <div className="stack">
                  {bucket.items.slice(0, 3).map((item) => (
                    <article key={`${bucket.key}-${item.booking_id}`} className="work-queue-item">
                      <div className="work-queue-item-top">
                        <div>
                          <strong>{formatDate(item.start_at, "HH.mm")} {item.pet_name}</strong>
                          <div className="muted">{item.customer_name}</div>
                        </div>
                      </div>
                      <BookingQuickActions
                        bookingId={item.booking_id}
                        status={item.status}
                        paymentStatus={item.payment_status}
                        customerPhone={item.customer_phone}
                        showStatusAction={false}
                        showCall={false}
                        showDetail={false}
                        showRepeat={false}
                        showReceipt={false}
                        compact
                      />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="soft-note">ไม่มีรายการ</div>
              )}
            </section>
          ))}
        </div>
      </section>

      <section className="panel stack schedule-mobile-day-summary">
        <div>
          <div className="section-kicker">Daily Summary</div>
          <h2 className="section-title">สรุปรายการวันที่เลือก</h2>
        </div>
        <div className="schedule-day-summary-grid">
          <div className="meta-block">
            <div className="meta-label">โรงแรม</div>
            <div className="meta-value">{selectedTypeSummary.hotel} คิว</div>
          </div>
          <div className="meta-block">
            <div className="meta-label">อาบน้ำ</div>
            <div className="meta-value">{selectedTypeSummary.grooming} คิว</div>
          </div>
        </div>
      </section>

      <section className="stack schedule-selected-day-list">
        {visibleSelectedItems.length ? (
          visibleSelectedItems.map((item) => (
            <div key={`${selectedDateKey}-${item.booking_id}`} className="schedule-work-item stack">
              <ScheduleListItem item={item} />
              <BookingQuickActions
                bookingId={item.booking_id}
                status={item.status}
                paymentStatus={item.payment_status}
                customerPhone={item.customer_phone}
                showStatusAction={false}
                showCall={false}
                showDetail={false}
                showRepeat={false}
                showReceipt={false}
                compact
              />
            </div>
          ))
        ) : (
          <EmptyState
            icon={<CalendarDays size={24} strokeWidth={2.1} />}
            title="ไม่มีคิวในวันที่เลือก"
            description="ลองเปลี่ยนวันหรือเปิดประเภทคิวเพิ่มเติมเพื่อดูรายการที่เกี่ยวข้อง"
            action={
              <Link className="btn btn-primary" href="/bookings/new">
                สร้างคิวใหม่
              </Link>
            }
          />
        )}
      </section>
    </main>
  );
}
