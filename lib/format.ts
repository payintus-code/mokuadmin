import { format } from "date-fns";
import { th } from "date-fns/locale";

const thaiMonthsShort = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thaiWeekdaysFull = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getUtcParts(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth(),
    year: date.getUTCFullYear(),
    weekday: date.getUTCDay(),
    hours: date.getUTCHours(),
    minutes: date.getUTCMinutes()
  };
}

function formatUtcDate(value: string, pattern: string) {
  const parts = getUtcParts(value);

  if (!parts) {
    return value;
  }

  return pattern
    .replace("EEEE", thaiWeekdaysFull[parts.weekday])
    .replace("yyyy", String(parts.year))
    .replace("MMM", thaiMonthsShort[parts.month])
    .replace("MM", pad(parts.month + 1))
    .replace("dd", pad(parts.day))
    .replace("d", String(parts.day))
    .replace("HH", pad(parts.hours))
    .replace("mm", pad(parts.minutes));
}

export function formatTime(value: string) {
  return formatUtcDate(value, "HH.mm");
}

export function formatDateInput(date = new Date()) {
  return format(date, "yyyy-MM-dd");
}

export function formatBaht(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDate(value: string | Date, pattern = "d MMM yyyy") {
  if (typeof value === "string") {
    return formatUtcDate(value, pattern);
  }

  return format(new Date(value), pattern, { locale: th });
}

export function formatDateTime(value: string | Date, pattern = "d MMM yyyy HH.mm") {
  if (typeof value === "string") {
    return formatUtcDate(value, pattern);
  }

  return format(new Date(value), pattern, { locale: th });
}
