import { resolvePaymentStatus } from "@/lib/payment-status";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  aggregateTopServices,
  buildDemandBuckets,
  calculateAverageOrderValue,
  calculateRepeatRate,
  getDefaultMarketingDateRange,
  segmentWinBackCustomers,
  toRangeEndExclusiveIso,
  toRangeStartIso,
  type MarketingBookingSnapshot,
  type MarketingCustomerSnapshot
} from "@/lib/marketing-core";
import type {
  BookingType,
  MarketingCustomerRow,
  MarketingDashboardFilters,
  MarketingDashboardViewModel,
  MarketingMixRow,
  MarketingPaymentMethodRow,
  MarketingRoomRow,
  PaymentMethod
} from "@/types/database";

function toSingle<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getNightCount(startAt: string, endAt: string) {
  const milliseconds = new Date(endAt).getTime() - new Date(startAt).getTime();
  const nights = Math.ceil(milliseconds / (24 * 60 * 60 * 1000));
  return Math.max(1, Number.isFinite(nights) ? nights : 1);
}

function getBusinessDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function buildShareRows(items: Array<{ key: string; label: string; count: number }>): MarketingMixRow[] {
  const total = items.reduce((sum, item) => sum + item.count, 0);

  return items.map((item) => ({
    key: item.key,
    label: item.label,
    count: item.count,
    share: total > 0 ? item.count / total : 0
  }));
}

function mapBooking(row: {
  id: string;
  booking_type: BookingType;
  customer_id: string;
  start_at: string;
  end_at: string;
  total_amount: number | string;
  customers?: { full_name?: string; phone?: string | null; facebook_name?: string | null; created_at?: string | null } | Array<{ full_name?: string; phone?: string | null; facebook_name?: string | null; created_at?: string | null }> | null;
  pets?: { name?: string; species?: string; breed?: string | null } | Array<{ name?: string; species?: string; breed?: string | null }> | null;
  secondary_pets?: { name?: string; species?: string; breed?: string | null } | Array<{ name?: string; species?: string; breed?: string | null }> | null;
  rooms?: { name?: string | null } | Array<{ name?: string | null }> | null;
  booking_items?: Array<{
    qty?: number | string | null;
    unit_price?: number | string | null;
    services?: { name?: string } | Array<{ name?: string }> | null;
  }> | null;
}): MarketingBookingSnapshot {
  const customer = toSingle(row.customers);
  const primaryPet = toSingle(row.pets);
  const secondaryPet = toSingle(row.secondary_pets);
  const room = toSingle(row.rooms);

  return {
    bookingId: row.id,
    bookingType: row.booking_type,
    customerId: row.customer_id,
    customerName: customer?.full_name ?? "-",
    customerPhone: customer?.phone ?? null,
    facebookName: customer?.facebook_name ?? null,
    customerCreatedAt: customer?.created_at ?? null,
    startAt: row.start_at,
    endAt: row.end_at,
    totalAmount: Number(row.total_amount ?? 0),
    roomName: room?.name ?? null,
    pets: [primaryPet, secondaryPet]
      .filter((pet): pet is NonNullable<typeof pet> => Boolean(pet))
      .map((pet) => ({
        name: pet.name ?? "-",
        species: pet.species ?? "-",
        breed: pet.breed ?? null
      })),
    services:
      row.booking_items?.map((item) => ({
        name: toSingle(item.services)?.name ?? "Unknown service",
        qty: Number(item.qty ?? 0),
        lineTotal: Number(item.qty ?? 0) * Number(item.unit_price ?? 0)
      })) ?? []
  };
}

function getCustomerPetSummary(bookings: MarketingBookingSnapshot[]) {
  const names = new Set<string>();

  for (const booking of bookings) {
    for (const pet of booking.pets) {
      names.add(pet.name);
    }
  }

  return Array.from(names).join(", ") || "-";
}

