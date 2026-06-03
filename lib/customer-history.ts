import { resolvePaymentStatus } from "@/lib/payment-status";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingPayment, BookingStatus, BookingType, CustomerHistoryBookingItem, CustomerHistoryViewModel, PaymentStatus } from "@/types/database";

function toSingle<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function mapHistoryItem(booking: {
  id: string;
  booking_no: string;
  booking_type: BookingType;
  status: BookingStatus;
  start_at: string;
  end_at: string;
  total_amount: number | string;
  pets?: { name?: string } | Array<{ name?: string }> | null;
  secondary_pets?: { name?: string } | Array<{ name?: string }> | null;
  rooms?: { name?: string } | Array<{ name?: string }> | null;
  booking_payments?:
    | { status?: PaymentStatus; amount?: number | string | null }
    | Array<{ status?: PaymentStatus; amount?: number | string | null }>
    | null;
  booking_items?:
    | Array<{
        services?: { name?: string } | Array<{ name?: string }> | null;
      }>
    | null;
}): CustomerHistoryBookingItem {
  const primaryPet = toSingle(booking.pets);
  const secondaryPet = toSingle(booking.secondary_pets);
  const room = toSingle(booking.rooms);
  const payment = toSingle(booking.booking_payments) as BookingPayment | null;

  return {
    booking_id: booking.id,
    booking_no: booking.booking_no,
    booking_type: booking.booking_type,
    status: booking.status,
    payment_status: resolvePaymentStatus({
      totalAmount: Number(booking.total_amount),
      paidAmount: Number(payment?.amount ?? 0),
      storedStatus: payment?.status ?? "pending"
    }),
    start_at: booking.start_at,
    end_at: booking.end_at,
    pet_name: [primaryPet?.name, secondaryPet?.name].filter((name): name is string => Boolean(name)).join(", ") || "-",
    room_name: room?.name ?? null,
    services_summary:
      booking.booking_items
        ?.map((item) => toSingle(item.services)?.name)
        .filter((name): name is string => Boolean(name))
        .sort((left, right) => left.localeCompare(right))
        .join(", ") ?? "",
    total_amount: Number(booking.total_amount)
  };
}

export async function getCustomerHistory(customerId: string): Promise<CustomerHistoryViewModel | null> {
  const supabase = createAdminClient();

  const [{ data: customer, error: customerError }, { data: pets, error: petsError }, { data: bookings, error: bookingsError }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, full_name, phone, facebook_name, note")
      .eq("id", customerId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("pets").select("id, name, species").eq("customer_id", customerId).eq("is_active", true).order("name"),
    supabase
      .from("bookings")
      .select(
        `
          id,
          booking_no,
          booking_type,
          status,
          start_at,
          end_at,
          total_amount,
          pets!bookings_pet_id_fkey(name),
          secondary_pets:pets!bookings_secondary_pet_id_fkey(name),
          rooms(name),
          booking_items(services(name)),
          booking_payments(status, amount)
        `
      )
      .eq("customer_id", customerId)
      .order("start_at", { ascending: false })
      .order("created_at", { ascending: false })
  ]);

  if (customerError) {
    throw new Error(customerError.message);
  }

  if (petsError) {
    throw new Error(petsError.message);
  }

  if (bookingsError) {
    throw new Error(bookingsError.message);
  }

  if (!customer) {
    return null;
  }

  const history = (bookings ?? []).map((booking) =>
    mapHistoryItem({
      ...booking,
      booking_type: booking.booking_type as BookingType,
      status: booking.status as BookingStatus
    })
  );
  const completedHistory = history.filter((item) => item.status === "done");

  return {
    ...customer,
    pets: (pets ?? []).map((pet) => ({
      id: pet.id,
      name: pet.name,
      species: pet.species
    })),
    grooming_count: completedHistory.filter((item) => item.booking_type === "grooming").length,
    hotel_count: completedHistory.filter((item) => item.booking_type === "hotel").length,
    total_completed_count: completedHistory.length,
    last_service_at: completedHistory[0]?.start_at ?? null,
    history
  };
}
