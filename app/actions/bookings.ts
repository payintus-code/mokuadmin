"use server";

import {
  cancelBookingRecord,
  checkGroomingDraftAvailability as checkGroomingDraftAvailabilityQuery,
  createBookingRecord,
  deleteBookingRecord,
  getAvailableRooms as getAvailableRoomsQuery,
  getDailySchedule as getDailyScheduleQuery,
  updateBookingRecord,
  updateBookingStatus
} from "@/lib/bookings";
import { requireAdmin, requireAppUser } from "@/lib/auth";
import { validateHotelStayDates, validatePaymentDraft } from "@/lib/booking-draft";
import { createOrUpdateBookingPayment } from "@/lib/payments";
import { revalidateBookingCreationSurfaces, revalidateBookingSurfaces, revalidateFinanceSurfaces } from "@/lib/revalidation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BookingStatus, PaymentCollectionType, PaymentMethod } from "@/types/database";

function toIsoDateTime(value: string, fieldName: string) {
  const normalized = value.trim();
  const localDateTimeMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/);
  const isoValue = localDateTimeMatch ? `${localDateTimeMatch[1]}T${localDateTimeMatch[2]}:00.000Z` : normalized;
  const parsed = new Date(isoValue);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} is invalid`);
  }

  return localDateTimeMatch ? isoValue : parsed.toISOString();
}

function assertStartBeforeEnd(startAt: string, endAt: string) {
  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt).getTime();

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

function normalizeWholeBahtAmount(value: number, fieldLabel: string) {
  if (Number.isNaN(value) || value < 0) {
    throw new Error(`${fieldLabel} is invalid`);
  }

  return Math.round(value);
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function combineNotes(note: string, importedContextNote: string) {
  const noteParts = [note.trim(), importedContextNote.trim()].filter(Boolean);
  return noteParts.join("\n\n");
}

async function findCustomerByNormalizedPhone(supabase: ReturnType<typeof createAdminClient>, phone: string) {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, full_name, phone, facebook_name, note")
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  return (customers ?? []).find((customer) => normalizePhone(customer.phone) === normalizedPhone) ?? null;
}

export async function createBooking(formData: FormData) {
  const currentUser = await requireAppUser();

  const bookingType = String(formData.get("bookingType"));
  const customerMode = String(formData.get("customerMode") ?? "existing");
  let customerId = String(formData.get("customerId") ?? "").trim();
  let petId = String(formData.get("petId") ?? "").trim();
  const secondaryPetId = String(formData.get("secondaryPetId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const startAt = String(formData.get("startAt"));
  const endAt = String(formData.get("endAt"));
  const totalAmountValue = String(formData.get("totalAmount") ?? "").trim();
  const note = String(formData.get("note") ?? "");
  const importedContextNote = String(formData.get("importedContextNote") ?? "").trim();
  const paymentCollectionType = String(formData.get("paymentCollectionType") ?? "none") as PaymentCollectionType;
  const paymentMethod = String(formData.get("paymentMethod") ?? "cash") as PaymentMethod;
  const receivedAmount = Number(formData.get("receivedAmount") ?? 0);
  const paymentNote = String(formData.get("paymentNote") ?? "").trim();
  const customerFullName = String(formData.get("customerFullName") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const customerFacebookName = String(formData.get("customerFacebookName") ?? "").trim();
  const customerNote = String(formData.get("customerNote") ?? "").trim();
  const petName = String(formData.get("newPetName") ?? "").trim();
  const petSpecies = String(formData.get("newPetSpecies") ?? "").trim();
  const petBreed = String(formData.get("newPetBreed") ?? "").trim();
  const petWeightValue = String(formData.get("newPetWeightKg") ?? "").trim();
  const petTemperamentNote = String(formData.get("newPetTemperamentNote") ?? "").trim();
  const petAllergyNote = String(formData.get("newPetAllergyNote") ?? "").trim();

  if (!bookingType || !startAt || !endAt) {
    throw new Error("Booking data is incomplete");
  }

  const parsedTotalAmount = normalizeWholeBahtAmount(totalAmountValue ? Number(totalAmountValue) : 0, "Total amount");
  const normalizedReceivedAmount = receivedAmount > 0 ? normalizeWholeBahtAmount(receivedAmount, "Received amount") : receivedAmount;

  const totalAmount =
    paymentCollectionType === "full" && !totalAmountValue && receivedAmount > 0
      ? normalizedReceivedAmount
      : parsedTotalAmount;

  const startAtIso = toIsoDateTime(startAt, "Start time");
  const endAtIso = toIsoDateTime(endAt, "End time");
  if (bookingType === "hotel") {
    assertStartBeforeEndStrict(startAtIso, endAtIso);
  } else {
    assertStartBeforeEnd(startAtIso, endAtIso);
  }
  const combinedNote = combineNotes(note, importedContextNote);

  const supabase = createAdminClient();

  if (customerMode === "new") {
    if (!customerFullName || !customerPhone || !petName || !petSpecies) {
      throw new Error("Please enter customer name, phone number, pet name, and species");
    }

    const petWeightKg = petWeightValue ? Number(petWeightValue) : null;

    if (petWeightKg !== null && Number.isNaN(petWeightKg)) {
      throw new Error("Weight is invalid");
    }

    const existingCustomerByPhone = await findCustomerByNormalizedPhone(supabase, customerPhone);

    if (existingCustomerByPhone) {
      customerId = existingCustomerByPhone.id;

      const customerPatch: Record<string, string | null> = {};

      if (customerFullName && existingCustomerByPhone.full_name !== customerFullName) {
        customerPatch.full_name = customerFullName;
      }

      if (customerFacebookName && existingCustomerByPhone.facebook_name !== customerFacebookName) {
        customerPatch.facebook_name = customerFacebookName;
      }

      if (customerNote && existingCustomerByPhone.note !== customerNote) {
        customerPatch.note = customerNote;
      }

      if (Object.keys(customerPatch).length) {
        const { error: updateCustomerError } = await supabase.from("customers").update(customerPatch).eq("id", customerId);

        if (updateCustomerError) {
          throw new Error(updateCustomerError.message);
        }
      }
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          full_name: customerFullName,
          phone: normalizePhone(customerPhone),
          facebook_name: customerFacebookName || null,
          note: customerNote || null
        })
        .select("id")
        .single();

      if (customerError || !newCustomer) {
        throw new Error(customerError?.message ?? "Unable to create customer");
      }

      customerId = newCustomer.id;
    }

    const { data: existingPet } = await supabase
      .from("pets")
      .select("id")
      .eq("customer_id", customerId)
      .eq("name", petName)
      .eq("is_active", true)
      .maybeSingle();

    if (existingPet) {
      petId = existingPet.id;

      const petWeightKg = petWeightValue ? Number(petWeightValue) : null;
      const petPatch: Record<string, string | number | null> = {};

      if (petSpecies) {
        petPatch.species = petSpecies;
      }

      if (petBreed) {
        petPatch.breed = petBreed;
      }

      if (petWeightKg !== null) {
        petPatch.weight_kg = petWeightKg;
      }

      if (petTemperamentNote) {
        petPatch.temperament_note = petTemperamentNote;
      }

      if (petAllergyNote) {
        petPatch.allergy_note = petAllergyNote;
      }

      if (Object.keys(petPatch).length) {
        const { error: updatePetError } = await supabase.from("pets").update(petPatch).eq("id", petId);

        if (updatePetError) {
          throw new Error(updatePetError.message);
        }
      }
    } else {
      const { data: newPet, error: petError } = await supabase
        .from("pets")
        .insert({
          customer_id: customerId,
          name: petName,
          species: petSpecies,
          breed: petBreed || null,
          weight_kg: petWeightKg,
          temperament_note: petTemperamentNote || null,
          allergy_note: petAllergyNote || null
        })
        .select("id")
        .single();

      if (petError || !newPet) {
        throw new Error(petError?.message ?? "Unable to create pet");
      }

      petId = newPet.id;
    }
  }

  if (!customerId || !petId) {
    throw new Error("Please select or create a customer and pet");
  }

  const paymentDraft = validatePaymentDraft({
    showPaymentNow: paymentCollectionType !== "none" || receivedAmount > 0,
    paymentCollectionType,
    totalAmount,
    receivedAmount: normalizedReceivedAmount
  });

  if (!paymentDraft.ok && paymentDraft.blocking) {
    throw new Error(paymentDraft.message);
  }

  let items:
    | {
        serviceId: string;
        qty: number;
        unitPrice: number;
        durationMinutes: number;
      }[]
    | undefined;

  if (bookingType === "grooming" && !serviceId) {
    throw new Error("Please select a service");
  }

  if (serviceId) {
    const { data: service, error } = await supabase
      .from("services")
      .select("id, price, duration_minutes, category")
      .eq("id", serviceId)
      .single();

    if (error || !service) {
      throw new Error(error?.message ?? "Service not found");
    }

    if (bookingType === "grooming" && service.category === "hotel") {
      throw new Error("Selected service does not match booking type");
    }

    if (bookingType === "hotel" && service.category !== "hotel") {
      throw new Error("Selected service does not match booking type");
    }

    items = [
      {
        serviceId: service.id,
        qty: 1,
        unitPrice: service.price,
        durationMinutes: service.duration_minutes
      }
    ];
  }

  let bookingId: string | null = null;

  try {
    bookingId = await createBookingRecord({
      bookingType: bookingType as "grooming" | "hotel",
      customerId,
      petId,
      secondaryPetId: secondaryPetId || null,
      roomId: roomId || null,
      startAt: startAtIso,
      endAt: endAtIso,
      totalAmount,
      note: combinedNote,
      items,
      actorUserId: currentUser.id
    });

    if (paymentCollectionType !== "none" && normalizedReceivedAmount > 0) {
      await createOrUpdateBookingPayment({
        bookingId,
        amount: normalizedReceivedAmount,
        method: paymentMethod,
        note: paymentNote || (paymentCollectionType === "deposit" ? "Deposit received during booking creation" : "Paid in full during booking creation"),
        actorUserId: currentUser.id
      });
    }
  } catch (error) {
    if (bookingId) {
      await deleteBookingRecord(bookingId);
    }

    throw error;
  }

  revalidateBookingCreationSurfaces();
}

export async function updateBooking(input: {
  bookingId: string;
  status?: BookingStatus;
  startAt?: string;
  endAt?: string;
  roomId?: string | null;
  totalAmount?: number;
  note?: string;
}) {
  await requireAppUser();

  if (input.startAt && input.endAt) {
    assertStartBeforeEnd(input.startAt, input.endAt);
  }

  await updateBookingRecord(input.bookingId, {
    status: input.status,
    startAt: input.startAt,
    endAt: input.endAt,
    roomId: input.roomId,
    totalAmount: input.totalAmount,
    note: input.note
  });
  revalidateBookingSurfaces(input.bookingId);
}

export async function quickUpdateBookingStatus(bookingId: string, status: BookingStatus) {
  await requireAppUser();

  await updateBookingStatus(bookingId, status);
  revalidateBookingSurfaces(bookingId);
}

export async function quickUpdateBookingStatusFromForm(formData: FormData) {
  await requireAppUser();

  const bookingId = String(formData.get("bookingId") ?? "");
  const status = String(formData.get("status") ?? "") as BookingStatus;

  if (!bookingId || !status) {
    throw new Error("Booking status data is incomplete");
  }

  await updateBookingStatus(bookingId, status);
  revalidateBookingSurfaces(bookingId);
}

export async function completeBooking(formData: FormData) {
  await requireAppUser();

  const bookingId = String(formData.get("bookingId") ?? "");
  const totalAmount = normalizeWholeBahtAmount(Number(formData.get("totalAmount")), "Total amount");

  if (!bookingId) {
    throw new Error("ไม่พบรายการจอง");
  }

  if (Number.isNaN(totalAmount) || totalAmount < 0) {
    throw new Error("ยอดเงินไม่ถูกต้อง");
  }

  await updateBookingRecord(bookingId, { totalAmount });
  await updateBookingStatus(bookingId, "done");

  revalidateBookingSurfaces(bookingId);
}

export async function updateBookingTotal(formData: FormData) {
  await requireAppUser();

  const bookingId = String(formData.get("bookingId") ?? "");
  const totalAmount = normalizeWholeBahtAmount(Number(formData.get("totalAmount")), "Total amount");

  if (!bookingId) {
    throw new Error("Booking not found");
  }

  if (Number.isNaN(totalAmount) || totalAmount < 0) {
    throw new Error("Total amount is invalid");
  }

  await updateBookingRecord(bookingId, { totalAmount });

  revalidateBookingSurfaces(bookingId);
}

export async function cancelBooking(bookingId: string) {
  await requireAppUser();

  await cancelBookingRecord(bookingId);
  revalidateBookingSurfaces(bookingId);
}

export async function deleteBooking(bookingId: string) {
  await requireAdmin();

  await deleteBookingRecord(bookingId);
  revalidateBookingCreationSurfaces();
  revalidateFinanceSurfaces();
}

export async function getDailySchedule(day: string) {
  await requireAppUser();

  return getDailyScheduleQuery(day);
}

export async function getAvailableRooms(checkIn: string, checkOut: string) {
  await requireAppUser();

  const dateValidation = validateHotelStayDates(checkIn, checkOut);

  if (!dateValidation.ok) {
    throw new Error(dateValidation.message);
  }

  return getAvailableRoomsQuery(checkIn, checkOut);
}

export async function checkGroomingAvailability(input: {
  startAt: string;
  endAt: string;
  petIds: string[];
}) {
  await requireAppUser();

  const startAtIso = toIsoDateTime(input.startAt, "Start time");
  const endAtIso = toIsoDateTime(input.endAt, "End time");
  assertStartBeforeEnd(startAtIso, endAtIso);

  const supabase = createAdminClient();
  return checkGroomingDraftAvailabilityQuery(supabase, input.petIds, startAtIso, endAtIso);
}
