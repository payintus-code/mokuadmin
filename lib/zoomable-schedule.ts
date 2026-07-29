import { addDays } from "date-fns";
import { getScheduleInRange, getScheduleMonthSummaryInRange } from "@/lib/bookings";
import { buildMonthCells, dateKey, getScheduleRange, layoutTimedEvents, parseScheduleAnchor, parseScheduleZoomLevel, type ScheduleZoomLevel, type TimedEventLayout, type ZoomScheduleMonthCell } from "@/lib/zoomable-schedule-core";

export type ZoomableScheduleViewModel = {
  view: ScheduleZoomLevel;
  anchorDate: string;
  today: string;
  title: string;
  previousDate: string;
  nextDate: string;
  dayKeys: string[];
  monthCells: ZoomScheduleMonthCell[];
  timedEvents: TimedEventLayout[];
};

export async function buildZoomableScheduleViewModel(params: { view?: string; date?: string } = {}): Promise<ZoomableScheduleViewModel> {
  const now = new Date();
  const view = parseScheduleZoomLevel(params.view);
  const anchor = parseScheduleAnchor(params.date, now);
  const range = getScheduleRange(view, anchor);
  const common = { view, anchorDate: dateKey(anchor), today: dateKey(now), title: range.title, previousDate: range.previousDate, nextDate: range.nextDate };
  if (view === "month") {
    const items = await getScheduleMonthSummaryInRange(`${dateKey(range.start)}T00:00:00.000Z`, `${dateKey(range.endExclusive)}T00:00:00.000Z`);
    return { ...common, dayKeys: [], monthCells: buildMonthCells(items, anchor, now), timedEvents: [] };
  }

  const dayKeys = view === "day"
    ? [dateKey(anchor)]
    : Array.from({ length: 7 }, (_, index) => dateKey(addDays(range.start, index)));
  const items = await getScheduleInRange(`${dateKey(range.start)}T00:00:00.000Z`, `${dateKey(range.endExclusive)}T00:00:00.000Z`);
  return { ...common, dayKeys, monthCells: [], timedEvents: layoutTimedEvents(items, dayKeys) };
}
