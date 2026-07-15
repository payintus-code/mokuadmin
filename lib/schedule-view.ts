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
import { getDailySchedule, getScheduleInRange, getScheduleMonthSummaryInRange } from "@/lib/bookings";
import {
  buildTodayWorkQueue,
  buildWorkRiskAlerts,
  filterScheduleWorkItems,
  scheduleWorkFilterLabels,
  type ScheduleWorkFilter,
  type WorkQueueBucket,
  type WorkRiskAlert
} from "@/lib/frontdesk-work";
import type { BookingType, DailyScheduleItem, ScheduleMonthSummaryItem } from "@/types/database";

export type ScheduleSearchParamsInput = {
  month?: string;
  date?: string;
  grooming?: string;
  hotel?: string;
  filters?: string;
  work?: string;
};

export type ScheduleCalendarQueueItemViewModel = Pick<
  DailyScheduleItem,
  "booking_id" | "booking_type" | "start_at" | "pet_name" | "services_summary"
>;

export type ScheduleCalendarCellViewModel = {
  date: string;
  inCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  totalCount: number;
  groomingCount: number;
  hotelCount: number;
  items: ScheduleCalendarQueueItemViewModel[];
};

export type ScheduleViewModel = {
  cells: ScheduleCalendarCellViewModel[];
  selectedDateKey: string;
  selectedMonthKey: string;
  prevMonth: string;
  nextMonth: string;
  currentMonth: string;
  currentDate: string;
  monthTitle: string;
  useCustomFilters: boolean;
  groomingEnabled: boolean;
  hotelEnabled: boolean;
  workFilter: ScheduleWorkFilter;
  activeTypes: BookingType[];
  selectedItems: DailyScheduleItem[];
  visibleSelectedItems: DailyScheduleItem[];
  selectedTypeSummary: {
    grooming: number;
    hotel: number;
  };
  selectedWorkQueue: WorkQueueBucket[];
  selectedRiskAlerts: WorkRiskAlert[];
};

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

function buildCalendarSummary<T extends { booking_type: BookingType }>(items: T[]) {
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

function isDailyScheduleItem(item: DailyScheduleItem | ScheduleMonthSummaryItem): item is DailyScheduleItem {
  return "pet_name" in item;
}

export async function buildScheduleViewModel(
  params: ScheduleSearchParamsInput = {},
  options?: { includeCalendarItems?: boolean }
): Promise<ScheduleViewModel> {
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
  const [rangeItems, selectedDayItems] = await Promise.all([
    options?.includeCalendarItems
      ? getScheduleInRange(rangeStartIso, rangeEndExclusiveIso)
      : getScheduleMonthSummaryInRange(rangeStartIso, rangeEndExclusiveIso),
    getDailySchedule(selectedDateKey)
  ]);
  const filteredRangeItems = filterItems(rangeItems, groomingEnabled, hotelEnabled);
  const groupedRangeItems = groupItemsByDate(filteredRangeItems, visibleStart, visibleEnd);
  const selectedItems = filterItems(selectedDayItems, groomingEnabled, hotelEnabled);
  const cells: ScheduleCalendarCellViewModel[] = [];

  for (let cursor = visibleStart; cursor <= visibleEnd; cursor = addDays(cursor, 1)) {
    const key = format(cursor, "yyyy-MM-dd");
    const dayItems = groupedRangeItems.get(key) ?? [];
    const summary = buildCalendarSummary(dayItems);

    cells.push({
      date: key,
      inCurrentMonth: isSameMonth(cursor, selectedMonthDate),
      isSelected: isSameDay(cursor, selectedDate),
      isToday: isSameDay(cursor, today),
      items: dayItems.flatMap((item) =>
        isDailyScheduleItem(item)
          ? [{
              booking_id: item.booking_id,
              booking_type: item.booking_type,
              start_at: item.start_at,
              pet_name: item.pet_name,
              services_summary: item.services_summary
            }]
          : []
      ),
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
  const activeTypes = (["grooming", "hotel"] as BookingType[]).filter((type) =>
    type === "grooming" ? groomingEnabled : hotelEnabled
  );

  return {
    cells,
    selectedDateKey,
    selectedMonthKey: format(selectedMonthDate, "yyyy-MM"),
    prevMonth: format(addMonths(selectedMonthDate, -1), "yyyy-MM"),
    nextMonth: format(addMonths(selectedMonthDate, 1), "yyyy-MM"),
    currentMonth: format(today, "yyyy-MM"),
    currentDate: format(today, "yyyy-MM-dd"),
    monthTitle: format(selectedMonthDate, "MMMM yyyy", { locale: th }),
    useCustomFilters,
    groomingEnabled,
    hotelEnabled,
    workFilter,
    activeTypes,
    selectedItems,
    visibleSelectedItems,
    selectedTypeSummary,
    selectedWorkQueue: buildTodayWorkQueue(selectedItems, workReferenceDate),
    selectedRiskAlerts: buildWorkRiskAlerts(selectedItems, workReferenceDate)
  };
}
