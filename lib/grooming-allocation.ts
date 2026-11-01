export const GROOMING_PROFILES = {
  bath_only: [
    { key: "prep", label: "ตัดเล็บ / เช็ดหู / เตรียมตัว", percent: 10 },
    { key: "bath", label: "อาบน้ำ", percent: 30 },
    { key: "dry", label: "เป่าขน / หวีขน / เก็บงาน", percent: 60 }
  ],
  bath_and_haircut: [
    { key: "prep", label: "ตัดเล็บ / เช็ดหู / เตรียมตัว", percent: 5 },
    { key: "bath", label: "อาบน้ำ", percent: 20 },
    { key: "dry", label: "เป่าขน", percent: 30 },
    { key: "cut", label: "ตัดขน / เก็บทรง", percent: 45 }
  ]
} as const;

export type GroomingProfile = keyof typeof GROOMING_PROFILES;
export type GroomingStageAllocation = {
  profile: GroomingProfile;
  stages: Record<string, string[]>;
};
export type PetGroomingAllocation = {
  petId: string;
  amount: number;
  performedById: string;
  secondaryPerformedById: string | null;
  allocation: GroomingStageAllocation | null;
};
export type PerPetGroomingAllocation = { version: 2; pets: PetGroomingAllocation[] };
export type GroomingAllocation = GroomingStageAllocation | PerPetGroomingAllocation;

export function isPerPetAllocation(value: GroomingAllocation): value is PerPetGroomingAllocation {
  return "version" in value && value.version === 2;
}

// Validate persisted and submitted JSON alike. Percentages always come from the fixed profiles.
export function parseGroomingAllocation(value: unknown, allowedStaffIds?: string[]): GroomingAllocation | null {
  if (value === null || value === undefined || value === "") return null;
  let parsed: unknown = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { throw new Error("ข้อมูลขั้นตอนการทำงานไม่ถูกต้อง"); }
  }
  if (parsed === null) return null;
  const invalid = () => new Error("กรุณาระบุพนักงาน 1–2 คนในทุกขั้นตอน และเลือกจากพนักงานผู้ให้บริการของคิวนี้");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw invalid();
  const data = parsed as Record<string, unknown>;
  if (data.version === 2) {
    if (!Array.isArray(data.pets) || data.pets.length < 1 || data.pets.length > 2) throw invalid();
    const pets = data.pets.map((raw): PetGroomingAllocation => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalid();
      const pet = raw as Record<string, unknown>;
      if (typeof pet.petId !== "string" || !pet.petId.trim() ||
          typeof pet.amount !== "number" || !Number.isFinite(pet.amount) || pet.amount < 0 || !Number.isInteger(pet.amount) ||
          typeof pet.performedById !== "string" || !pet.performedById.trim() ||
          !(pet.secondaryPerformedById === null || (typeof pet.secondaryPerformedById === "string" && pet.secondaryPerformedById.trim())) ||
          pet.performedById === pet.secondaryPerformedById) throw invalid();
      const ids = [pet.performedById, pet.secondaryPerformedById].filter((id): id is string => typeof id === "string");
      if (pet.allocation && typeof pet.allocation === "object" && "version" in pet.allocation) throw invalid();
      const allocation = parseGroomingAllocation(pet.allocation, ids);
      if (allocation && isPerPetAllocation(allocation)) throw invalid();
      return { petId: pet.petId, amount: pet.amount, performedById: pet.performedById,
        secondaryPerformedById: pet.secondaryPerformedById as string | null, allocation };
    });
    if (new Set(pets.map((pet) => pet.petId)).size !== pets.length) throw invalid();
    return { version: 2, pets };
  }
  // Read allocations saved with the earlier profile names, without changing their percentages.
  const profile = data.profile === "cat_bath" ? "bath_only" : data.profile === "dog_groom" ? "bath_and_haircut" : data.profile;
  if (profile !== "bath_only" && profile !== "bath_and_haircut") throw invalid();
  if (!data.stages || typeof data.stages !== "object" || Array.isArray(data.stages)) throw invalid();
  const rawStages = data.stages as Record<string, unknown>;
  const definitions = GROOMING_PROFILES[profile];
  if (Object.keys(rawStages).length !== definitions.length) throw invalid();
  const stages: Record<string, string[]> = {};
  for (const stage of definitions) {
    const ids = rawStages[stage.key];
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 2 || new Set(ids).size !== ids.length ||
        ids.some((id) => typeof id !== "string" || !id.trim() || (allowedStaffIds && !allowedStaffIds.includes(id)))) throw invalid();
    stages[stage.key] = ids;
  }
  return { profile, stages };
}

export function allocateGroomingIncome(amount: number, allocation: GroomingAllocation) {
  const valid = parseGroomingAllocation(allocation)!;
  const totals = new Map<string, number>();
  if (isPerPetAllocation(valid)) {
    const total = valid.pets.reduce((sum, pet) => sum + pet.amount, 0);
    if (total === 0) return [];
    for (const pet of valid.pets) {
      const received = amount * pet.amount / total;
      const ids = [pet.performedById, pet.secondaryPerformedById].filter((id): id is string => Boolean(id));
      const shares = pet.allocation ? allocateGroomingIncome(received, pet.allocation) : ids.map((staffId) => ({ staffId, amount: received / ids.length }));
      for (const share of shares) totals.set(share.staffId, (totals.get(share.staffId) ?? 0) + share.amount);
    }
    return Array.from(totals, ([staffId, amount]) => ({ staffId, amount }));
  }
  for (const stage of GROOMING_PROFILES[valid.profile]) {
    const ids = valid.stages[stage.key];
    const share = amount * stage.percent / 100 / ids.length;
    for (const id of ids) totals.set(id, (totals.get(id) ?? 0) + share);
  }
  return Array.from(totals, ([staffId, amount]) => ({ staffId, amount }));
}

export function validatePetGroomingAllocation(allocation: GroomingAllocation | null, petIds: string[], totalAmount: number) {
  if (!allocation || !isPerPetAllocation(allocation)) return;
  if (allocation.pets.length !== petIds.length || allocation.pets.some((pet) => !petIds.includes(pet.petId))) {
    throw new Error("กรุณาระบุผู้ทำงานให้ครบทุกตัวในบิล และเลือกเฉพาะสัตว์เลี้ยงในบิลนี้");
  }
  if (!Number.isFinite(totalAmount) || Math.abs(allocation.pets.reduce((sum, pet) => sum + pet.amount, 0) - totalAmount) > 0.0001) {
    throw new Error("ยอดบริการรายตัวรวมกันต้องเท่ากับยอดรวมของบิล");
  }
}
