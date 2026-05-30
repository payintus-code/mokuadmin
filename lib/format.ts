import { format } from "date-fns";
import { th } from "date-fns/locale";

export function formatTime(value: string) {
  return format(new Date(value), "HH.mm");
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
  return format(new Date(value), pattern, { locale: th });
}

export function formatDateTime(value: string | Date, pattern = "d MMM yyyy HH.mm") {
  return format(new Date(value), pattern, { locale: th });
}
