import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePaymentStatus } from "@/lib/payment-status";
import { createClient } from "@/lib/supabase/server";
import { evaluateGroomingDraftAvailability, type GroomingOverlapRow } from "@/lib/grooming-draft";
import type {
  BookingDetailViewModel,
  BookingPayment,
  BookingStatus,
  BookingType,
  DailyScheduleItem,
  Pet,
  ScheduleMonthSummaryItem
} from "@/types/database";

export type BookingItemInput = {
  serviceId: string;
  qty: number;
  unitPrice: number;
  durationMinutes: number;
  note?: string;
};

export type CreateBookingInput = {
  bookingType: BookingType;
  customerId: string;
  petId: string;
  secondaryPetId?: string | null;
  roomId?: string | null;
  startAt: string;
  endAt: string;
  note?: string;
  totalAmount: number;
  items?: BookingItemInput[];
  actorUserId?: string | null;
};

export type AvailableRoomOption = {
  room_id: string;
  code: string;
  name: string;
  room_type: string;
  nightly_rate: number;
};

export type BookingRepeatDraft = {
  bookingType: BookingType;
  customer: {
    id: string;
    full_name: string;
    phone: string;
    facebook_name: string | null;
    note: string | null;
  };
  petId: string;
  secondaryPetId: string | null;
  pets: Pet[];
  serviceId: string;
  totalAmount: number;
  note: string;
};


const GROOMING_CAPACITY = 3;

type DailyScheduleRpcRow = {
  booking_id: string;
  booking_no: string;
  booking_type: BookingType;
  status: BookingStatus;
  payment_status: DailyScheduleItem["payment_status"];
  start_at: string;
  end_at: string;
  customer_name: string;
  customer_phone?: string | null;
  pet_name: string;
  room_name: string | null;
  services_summary: string | null;
  total_amount: number | string;
};

type UnpaidBookingRpcRow = DailyScheduleRpcRow;

export type DashboardQueueCounts = {
  todayAll: number;
  todayPending: number;
  todayDone: number;
  unpaid: number;
};

function toSingle<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function mapBookingToScheduleItem(booking: {
  id: string;
  booking_no: string;
  booking_type: BookingType;
  status: BookingStatus;
  start_at: string;
  end_at: string;
  total_amount: number | string;
  customers?: { id?: string; full_name?: string; phone?: string | null } | Array<{ id?: string; full_name?: string; phone?: string | null }> | null;
  pets?: { name?: string } | Array<{ name?: string }> | null;
  secondary_pets?: { name?: string } | Array<{ name?: string }> | null;
  rooms?: { name?: string } | Array<{ name?: string }> | null;
  booking_payments?:
    | { status?: DailyScheduleItem["payment_status"]; amount?: number | string | null }
    | Array<{ status?: DailyScheduleItem["payment_status"]; amount?: number | string | null }>
    | null;
  booking_items?:
    | Array<{
        services?: { name?: string } | Array<{ name?: string }> | null;
      }>
    | null;
}): DailyScheduleItem {
  const customer = toSingle(booking.customers);
  const pet = toSingle(booking.pets);
  const secondaryPet = toSingle(booking.secondary_pets);
  const room = toSingle(booking.rooms);
  const payment = toSingle(booking.booking_payments);
  const paymentStatus = resolvePaymentStatus({
    totalAmount: Number(booking.total_amount),
    paidAmount: Number(payment?.amount ?? 0),
    storedStatus: payment?.status ?? "pending"
  });

  return {
    booking_id: booking.id,
    booking_no: booking.booking_no,
    booking_type: booking.booking_type,
    status: booking.status,
    payment_status: paymentStatus,
    start_at: booking.start_at,
    end_at: booking.end_at,
    customer_id: customer?.id,
    customer_name: customer?.full_name ?? "-",
    customer_phone: customer?.phone ?? null,
    pet_name: [pet?.name, secondaryPet?.name].filter((name): name is string => Boolean(name)).join(", ") || "-",
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

function assertStartBeforeEnd(startAt: string, endAt: string) {
  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt).getTime();

  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    throw new Error("Start time or end time is invalid");
  }

  if (startTime > endTime) {
    throw new Error("Start time must be before or equal to end time");
  }
}

