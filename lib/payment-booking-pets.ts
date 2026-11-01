import { isPerPetAllocation, type GroomingAllocation } from "./grooming-allocation.ts";

export type PaymentPetDraft = { id: string | null; name: string; species: "cat" | "dog" };
export type PaymentPetOption = { id: string; name: string; species: string; is_active?: boolean };

export function parsePaymentPetDrafts(value: unknown): PaymentPetDraft[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) throw new Error("กรุณาระบุสัตว์เลี้ยง 1–2 ตัวในบิล");
  const drafts = value.map((raw): PaymentPetDraft => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("ข้อมูลสัตว์เลี้ยงไม่ถูกต้อง");
    const data = raw as Record<string, unknown>;
    if (data.id !== null && (typeof data.id !== "string" || !data.id.trim())) throw new Error("กรุณาเลือกสัตว์เลี้ยงหรือกรอกชื่อใหม่");
    if (typeof data.name !== "string" || !data.name.trim() || /[\/／]/.test(data.name)) throw new Error("กรอกชื่อน้องหนึ่งตัวต่อช่อง หรือกดแยกชื่อที่คั่นด้วย /");
    if (data.species !== "cat" && data.species !== "dog") throw new Error("กรุณาเลือกแมวหรือสุนัข");
    return { id: data.id as string | null, name: data.name.trim(), species: data.species };
  });
  if (new Set(drafts.map((pet) => pet.name.toLowerCase())).size !== drafts.length) throw new Error("กรุณาระบุสัตว์เลี้ยงคนละตัว");
  return drafts;
}

export async function resolvePaymentBookingPetIds(drafts: PaymentPetDraft[], available: PaymentPetOption[], create: (pet: PaymentPetDraft) => Promise<string>): Promise<string[]> {
  const ids: string[] = [];
  for (const draft of drafts) {
    if (draft.id) {
      const selected = available.find((pet) => pet.id === draft.id);
      if (!selected || selected.name.trim() !== draft.name) throw new Error("สัตว์เลี้ยงที่เลือกไม่ตรงกับข้อมูลของลูกค้าในบิล กรุณาโหลดหน้าใหม่");
      ids.push(selected.id);
    } else {
      const matches = available.filter((pet) => pet.is_active !== false && pet.name.trim().toLowerCase() === draft.name.toLowerCase() && pet.species === draft.species);
      if (matches.length > 1) throw new Error("พบชื่อสัตว์เลี้ยงซ้ำ กรุณาเลือกจากรายชื่อเดิมให้ชัดเจน");
      ids.push(matches[0]?.id ?? await create(draft));
    }
  }
  if (new Set(ids).size !== ids.length) throw new Error("กรุณาเลือกสัตว์เลี้ยงคนละตัว");
  return ids;
}

export function remapPaymentPetAllocation(allocation: GroomingAllocation | null, previousIds: string[], nextIds: string[]): GroomingAllocation | null {
  if (nextIds.length < previousIds.length || nextIds.length > 2 || !nextIds.length) throw new Error("ไม่สามารถนำสัตว์เลี้ยงเดิมออกจากบิลในหน้ารับเงินได้");
  if (!allocation || !isPerPetAllocation(allocation)) return allocation;
  const retained = nextIds.map((id) => allocation.pets.find((pet) => pet.petId === id));
  const used = new Set(retained.filter((pet) => Boolean(pet)).map((pet) => pet!.petId));
  return { version: 2, pets: nextIds.map((petId, index) => {
    const saved = retained[index] ?? allocation.pets.find((pet) => pet.petId === previousIds[index] && !used.has(pet.petId)) ?? allocation.pets.find((pet) => !used.has(pet.petId));
    if (saved) { used.add(saved.petId); return { ...saved, petId }; }
    const primary = allocation.pets[0];
    return { petId, amount: 0, performedById: primary.performedById, secondaryPerformedById: primary.secondaryPerformedById, allocation: null };
  }) };
}
