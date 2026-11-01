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
export type GroomingAllocation = {
  profile: GroomingProfile;
  stages: Record<string, string[]>;
};

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
  for (const stage of GROOMING_PROFILES[valid.profile]) {
    const ids = valid.stages[stage.key];
    const share = amount * stage.percent / 100 / ids.length;
    for (const id of ids) totals.set(id, (totals.get(id) ?? 0) + share);
  }
  return Array.from(totals, ([staffId, amount]) => ({ staffId, amount }));
}