function buildCustomerRows(bookings: MarketingBookingSnapshot[]): MarketingCustomerRow[] {
  const byCustomer = new Map<string, MarketingBookingSnapshot[]>();

  for (const booking of bookings) {
    const current = byCustomer.get(booking.customerId) ?? [];
    current.push(booking);
    byCustomer.set(booking.customerId, current);
  }

  return Array.from(byCustomer.entries()).map(([customerId, customerBookings]) => {
    const bookingCount = customerBookings.length;
    const totalSpend = customerBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
    const lastBookingAt = customerBookings
      .map((booking) => booking.startAt)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
    const customer = customerBookings[0];

    return {
      customer_id: customerId,
      customer_name: customer.customerName,
      customer_phone: customer.customerPhone,
      facebook_name: customer.facebookName,
      booking_count: bookingCount,
      total_spend: totalSpend,
      average_order_value: calculateAverageOrderValue(totalSpend, bookingCount),
      last_booking_at: lastBookingAt,
      days_since_last_booking: null,
      win_back_segment: null,
      is_at_risk: false,
      pet_summary: getCustomerPetSummary(customerBookings)
    } satisfies MarketingCustomerRow;
  });
}

function aggregateTopRooms(bookings: MarketingBookingSnapshot[]): MarketingRoomRow[] {
  const hotelBookings = bookings.filter((booking) => booking.bookingType === "hotel" && booking.roomName);
  const totalRevenue = hotelBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
  const totals = new Map<string, { bookingCount: number; nights: number; revenue: number }>();

  for (const booking of hotelBookings) {
    const key = booking.roomName ?? "Unknown room";
    const current = totals.get(key) ?? { bookingCount: 0, nights: 0, revenue: 0 };
    current.bookingCount += 1;
    current.nights += getNightCount(booking.startAt, booking.endAt);
    current.revenue += booking.totalAmount;
    totals.set(key, current);
  }

  return Array.from(totals.entries())
    .map(([roomName, room]) => ({
      room_name: roomName,
      booking_count: room.bookingCount,
      nights: room.nights,
      revenue: room.revenue,
      revenue_share: totalRevenue > 0 ? room.revenue / totalRevenue : 0
    }))
    .sort((left, right) => {
      if (right.revenue !== left.revenue) {
        return right.revenue - left.revenue;
      }

      return right.nights - left.nights;
    });
}

function buildSpeciesMix(bookings: MarketingBookingSnapshot[]) {
  const counts = new Map<string, number>();

  for (const booking of bookings) {
    for (const pet of booking.pets) {
      counts.set(pet.species, (counts.get(pet.species) ?? 0) + 1);
    }
  }

  return buildShareRows(
    Array.from(counts.entries())
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((left, right) => right.count - left.count)
  );
}

function buildBreedMix(bookings: MarketingBookingSnapshot[]) {
  const counts = new Map<string, number>();

  for (const booking of bookings) {
    for (const pet of booking.pets) {
      const breed = pet.breed?.trim() || "Unknown";
      counts.set(breed, (counts.get(breed) ?? 0) + 1);
    }
  }

  return buildShareRows(
    Array.from(counts.entries())
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((left, right) => right.count - left.count)
  );
}

function buildPaymentMix(rows: Array<{ amount: number | string | null; payment_method: PaymentMethod }>): MarketingPaymentMethodRow[] {
  const totals = new Map<PaymentMethod, number>();

  for (const row of rows) {
    const paymentMethod = row.payment_method;
    totals.set(paymentMethod, (totals.get(paymentMethod) ?? 0) + Number(row.amount ?? 0));
  }

  const totalAmount = Array.from(totals.values()).reduce((sum, amount) => sum + amount, 0);
  const orderedMethods: PaymentMethod[] = ["cash", "promptpay_qr", "transfer", "card", "other"];

  return orderedMethods.map((paymentMethod) => {
    const amount = totals.get(paymentMethod) ?? 0;
    return {
      payment_method: paymentMethod,
      amount,
      share: totalAmount > 0 ? amount / totalAmount : 0
    };
  });
}