function assertStartBeforeEndStrict(startAt: string, endAt: string) {
  assertStartBeforeEnd(startAt, endAt);

  if (new Date(startAt).getTime() === new Date(endAt).getTime()) {
    throw new Error("End time must be after start time");
  }
}

export async function getDailySchedule(day: string): Promise<DailyScheduleItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_daily_schedule", {
    p_day: day
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DailyScheduleRpcRow[]).map((item) => ({
    booking_id: item.booking_id,
    booking_no: item.booking_no,
    booking_type: item.booking_type,
    status: item.status,
    payment_status: item.payment_status,
    start_at: item.start_at,
    end_at: item.end_at,
    customer_name: item.customer_name,
    customer_phone: item.customer_phone ?? null,
    pet_name: item.pet_name,
    room_name: item.room_name,
    services_summary: item.services_summary ?? "",
    total_amount: Number(item.total_amount)
  }));
}

export async function getScheduleByStatus(status: BookingStatus): Promise<DailyScheduleItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
        id,
        booking_no,
        booking_type,
        status,
        booking_payments(status, amount),
        start_at,
        end_at,
        total_amount,
        customers!inner(id, full_name, phone),
        pets!bookings_pet_id_fkey!inner(name),
        secondary_pets:pets!bookings_secondary_pet_id_fkey(name),
        rooms(name),
        booking_items(services(name))
      `
    )
    .eq("status", status)
    .order("start_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((booking) =>
    mapBookingToScheduleItem({
      ...booking,
      booking_type: booking.booking_type as BookingType,
      status: booking.status as BookingStatus
    })
  );
}

export async function getScheduleInRange(startAt: string, endAtExclusive: string): Promise<DailyScheduleItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
        id,
        booking_no,
        booking_type,
        status,
        booking_payments(status, amount),
        start_at,
        end_at,
        total_amount,
        customers!inner(id, full_name, phone),
        pets!bookings_pet_id_fkey!inner(name),
        secondary_pets:pets!bookings_secondary_pet_id_fkey(name),
        rooms(name),
        booking_items(services(name))
      `
    )
    .lt("start_at", endAtExclusive)
    .gt("end_at", startAt)
    .order("start_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((booking) =>
    mapBookingToScheduleItem({
      ...booking,
      booking_type: booking.booking_type as BookingType,
      status: booking.status as BookingStatus
    })
  );
}

export async function getScheduleMonthSummaryInRange(startAt: string, endAtExclusive: string): Promise<ScheduleMonthSummaryItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
        id,
        booking_type,
        status,
        start_at,
        end_at
      `
    )
    .lt("start_at", endAtExclusive)
    .gt("end_at", startAt);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((booking) => ({
    booking_id: booking.id,
    booking_type: booking.booking_type as BookingType,
    status: booking.status as BookingStatus,
    start_at: booking.start_at,
    end_at: booking.end_at
  }));
}

export async function getBookingDetail(bookingId: string): Promise<BookingDetailViewModel> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
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
        note,
        customers!inner(id, full_name, phone),
        pets!bookings_pet_id_fkey!inner(name),
        secondary_pets:pets!bookings_secondary_pet_id_fkey(name),
        rooms(name),
        booking_items(services(name)),
        booking_payments(id, booking_id, amount, method, status, reference_no, receipt_no, receipt_issued_at, paid_at, note)
      `
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Booking not found");
  }

  const customer = toSingle(data.customers);
  const primaryPet = toSingle(data.pets);
  const secondaryPet = toSingle(data.secondary_pets);
  const room = toSingle(data.rooms);
  const payment = toSingle(data.booking_payments) as BookingPayment | null;
  const paymentStatus = resolvePaymentStatus({
    totalAmount: Number(data.total_amount),
    paidAmount: Number(payment?.amount ?? 0),
    storedStatus: payment?.status ?? "pending"
  });

  return {
    booking_id: data.id,
    booking_no: data.booking_no,
    booking_type: data.booking_type as BookingType,
    status: data.status as BookingStatus,
    payment_status: paymentStatus,
    start_at: data.start_at,
    end_at: data.end_at,
    customer_id: customer?.id,
    customer_name: customer?.full_name ?? "-",
    customer_phone: customer?.phone ?? "-",
    pet_name: [primaryPet?.name, secondaryPet?.name].filter((name): name is string => Boolean(name)).join(", ") || "-",
    room_name: room?.name ?? null,
    services_summary:
      data.booking_items
        ?.map((item) => toSingle(item.services)?.name)
        .filter((name): name is string => Boolean(name))
        .sort((left, right) => left.localeCompare(right))
        .join(", ") ?? "",
    total_amount: Number(data.total_amount),
    note: data.note ?? null,
    payment
  };
}

