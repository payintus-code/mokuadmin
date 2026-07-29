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
  hotelCheckInCount: number;
  hotelCheckOutCount: number;
};

export type ScheduleTimedEventKind = "grooming" | "hotel-check-in" | "hotel-check-out";

export type TimedEventLayout = DailyScheduleItem & {
  eventKind: ScheduleTimedEventKind;
  eventAt: string;
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
  const emptyCounts = () => ({
    totalCount: 0,
    groomingCount: 0,
    hotelCount: 0,
    hotelCheckInCount: 0,
    hotelCheckOutCount: 0
  });
  const counts = new Map<string, ReturnType<typeof emptyCounts>>();
  const startKey = dateKey(range.start);
  const endKey = dateKey(addDays(range.endExclusive, -1));
  for (const item of items) {
    const itemStart = eventDateKey(item.start_at);

    if (item.booking_type === "hotel") {
      const endpoints = [
        { key: itemStart, kind: "check-in" as const },
        { key: eventDateKey(item.end_at), kind: "check-out" as const }
      ];

      for (const endpoint of endpoints) {
        if (!endpoint.key || endpoint.key < startKey || endpoint.key > endKey) {
          continue;
        }

        const current = counts.get(endpoint.key) ?? emptyCounts();
        current.totalCount += 1;
        current.hotelCount += 1;
        if (endpoint.kind === "check-in") current.hotelCheckInCount += 1;
        else current.hotelCheckOutCount += 1;
        counts.set(endpoint.key, current);
      }

      continue;
    }

    const adjustedEnd = new Date(new Date(item.end_at).getTime() - 1);
    const itemEnd = eventDateKey(adjustedEnd.toISOString());
    for (let key = itemStart < startKey ? startKey : itemStart; key && key <= (itemEnd > endKey ? endKey : itemEnd); key = dateKey(addDays(parseISO(key), 1))) {
      const current = counts.get(key) ?? emptyCounts();
      current.totalCount += 1;
      current.groomingCount += 1;
      counts.set(key, current);
    }
  }
  const cells: ZoomScheduleMonthCell[] = [];
  for (let cursor = range.start; cursor < range.endExclusive; cursor = addDays(cursor, 1)) {
    const key = dateKey(cursor);
    cells.push({ date: key, inCurrentMonth: isSameMonth(cursor, anchor), isToday: key === dateKey(now), ...(counts.get(key) ?? emptyCounts()) });
  }
  return cells;
}

function minuteOfDay(value: string) {
  const date = new Date(value);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function layoutTimedEvents(items: DailyScheduleItem[], visibleDayKeys?: string[]): TimedEventLayout[] {
  type PreparedEvent = DailyScheduleItem & {
    eventKind: ScheduleTimedEventKind;
    eventAt: string;
  };

  const visibleDays = visibleDayKeys ? new Set(visibleDayKeys) : null;
  const byDay = new Map<string, PreparedEvent[]>();
  for (const item of items) {
    const events: PreparedEvent[] = item.booking_type === "hotel"
      ? [
          { ...item, eventKind: "hotel-check-in", eventAt: item.start_at },
          { ...item, eventKind: "hotel-check-out", eventAt: item.end_at }
        ]
      : [{ ...item, eventKind: "grooming", eventAt: item.start_at }];

    for (const event of events) {
      const key = eventDateKey(event.eventAt);
      if (!key || (visibleDays && !visibleDays.has(key))) {
        continue;
      }

      byDay.set(key, [...(byDay.get(key) ?? []), event]);
    }
  }
  const result: TimedEventLayout[] = [];
  for (const [dayKey, dayItems] of byDay) {
    const sorted = [...dayItems].sort((a, b) => new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime());
    let cluster: TimedEventLayout[] = [];
    let clusterEnd = -1;
    const flush = () => {
      const columns = Math.max(1, ...cluster.map((entry) => entry.column + 1));
      cluster.forEach((entry) => result.push({ ...entry, columns }));
      cluster = [];
      clusterEnd = -1;
    };
    for (const item of sorted) {
      const startMinute = minuteOfDay(item.eventAt);
      const endMinute = item.eventKind === "grooming"
        ? Math.max(startMinute + 30, minuteOfDay(item.end_at))
        : startMinute + 30;
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