export async function getMarketingDashboard(filters: MarketingDashboardFilters): Promise<MarketingDashboardViewModel> {
  const supabase = createAdminClient();
  const startIso = toRangeStartIso(filters.startDate);
  const endExclusiveIso = toRangeEndExclusiveIso(filters.endDate);

  let completedRangeQuery = supabase
    .from("bookings")
    .select(
      `
        id,
        booking_type,
        customer_id,
        start_at,
        end_at,
        total_amount,
        customers!inner(full_name, phone, facebook_name, created_at),
        pets!bookings_pet_id_fkey(name, species, breed),
        secondary_pets:pets!bookings_secondary_pet_id_fkey(name, species, breed),
        rooms(name),
        booking_items(qty, unit_price, services(name))
      `
    )
    .eq("status", "done")
    .gte("start_at", startIso)
    .lt("start_at", endExclusiveIso)
    .order("start_at", { ascending: false });

  let completedLifetimeQuery = supabase
    .from("bookings")
    .select(
      `
        id,
        booking_type,
        customer_id,
        start_at,
        end_at,
        total_amount,
        customers!inner(full_name, phone, facebook_name, created_at),
        pets!bookings_pet_id_fkey(name, species, breed),
        secondary_pets:pets!bookings_secondary_pet_id_fkey(name, species, breed),
        rooms(name),
        booking_items(qty, unit_price, services(name))
      `
    )
    .eq("status", "done")
    .lt("start_at", endExclusiveIso)
    .order("start_at", { ascending: false });

  let rangeStatusQuery = supabase
    .from("bookings")
    .select(
      `
        id,
        booking_type,
        status,
        total_amount,
        booking_payments(status, amount)
      `
    )
    .gte("start_at", startIso)
    .lt("start_at", endExclusiveIso);

  if (filters.bookingType !== "all") {
    completedRangeQuery = completedRangeQuery.eq("booking_type", filters.bookingType);
    completedLifetimeQuery = completedLifetimeQuery.eq("booking_type", filters.bookingType);
    rangeStatusQuery = rangeStatusQuery.eq("booking_type", filters.bookingType);
  }

  const [rangeCompletedResult, lifetimeCompletedResult, rangeStatusResult, paymentResult] = await Promise.all([
    completedRangeQuery,
    completedLifetimeQuery,
    rangeStatusQuery,
    supabase
      .from("cash_transactions")
      .select("amount, payment_method, booking_id, bookings(booking_type)")
      .eq("transaction_type", "income")
      .gte("transaction_date", filters.startDate)
      .lte("transaction_date", filters.endDate)
  ]);

  if (rangeCompletedResult.error) {
    throw new Error(rangeCompletedResult.error.message);
  }

  if (lifetimeCompletedResult.error) {
    throw new Error(lifetimeCompletedResult.error.message);
  }

  if (rangeStatusResult.error) {
    throw new Error(rangeStatusResult.error.message);
  }

  if (paymentResult.error) {
    throw new Error(paymentResult.error.message);
  }

  const rangeCompletedBookings = (rangeCompletedResult.data ?? []).map((row) =>
    mapBooking({
      ...row,
      booking_type: row.booking_type as BookingType
    })
  );
  const lifetimeCompletedBookings = (lifetimeCompletedResult.data ?? []).map((row) =>
    mapBooking({
      ...row,
      booking_type: row.booking_type as BookingType
    })
  );

  const customerRows = buildCustomerRows(rangeCompletedBookings);
  const activeCustomers = customerRows.length;
  const repeatCustomers = customerRows.filter((customer) => customer.booking_count >= 2).length;
  const newCustomers = customerRows.filter((customer) => {
    const matchingBooking = rangeCompletedBookings.find((booking) => booking.customerId === customer.customer_id);

    if (!matchingBooking?.customerCreatedAt) {
      return false;
    }

    const createdKey = getBusinessDateKey(matchingBooking.customerCreatedAt);
    return createdKey >= filters.startDate && createdKey <= filters.endDate;
  }).length;
  const returningCustomers = Math.max(activeCustomers - newCustomers, 0);
  const completedBookings = rangeCompletedBookings.length;
  const revenue = rangeCompletedBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
  const groomingBookings = rangeCompletedBookings.filter((booking) => booking.bookingType === "grooming").length;
  const hotelBookings = rangeCompletedBookings.filter((booking) => booking.bookingType === "hotel").length;

  const statusRows = rangeStatusResult.data ?? [];
  const totalBookingsInRange = statusRows.length;
  const cancelledBookings = statusRows.filter((booking) => booking.status === "cancelled").length;
  const pendingPaymentRows = statusRows.filter((booking) => {
    const payment = toSingle(
      booking.booking_payments as { status?: "pending" | "paid" | "cancelled"; amount?: number | string | null } | Array<{ status?: "pending" | "paid" | "cancelled"; amount?: number | string | null }> | null
    );
    const status = resolvePaymentStatus({
      totalAmount: Number(booking.total_amount ?? 0),
      paidAmount: Number(payment?.amount ?? 0),
      storedStatus: payment?.status ?? "pending"
    });

    return status === "pending" && booking.status !== "cancelled";
  });
  const pendingPaymentAmount = pendingPaymentRows.reduce((sum, booking) => {
    const payment = toSingle(
      booking.booking_payments as { amount?: number | string | null } | Array<{ amount?: number | string | null }> | null
    );
    return sum + Math.max(Number(booking.total_amount ?? 0) - Number(payment?.amount ?? 0), 0);
  }, 0);

  const filteredPayments = (paymentResult.data ?? []).filter((row) => {
    if (filters.bookingType === "all") {
      return true;
    }

    const booking = toSingle(row.bookings as { booking_type?: BookingType } | Array<{ booking_type?: BookingType }> | null);
    return booking?.booking_type === filters.bookingType;
  });
  const paymentMethods = buildPaymentMix(filteredPayments);
  const incomeCollected = paymentMethods.reduce((sum, row) => sum + row.amount, 0);

  const bookingMix = buildShareRows([
    { key: "grooming", label: "Grooming", count: groomingBookings },
    { key: "hotel", label: "Hotel", count: hotelBookings }
  ]);
  const demand = buildDemandBuckets(rangeCompletedBookings);
  const speciesMix = buildSpeciesMix(rangeCompletedBookings).slice(0, 5);
  const breedMix = buildBreedMix(rangeCompletedBookings).slice(0, 5);
  const topServices = aggregateTopServices(rangeCompletedBookings).slice(0, 8);
  const topRooms = aggregateTopRooms(rangeCompletedBookings).slice(0, 8);

  const lifetimeCustomerMap = new Map<string, MarketingBookingSnapshot[]>();

  for (const booking of lifetimeCompletedBookings) {
    const current = lifetimeCustomerMap.get(booking.customerId) ?? [];
    current.push(booking);
    lifetimeCustomerMap.set(booking.customerId, current);
  }

  const lifetimeCustomerSnapshots: MarketingCustomerSnapshot[] = Array.from(lifetimeCustomerMap.entries()).map(([customerId, bookings]) => {
    const ordered = [...bookings].sort((left, right) => new Date(right.startAt).getTime() - new Date(left.startAt).getTime());
    const customer = ordered[0];

    return {
      customerId,
      customerName: customer.customerName,
      customerPhone: customer.customerPhone,
      facebookName: customer.facebookName,
      customerCreatedAt: customer.customerCreatedAt,
      lastBookingAt: customer.startAt,
      bookingCount: bookings.length,
      totalSpend: bookings.reduce((sum, booking) => sum + booking.totalAmount, 0),
      petSummary: getCustomerPetSummary(bookings)
    };
  });

  const winBackCustomers = segmentWinBackCustomers(lifetimeCustomerSnapshots, filters.endDate).slice(0, 10);
  const atRiskCustomers = winBackCustomers.filter((customer) => customer.is_at_risk).slice(0, 10);
  const topCustomersBySpend = [...customerRows].sort((left, right) => right.total_spend - left.total_spend).slice(0, 10);
  const topCustomersByFrequency = [...customerRows]
    .sort((left, right) => {
      if (right.booking_count !== left.booking_count) {
        return right.booking_count - left.booking_count;
      }

      return right.total_spend - left.total_spend;
    })
    .slice(0, 10);

  return {
    filters,
    summary: {
      new_customers: newCustomers,
      active_customers: activeCustomers,
      returning_customers: returningCustomers,
      repeat_customers: repeatCustomers,
      repeat_rate: calculateRepeatRate(activeCustomers, repeatCustomers),
      completed_bookings: completedBookings,
      revenue,
      average_order_value: calculateAverageOrderValue(revenue, completedBookings),
      grooming_bookings: groomingBookings,
      hotel_bookings: hotelBookings,
      cancellation_rate: totalBookingsInRange > 0 ? cancelledBookings / totalBookingsInRange : 0,
      pending_payment_count: pendingPaymentRows.length,
      pending_payment_amount: pendingPaymentAmount,
      income_collected: incomeCollected
    },
    booking_mix: bookingMix,
    top_services: topServices,
    top_rooms: topRooms,
    weekday_demand: demand.weekday,
    hour_demand: demand.hour,
    species_mix: speciesMix,
    breed_mix: breedMix,
    payment_methods: paymentMethods,
    top_customers_by_spend: topCustomersBySpend,
    top_customers_by_frequency: topCustomersByFrequency,
    win_back_customers: winBackCustomers,
    at_risk_customers: atRiskCustomers
  };
}

export { getDefaultMarketingDateRange };