export async function getBookingRepeatDraft(bookingId: string): Promise<BookingRepeatDraft | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
        booking_type,
        customer_id,
        pet_id,
        secondary_pet_id,
        total_amount,
        note,
        customers!inner(id, full_name, phone, facebook_name, note),
        pets!bookings_pet_id_fkey(id, customer_id, name, species, breed, weight_kg),
        secondary_pets:pets!bookings_secondary_pet_id_fkey(id, customer_id, name, species, breed, weight_kg),
        booking_items(service_id)
      `
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const customer = toSingle(data.customers);
  const primaryPet = toSingle(data.pets);
  const secondaryPet = toSingle(data.secondary_pets);
  const firstItem = data.booking_items?.[0];

  if (!customer) {
    return null;
  }

  return {
    bookingType: data.booking_type as BookingType,
    customer: {
      id: customer.id,
      full_name: customer.full_name,
      phone: customer.phone,
      facebook_name: customer.facebook_name,
      note: customer.note
    },
    petId: data.pet_id,
    secondaryPetId: data.secondary_pet_id,
    pets: [primaryPet, secondaryPet].filter((pet): pet is Pet => Boolean(pet)),
    serviceId: firstItem?.service_id ?? "",
    totalAmount: Number(data.total_amount ?? 0),
    note: data.note ?? ""
  };
}

export async function getAvailableRooms(checkIn: string, checkOut: string) {
  assertStartBeforeEndStrict(checkIn, checkOut);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_available_rooms", {
    p_check_in: checkIn,
    p_check_out: checkOut
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AvailableRoomOption[]).map((room) => ({
    ...room,
    nightly_rate: Number(room.nightly_rate)
  }));
}

export async function checkGroomingDraftAvailability(
  supabase: ReturnType<typeof createAdminClient>,
  petIds: string[],
  startAt: string,
  endAt: string
) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
        booking_no,
        pet_id,
        secondary_pet_id,
        pets!bookings_pet_id_fkey(name),
        secondary_pets:pets!bookings_secondary_pet_id_fkey(name)
      `
    )
    .eq("booking_type", "grooming")
    .in("status", ["pending", "confirmed", "in_progress"])
    .lt("start_at", endAt)
    .gt("end_at", startAt)
    .order("start_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const items: GroomingOverlapRow[] = (data ?? []).map((booking) => {
    const primaryPet = toSingle(booking.pets);
    const secondaryPet = toSingle(booking.secondary_pets);

    return {
      booking_no: booking.booking_no,
      pet_id: booking.pet_id,
      secondary_pet_id: booking.secondary_pet_id,
      pet_names: [primaryPet?.name, secondaryPet?.name].filter((name): name is string => Boolean(name)).join(", ") || "-"
    };
  });

  return evaluateGroomingDraftAvailability({
    petIds,
    overlappingBookings: items,
    capacity: GROOMING_CAPACITY
  });
}

