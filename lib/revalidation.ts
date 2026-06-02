import { revalidatePath } from "next/cache";

function revalidate(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

export function revalidateBookingSurfaces(bookingId?: string) {
  revalidate(["/", "/schedule", "/finance"]);

  if (bookingId) {
    revalidate([`/bookings/${bookingId}`, `/payments/${bookingId}`, `/receipts/${bookingId}`]);
  }
}

export function revalidateBookingCreationSurfaces() {
  revalidate(["/", "/schedule", "/bookings/new", "/customers", "/pets"]);
}

export function revalidateCustomerPetSurfaces() {
  revalidate(["/customers", "/pets", "/bookings/new"]);
}

export function revalidateFinanceSurfaces(options?: { includeReport?: boolean; includeSchedule?: boolean }) {
  revalidate(["/", "/finance"]);

  if (options?.includeReport) {
    revalidatePath("/finance/report");
  }

  if (options?.includeSchedule) {
    revalidatePath("/schedule");
  }
}
