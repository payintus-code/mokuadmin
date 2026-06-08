import { addDays, differenceInCalendarDays, subDays } from "date-fns";
import type { BookingType, MarketingCustomerRow, MarketingDemandBucket, MarketingServiceRow } from "../types/database.ts";

const BUSINESS_TIME_ZONE = "Asia/Bangkok";
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_BUCKETS = [
  { start: 0, end: 1, label: "00:00-01:59" },
  { start: 2, end: 3, label: "02:00-03:59" },
  { start: 4, end: 5, label: "04:00-05:59" },
  { start: 6, end: 7, label: "06:00-07:59" },
  { start: 8, end: 9, label: "08:00-09:59" },
  { start: 10, end: 11, label: "10:00-11:59" },
  { start: 12, end: 13, label: "12:00-13:59" },
  { start: 14, end: 15, label: "14:00-15:59" },
  { start: 16, end: 17, label: "16:00-17:59" },
  { start: 18, end: 19, label: "18:00-19:59" },
  { start: 20, end: 21, label: "20:00-21:59" },
  { start: 22, end: 23, label: "22:00-23:59" }
] as const;

type MarketingBookingPet = {
  name: string;
  species: string;
  breed: string | null;
};

type MarketingBookingService = {
  name: string;
  qty: number;
  lineTotal: number;
};

export type MarketingBookingSnapshot = {
  bookingId: string;
  bookingType: BookingType;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  facebookName: string | null;
  customerCreatedAt: string | null;
  startAt: string;
  endAt: string;
  totalAmount: number;
  roomName: string | null;
  pets: MarketingBookingPet[];
  services: MarketingBookingService[];
};

export type MarketingCustomerSnapshot = {
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  facebookName: string | null;
  customerCreatedAt: string | null;
  lastBookingAt: string;
  bookingCount: number;
  totalSpend: number;
  petSummary: string;
};

function getBusinessDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function getBusinessHour(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    hour12: false
  }).formatToParts(new Date(value));

  return Number(parts.find((part) => part.type === "hour")?.value ?? "0");
}

function getBusinessWeekday(value: string) {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "short"
  }).format(new Date(value));

  const index = WEEKDAY_LABELS.indexOf(label);
  return index >= 0 ? index : 0;
}

export function calculateRepeatRate(activeCustomers: number, repeatCustomers: number) {
  if (activeCustomers <= 0) {
    return 0;
  }

  return repeatCustomers / activeCustomers;
}

export function calculateAverageOrderValue(revenue: number, completedBookings: number) {
  if (completedBookings <= 0) {
    return 0;
  }

  return revenue / completedBookings;
}

export function segmentWinBackCustomers(customers: MarketingCustomerSnapshot[], asOfDate: string) {
  const asOf = new Date(`${asOfDate}T00:00:00+07:00`);

  return customers
    .map((customer) => {
      const daysSinceLastBooking = differenceInCalendarDays(asOf, new Date(customer.lastBookingAt));
      let segment: MarketingCustomerRow["win_back_segment"] = null;

      if (daysSinceLastBooking >= 90) {
        segment = "90d";
      } else if (daysSinceLastBooking >= 60) {
        segment = "60d";
      } else if (daysSinceLastBooking >= 30) {
        segment = "30d";
      }

      return {
        customer_id: customer.customerId,
        customer_name: customer.customerName,
        customer_phone: customer.customerPhone,
        facebook_name: customer.facebookName,
        booking_count: customer.bookingCount,
        total_spend: customer.totalSpend,
        average_order_value: calculateAverageOrderValue(customer.totalSpend, customer.bookingCount),
        last_booking_at: customer.lastBookingAt,
        days_since_last_booking: daysSinceLastBooking,
        win_back_segment: segment,
        is_at_risk: customer.bookingCount >= 3 && daysSinceLastBooking >= 60,
        pet_summary: customer.petSummary
      } satisfies MarketingCustomerRow;
    })
    .filter((customer) => customer.win_back_segment)
    .sort((left, right) => {
      if ((right.days_since_last_booking ?? 0) !== (left.days_since_last_booking ?? 0)) {
        return (right.days_since_last_booking ?? 0) - (left.days_since_last_booking ?? 0);
      }

      return right.total_spend - left.total_spend;
    });
}

export function aggregateTopServices(bookings: MarketingBookingSnapshot[]): MarketingServiceRow[] {
  const totals = new Map<string, { quantity: number; bookingIds: Set<string>; revenue: number }>();
  const totalRevenue = bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);

  for (const booking of bookings) {
    for (const service of booking.services) {
      const current = totals.get(service.name) ?? { quantity: 0, bookingIds: new Set<string>(), revenue: 0 };
      current.quantity += service.qty;
      current.bookingIds.add(booking.bookingId);
      current.revenue += service.lineTotal;
      totals.set(service.name, current);
    }
  }

  return Array.from(totals.entries())
    .map(([serviceName, service]) => ({
      service_name: serviceName,
      quantity: service.quantity,
      booking_count: service.bookingIds.size,
      revenue: service.revenue,
      revenue_share: totalRevenue > 0 ? service.revenue / totalRevenue : 0
    }))
    .sort((left, right) => {
      if (right.revenue !== left.revenue) {
        return right.revenue - left.revenue;
      }

      return right.booking_count - left.booking_count;
    });
}

export function buildDemandBuckets(bookings: MarketingBookingSnapshot[]) {
  const totalBookings = bookings.length;
  const weekdayTotals = WEEKDAY_LABELS.map((label, index) => ({
    key: String(index),
    label,
    booking_count: 0,
    revenue: 0,
    share_of_bookings: 0
  }));
  const hourTotals = HOUR_BUCKETS.map((bucket, index) => ({
    key: String(index),
    label: bucket.label,
    booking_count: 0,
    revenue: 0,
    share_of_bookings: 0
  }));

  for (const booking of bookings) {
    const weekdayIndex = getBusinessWeekday(booking.startAt);
    weekdayTotals[weekdayIndex].booking_count += 1;
    weekdayTotals[weekdayIndex].revenue += booking.totalAmount;

    const hour = getBusinessHour(booking.startAt);
    const hourIndex = HOUR_BUCKETS.findIndex((bucket) => hour >= bucket.start && hour <= bucket.end);

    if (hourIndex >= 0) {
      hourTotals[hourIndex].booking_count += 1;
      hourTotals[hourIndex].revenue += booking.totalAmount;
    }
  }

  const finalize = (rows: MarketingDemandBucket[]) =>
    rows.map((row) => ({
      ...row,
      share_of_bookings: totalBookings > 0 ? row.booking_count / totalBookings : 0
    }));

  return {
    weekday: finalize(weekdayTotals),
    hour: finalize(hourTotals)
  };
}

export function getDefaultMarketingDateRange(today = new Date()) {
  const endDate = getBusinessDateKey(today);
  const startDate = getBusinessDateKey(subDays(today, 89));

  return {
    startDate,
    endDate
  };
}

export function toRangeStartIso(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+07:00`).toISOString();
}

export function toRangeEndExclusiveIso(dateKey: string) {
  const nextDay = addDays(new Date(`${dateKey}T00:00:00+07:00`), 1);
  return nextDay.toISOString();
}
