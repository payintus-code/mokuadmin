import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { th } from "date-fns/locale";
import type { DailyScheduleItem, ScheduleMonthSummaryItem } from "@/types/database";

export type ScheduleZoomLevel = "month" | "week" | "day";
export type ZoomDirection = "in" | "out";

export type ZoomScheduleMonthCell = {
  date: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  totalCount: number;
  groomingCount: number;
  hotelCount: number;
};

export type TimedEventLayout = DailyScheduleItem & {
  dayKey: string;
  startMinute: number;
  endMinute: number;
  column: number;
  columns: number;
};

export function dateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function eventDateKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function parseScheduleZoomLevel(value?: string): ScheduleZoomLevel {
  return value === "week" || value === "day" ? value : "month";
}

export function parseScheduleAnchor(value: string | undefined, now = new Date()) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return now;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? now : parsed;
}

export function zoomScheduleLevel(level: ScheduleZoomLevel, direction: ZoomDirection): ScheduleZoomLevel {
  if (direction === "in") return level === "month" ? "week" : "day";
  return level === "day" ? "week" : "month";
}

export function getScheduleRange(level: ScheduleZoomLevel, anchor: Date) {
  if (level === "month") {
    const monthStart = startOfMonth(anchor);
    const start = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endInclusive = endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
    return {
      start,
      endExclusive: addDays(endInclusive, 1),
      previousDate: dateKey(addMonths(anchor, -1)),
      nextDate: dateKey(addMonths(anchor, 1)),
      title: format(anchor, "MMMM yyyy", { locale: th })
    };
  }
  if (level === "week") {
    const start = startOfWeek(anchor, { weekStartsOn: 0 });
    return {
      start,
      endExclusive: addDays(start, 7),
      previousDate: dateKey(addWeeks(anchor, -1)),
      nextDate: dateKey(addWeeks(anchor, 1)),
      title: `${format(start, "d MMM", { locale: th })} – ${format(addDays(start, 6), "d MMM yyyy", { locale: th })}`
    };
  }
  return {
    start: anchor,
    endExclusive: addDays(anchor, 1),
    previousDate: dateKey(addDays(anchor, -1)),
    nextDate: dateKey(addDays(anchor, 1)),
    title: format(anchor, "EEEE d MMMM yyyy", { locale: th })
  };
}

export function buildMonthCells(items: ScheduleMonthSummaryItem[], anchor: Date, now = new Date()): ZoomScheduleMonthCell[] {
  const range = getScheduleRange("month", anchor);
  const counts = new Map<string, { totalCount: number; groomingCount: number; hotelCount: number }>();
  const startKey = dateKey(range.start);
  const endKey = dateKey(addDays(range.endExclusive, -1));
  for (const item of items) {
    const itemStart = eventDateKey(item.start_at);
    const adjustedEnd = new Date(new Date(item.end_at).getTime() - 1);
    const itemEnd = eventDateKey(adjustedEnd.toISOString());
    for (let key = itemStart < startKey ? startKey : itemStart; key && key <= (itemEnd > endKey ? endKey : itemEnd); key = dateKey(addDays(parseISO(key), 1))) {
      const current = counts.get(key) ?? { totalCount: 0, groomingCount: 0, hotelCount: 0 };
      current.totalCount += 1;
      if (item.booking_type === "grooming") current.groomingCount += 1;
      else current.hotelCount += 1;
      counts.set(key, current);
    }
  }
  const cells: ZoomScheduleMonthCell[] = [];
  for (let cursor = range.start; cursor < range.endExclusive; cursor = addDays(cursor, 1)) {
    const key = dateKey(cursor);
    cells.push({ date: key, inCurrentMonth: isSameMonth(cursor, anchor), isToday: key === dateKey(now), ...(counts.get(key) ?? { totalCount: 0, groomingCount: 0, hotelCount: 0 }) });
  }
  return cells;
}

function minuteOfDay(value: string) {
  const date = new Date(value);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function layoutTimedEvents(items: DailyScheduleItem[]): TimedEventLayout[] {
  const byDay = new Map<string, DailyScheduleItem[]>();
  for (const item of items.filter((entry) => entry.booking_type === "grooming")) {
    const key = eventDateKey(item.start_at);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }
  const result: TimedEventLayout[] = [];
  for (const [dayKey, dayItems] of byDay) {
    const sorted = [...dayItems].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    let cluster: TimedEventLayout[] = [];
    let clusterEnd = -1;
    const flush = () => {
      const columns = Math.max(1, ...cluster.map((entry) => entry.column + 1));
      cluster.forEach((entry) => result.push({ ...entry, columns }));
      cluster = [];
      clusterEnd = -1;
    };
    for (const item of sorted) {
      const startMinute = minuteOfDay(item.start_at);
      const endMinute = Math.max(startMinute + 30, minuteOfDay(item.end_at));
      if (cluster.length && startMinute >= clusterEnd) flush();
      const occupied = new Set(cluster.filter((entry) => entry.endMinute > startMinute).map((entry) => entry.column));
      let column = 0;
      while (occupied.has(column)) column += 1;
      cluster.push({ ...item, dayKey, startMinute, endMinute, column, columns: 1 });
      clusterEnd = Math.max(clusterEnd, endMinute);
    }
    if (cluster.length) flush();
  }
  return result;
}