export async function createBookingRecord(input: CreateBookingInput): Promise<string> {
  assertStartBeforeEnd(input.startAt, input.endAt);

  const supabase = createAdminClient();
  const petIds = [input.petId, input.secondaryPetId].filter((value): value is string => Boolean(value));

  if (new Set(petIds).size !== petIds.length) {
    throw new Error("กรุณาเลือกสัตว์เลี้ยงคนละตัว");
  }

  const { data: bookingId, error } = await supabase.rpc("create_booking_atomic", {
    p_booking_type: input.bookingType,
    p_customer_id: input.customerId,
    p_pet_id: input.petId,
    p_secondary_pet_id: input.secondaryPetId ?? null,
    p_room_id: input.roomId ?? null,
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_total_amount: input.totalAmount,
    p_note: input.note ?? null,
    p_actor_user_id: input.actorUserId ?? null,
    p_items: (input.items ?? []).map((item) => ({
      service_id: item.serviceId,
      qty: item.qty,
      unit_price: item.unitPrice,
      duration_minutes: item.durationMinutes,
      note: item.note ?? null
    }))
  });

  if (error || !bookingId) {
    throw new Error(error?.message ?? "Unable to create booking");
  }

  return bookingId as string;
}

export async function getUnpaidBookings(): Promise<DailyScheduleItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_unpaid_bookings");

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as UnpaidBookingRpcRow[]).map((item) => ({
    booking_id: item.booking_id,
    booking_no: item.booking_no,
    booking_type: item.booking_type,
    status: item.status,
    payment_status: item.payment_status,
    start_at: item.start_at,
    end_at: item.end_at,
    customer_name: item.customer_name,
    customer_phone: item.customer_phone ?? null,
    pet_name: item.pet_name,
    room_name: item.room_name,
    services_summary: item.services_summary ?? "",
    total_amount: Number(item.total_amount)
  }));
}

export async function getDashboardQueueCounts(day: string): Promise<DashboardQueueCounts> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_dashboard_queue_counts", { p_day: day });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    todayAll: Number(row?.today_all ?? 0),
    todayPending: Number(row?.today_pending ?? 0),
    todayDone: Number(row?.today_done ?? 0),
    unpaid: Number(row?.unpaid ?? 0)
  };
}

export async function updateBookingRecord(
  bookingId: string,
  input: Partial<CreateBookingInput> & { status?: BookingStatus }
) {
  const supabase = createAdminClient();

  if (input.startAt && input.endAt) {
    assertStartBeforeEnd(input.startAt, input.endAt);
  }

  if (input.totalAmount !== undefined) {
    const [{ data: existingPayment }, { data: existingBooking, error: bookingError }] = await Promise.all([
      supabase.from("booking_payments").select("status").eq("booking_id", bookingId).maybeSingle(),
      supabase.from("bookings").select("total_amount").eq("id", bookingId).single()
    ]);

    if (bookingError || !existingBooking) {
      throw new Error(bookingError?.message ?? "Booking not found");
    }

    if (existingPayment?.status === "paid" && Number(existingBooking.total_amount) !== input.totalAmount) {
      throw new Error("ไม่สามารถแก้ยอดได้หลังรับชำระแล้ว");
    }
  }

  const patch: Record<string, string | number | null> = {};

  if (input.startAt) patch.start_at = input.startAt;
  if (input.endAt) patch.end_at = input.endAt;
  if (input.note !== undefined) patch.note = input.note ?? null;
  if (input.totalAmount !== undefined) patch.total_amount = input.totalAmount;
  if (input.roomId !== undefined) patch.room_id = input.roomId ?? null;
  if (input.status) patch.status = input.status;

  const { error } = await supabase.from("bookings").update(patch).eq("id", bookingId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus) {
  const supabase = createAdminClient();
  const patch: Record<string, string> = { status };

  if (status === "in_progress") {
    patch.check_in_at = new Date().toISOString();
  }

  if (status === "done") {
    patch.check_out_at = new Date().toISOString();
  }

  const { error } = await supabase.from("bookings").update(patch).eq("id", bookingId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteBookingRecord(bookingId: string) {
  const supabase = createAdminClient();

  const { error: transactionError } = await supabase.from("cash_transactions").delete().eq("booking_id", bookingId);

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  const { error } = await supabase.from("bookings").delete().eq("id", bookingId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function cancelBookingRecord(bookingId: string) {
  return updateBookingStatus(bookingId, "cancelled");
}


