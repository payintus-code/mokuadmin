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
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { getScheduleInRange } from "@/lib/bookings";
import { formatDate } from "@/lib/format";
import type { BookingType, DailyScheduleItem } from "@/types/database";

type ScheduleSearchParams = Promise<{
  month?: string;
  date?: string;
  grooming?: string;
  hotel?: string;
  filters?: string;
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

function filterItems(items: DailyScheduleItem[], groomingEnabled: boolean, hotelEnabled: boolean) {
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

function groupItemsByDate(items: DailyScheduleItem[], visibleStart: Date, visibleEnd: Date) {
  const grouped = new Map<string, DailyScheduleItem[]>();

  for (const item of items) {
    const start = startOfDay(new Date(item.start_at));
    const adjustedEnd = subMilliseconds(new Date(item.end_at), 1);

    if (Number.isNaN(start.getTime()) || Number.isNaN(adjustedEnd.getTime()) || adjustedEnd < start) {
      continue;
    }

    const loopStart = start > visibleStart ? start : visibleStart;
    const loopEnd = startOfDay(adjustedEnd) < visibleEnd ? startOfDay(adjustedEnd) : visibleEnd;

    for (let cursor = loopStart; cursor <= loopEnd; cursor = addDays(cursor, 1)) {
      const key = format(cursor, "yyyy-MM-dd");
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

  const visibleStart = startOfWeek(selectedMonthDate, { weekStartsOn: 0 });
  const visibleEnd = endOfWeek(endOfMonth(selectedMonthDate), { weekStartsOn: 0 });
  const rangeEndExclusive = addDays(visibleEnd, 1);

  const rangeItems = await getScheduleInRange(visibleStart.toISOString(), rangeEndExclusive.toISOString());
  const filteredItems = filterItems(rangeItems, groomingEnabled, hotelEnabled);
  const groupedItems = groupItemsByDate(filteredItems, visibleStart, visibleEnd);

  const cells: ScheduleCalendarCell[] = [];

  for (let cursor = visibleStart; cursor <= visibleEnd; cursor = addDays(cursor, 1)) {
    const key = format(cursor, "yyyy-MM-dd");
    cells.push({
      date: key,
      inCurrentMonth: isSameMonth(cursor, selectedMonthDate),
      isSelected: isSameDay(cursor, selectedDate),
      isToday: isSameDay(cursor, today),
      items: groupedItems.get(key) ?? []
    });
  }

  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");
  const selectedItems = groupedItems.get(selectedDateKey) ?? [];
  const prevMonth = format(addMonths(selectedMonthDate, -1), "yyyy-MM");
  const nextMonth = format(addMonths(selectedMonthDate, 1), "yyyy-MM");
  const monthTitle = format(selectedMonthDate, "MMMM yyyy", { locale: th });
  const activeTypes = (Object.keys(bookingTypeLabel) as BookingType[]).filter((type) =>
    type === "grooming" ? groomingEnabled : hotelEnabled
  );

  return (
    <main className="stack">
      <PageHeader title="ตารางคิว" subtitle="มุมมองรายเดือนสำหรับกดดูคิวแต่ละวันได้ง่ายทั้งบนคอมและมือถือ" actionLabel="สร้างคิวใหม่" actionHref="/bookings/new" />

      <section className="panel stack">
        <div className="schedule-month-nav">
          <Link
            className="btn btn-secondary"
            href={{
              pathname: "/schedule",
              query: {
                month: prevMonth,
                filters: useCustomFilters ? "custom" : undefined,
                grooming: groomingEnabled ? "1" : undefined,
                hotel: hotelEnabled ? "1" : undefined
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
                hotel: hotelEnabled ? "1" : undefined
              }
            }}
          >
            เดือนถัดไป
          </Link>
        </div>

        <form className="stack" method="get">
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

        <div className="soft-note">
          กำลังแสดง: {activeTypes.length ? activeTypes.map((type) => bookingTypeLabel[type]).join(" / ") : "ไม่มีประเภทที่เลือก"}
        </div>
      </section>

      <ScheduleCalendar
        cells={cells}
        groomingEnabled={groomingEnabled}
        hotelEnabled={hotelEnabled}
        useCustomFilters={useCustomFilters}
      />

      <section className="stack">
        <div className="panel">
          <strong>คิววันที่ {formatDate(selectedDate, "EEEE d MMM yyyy")}</strong>
          <p className="section-copy" style={{ margin: "8px 0 0" }}>
            {selectedItems.length ? `มีทั้งหมด ${selectedItems.length} คิวในวันที่เลือก` : "ยังไม่มีคิวตามประเภทที่เลือกในวันนี้"}
          </p>
        </div>

        {selectedItems.length ? (
          selectedItems.map((item) => <ScheduleListItem key={`${selectedDateKey}-${item.booking_id}`} item={item} />)
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
