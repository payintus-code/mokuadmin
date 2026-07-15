"use server";

import { parseCustomerDraftPets } from "@/lib/customer-drafts";
import { requireAdmin, requireAppUser } from "@/lib/auth";
import { revalidateCustomerPetSurfaces } from "@/lib/revalidation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createCustomer(formData: FormData) {
  await requireAppUser();

  const supabase = createAdminClient();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const facebookName = String(formData.get("facebookName") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const petDraftsValue = String(formData.get("petDrafts") ?? "");

  if (!fullName || !phone) {
    throw new Error("Please enter the customer name and phone number");
  }

  const petDrafts = parseCustomerDraftPets(petDraftsValue);

  for (const pet of petDrafts) {
    if (!pet.name || !pet.species) {
      throw new Error("Every draft pet must include a name and species");
    }

    if (pet.weightKg && Number.isNaN(Number(pet.weightKg))) {
      throw new Error(`Weight is invalid for pet ${pet.name}`);
    }
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      full_name: fullName,
      phone,
      facebook_name: facebookName || null,
      note: note || null
    })
    .select("id")
    .single();

  if (error || !customer) {
    throw new Error(error?.message ?? "Unable to create customer");
  }

  if (petDrafts.length) {
    const { error: petError } = await supabase.from("pets").insert(
      petDrafts.map((pet) => ({
        customer_id: customer.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed || null,
        weight_kg: pet.weightKg ? Number(pet.weightKg) : null,
        temperament_note: pet.temperamentNote || null,
        allergy_note: pet.allergyNote || null
      }))
    );

    if (petError) {
      throw new Error(petError.message);
    }
  }

  revalidateCustomerPetSurfaces();
}

export async function deleteCustomer(customerId: string) {
  await requireAdmin();

  const supabase = createAdminClient();

  const [{ count: petCount, error: petError }, { count: bookingCount, error: bookingError }] = await Promise.all([
    supabase.from("pets").select("*", { count: "exact", head: true }).eq("customer_id", customerId).eq("is_active", true),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .in("status", ["pending", "confirmed", "in_progress"])
  ]);

  if (petError || bookingError) {
    throw new Error(petError?.message ?? bookingError?.message ?? "Unable to validate customer deletion");
  }

  if ((petCount ?? 0) > 0) {
    throw new Error("Cannot delete this customer while active pets still exist");
  }

  if ((bookingCount ?? 0) > 0) {
    throw new Error("Cannot delete this customer while active bookings still exist");
  }

  const { error } = await supabase.from("customers").update({ is_active: false }).eq("id", customerId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateCustomerPetSurfaces();
}
