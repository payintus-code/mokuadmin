"use server";

import { requireAdmin, requireAppUser } from "@/lib/auth";
import { revalidateCustomerPetSurfaces } from "@/lib/revalidation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createPet(formData: FormData) {
  await requireAppUser();

  const supabase = createAdminClient();

  const customerId = String(formData.get("customerId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const species = String(formData.get("species") ?? "").trim();
  const breed = String(formData.get("breed") ?? "").trim();
  const weightValue = String(formData.get("weightKg") ?? "").trim();
  const temperamentNote = String(formData.get("temperamentNote") ?? "").trim();
  const allergyNote = String(formData.get("allergyNote") ?? "").trim();

  if (!customerId || !name || !species) {
    throw new Error("Please select an owner and enter pet name and species");
  }

  const weightKg = weightValue ? Number(weightValue) : null;

  if (weightKg !== null && Number.isNaN(weightKg)) {
    throw new Error("Weight is invalid");
  }

  const { error } = await supabase.from("pets").insert({
    customer_id: customerId,
    name,
    species,
    breed: breed || null,
    weight_kg: weightKg,
    temperament_note: temperamentNote || null,
    allergy_note: allergyNote || null
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidateCustomerPetSurfaces();
}

export async function deletePet(petId: string) {
  await requireAdmin();

  const supabase = createAdminClient();

  const [{ count: primaryCount, error: primaryError }, { count: secondaryCount, error: secondaryError }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("pet_id", petId)
        .in("status", ["pending", "confirmed", "in_progress"]),
      supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("secondary_pet_id", petId)
        .in("status", ["pending", "confirmed", "in_progress"])
    ]);

  if (primaryError || secondaryError) {
    throw new Error(primaryError?.message ?? secondaryError?.message ?? "Unable to validate pet deletion");
  }

  if ((primaryCount ?? 0) + (secondaryCount ?? 0) > 0) {
    throw new Error("Cannot delete this pet while active bookings still exist");
  }

  const { error } = await supabase.from("pets").update({ is_active: false }).eq("id", petId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateCustomerPetSurfaces();
}
