import { isPerPetAllocation, type GroomingAllocation } from "./grooming-allocation.ts";

export const DRAFT_PET_IDS = ["draft-primary-pet", "draft-secondary-pet"] as const;
export type NamedBookingPet = {
  name: string; species: string; breed?: string | null; weight_kg?: number | null;
  temperament_note?: string | null; allergy_note?: string | null;
};

export async function resolveNamedBookingPets(pets: NamedBookingPet[], store: {
  find: (name: string) => Promise<string | null>;
  create: (pet: NamedBookingPet) => Promise<string>;
  update: (id: string, pet: NamedBookingPet) => Promise<void>;
}): Promise<string[]> {
  if (!pets.length || pets.length > 2 || pets.some((pet) => !pet.name.trim() || /[\/／]/.test(pet.name))) {
    throw new Error("กรุณาแยกชื่อน้องแต่ละตัวลงคนละช่อง สูงสุด 2 ตัวต่อบิล");
  }
  if (new Set(pets.map((pet) => pet.name.trim().toLowerCase())).size !== pets.length) throw new Error("กรุณาระบุสัตว์เลี้ยงคนละตัว");
  const ids: string[] = [];
  for (const pet of pets) {
    const existingId = await store.find(pet.name);
    if (existingId) {
      await store.update(existingId, pet);
      ids.push(existingId);
    } else {
      ids.push(await store.create(pet));
    }
  }
  if (new Set(ids).size !== ids.length) throw new Error("กรุณาระบุสัตว์เลี้ยงคนละตัว");
  return ids;
}

export function remapDraftGroomingPets(allocation: GroomingAllocation | null, petIds: string[]): GroomingAllocation | null {
  if (!allocation || !isPerPetAllocation(allocation)) return allocation;
  return { version: 2, pets: allocation.pets.map((pet) => {
    const index = DRAFT_PET_IDS.findIndex((id) => id === pet.petId);
    if (index === -1) return pet;
    if (!petIds[index]) throw new Error("ไม่พบสัตว์เลี้ยงที่ตรงกับข้อมูลผู้ทำงานรายตัว");
    return { ...pet, petId: petIds[index] };
  }) };
}
