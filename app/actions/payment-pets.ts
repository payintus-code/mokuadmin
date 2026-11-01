"use server";

import { requireAppUser } from "@/lib/auth";
import { checkGroomingDraftAvailability } from "@/lib/bookings";
import { parseGroomingAllocation, validatePetGroomingAllocation } from "@/lib/grooming-allocation";
import { parsePaymentPetDrafts, remapPaymentPetAllocation, resolvePaymentBookingPetIds, type PaymentPetDraft } from "@/lib/payment-booking-pets";
import { revalidateBookingSurfaces, revalidateCustomerPetSurfaces, revalidateFinanceSurfaces } from "@/lib/revalidation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updatePaymentBookingPets(input: { bookingId: string; expectedPetIds: string[]; pets: PaymentPetDraft[] }) {
  await requireAppUser();
  const drafts = parsePaymentPetDrafts(input.pets);
  const supabase = createAdminClient();
  const { data: booking, error } = await supabase.from("bookings")
    .select("id, customer_id, booking_type, pet_id, secondary_pet_id, status, start_at, end_at, total_amount, grooming_allocation, updated_at")
    .eq("id", input.bookingId).single();
  if (error || !booking) throw new Error("ไม่พบข้อมูลบิล");
  if (booking.booking_type !== "grooming") throw new Error("จัดการผู้ทำรายตัวได้เฉพาะบิลอาบน้ำ / ตัดขน");
  const previousIds = [booking.pet_id, booking.secondary_pet_id].filter((id): id is string => Boolean(id));
  if (!Array.isArray(input.expectedPetIds) || input.expectedPetIds.length !== previousIds.length || previousIds.some((id, index) => input.expectedPetIds[index] !== id)) {
    throw new Error("รายชื่อในบิลถูกแก้ไขแล้ว กรุณาโหลดหน้าใหม่ก่อนบันทึก");
  }
  if (drafts.length < previousIds.length) throw new Error("กรุณาระบุสัตว์เลี้ยงให้ครบตามบิลเดิม");
  const { data: pets, error: petsError } = await supabase.from("pets").select("id, name, species, is_active").eq("customer_id", booking.customer_id);
  if (petsError) throw new Error("ไม่สามารถตรวจรายชื่อสัตว์เลี้ยงของลูกค้าได้");
  const available = (pets ?? []).filter((pet) => pet.is_active || previousIds.includes(pet.id));
  const nextIds = await resolvePaymentBookingPetIds(drafts, available, async (pet) => {
    const { data, error: createError } = await supabase.from("pets").insert({ customer_id: booking.customer_id, name: pet.name, species: pet.species }).select("id").single();
    if (createError || !data) throw new Error("ไม่สามารถเพิ่มสัตว์เลี้ยงได้ กรุณาลองอีกครั้ง");
    return data.id;
  });
  if (["pending", "confirmed", "in_progress"].includes(booking.status)) {
    const availability = await checkGroomingDraftAvailability(supabase, nextIds, booking.start_at, booking.end_at, booking.id);
    if (!availability.ok) throw new Error(availability.message);
  }
  const allocation = remapPaymentPetAllocation(parseGroomingAllocation(booking.grooming_allocation), previousIds, nextIds);
  validatePetGroomingAllocation(allocation, nextIds, Number(booking.total_amount));
  const { data: updated, error: updateError } = await supabase.from("bookings").update({
    pet_id: nextIds[0], secondary_pet_id: nextIds[1] ?? null, grooming_allocation: allocation
  }).eq("id", booking.id).eq("updated_at", booking.updated_at).select("id").maybeSingle();
  if (updateError) throw new Error("ไม่สามารถบันทึกรายชื่อในบิลได้ กรุณาลองอีกครั้ง");
  if (!updated) throw new Error("บิลถูกแก้ไขระหว่างบันทึก กรุณาโหลดหน้าใหม่และตรวจข้อมูลอีกครั้ง");
  revalidateBookingSurfaces(booking.id);
  revalidateCustomerPetSurfaces();
  revalidateFinanceSurfaces({ includeReport: true });
}
