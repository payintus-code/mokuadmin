"use client";

import type { StaffOption } from "@/types/database";
import { useState } from "react";
import { GROOMING_PROFILES, type GroomingAllocation, type GroomingProfile } from "@/lib/grooming-allocation";

type SavedStaff = { id: string | null; name: string | null };

export function BookingStaffFields({
  primaryId, secondaryId, onPrimaryChange, onSecondaryChange, staffOptions, savedStaff = [], required = false, disabled = false, groomingAllocation = null
}: {
  primaryId: string;
  secondaryId: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
  staffOptions: StaffOption[];
  savedStaff?: SavedStaff[];
  required?: boolean;
  disabled?: boolean;
  groomingAllocation?: GroomingAllocation | null;
}) {
  const options = [...staffOptions.map((person) => ({ id: person.id, name: person.full_name }))];
  for (const person of savedStaff) {
    if (person.id && !options.some((option) => option.id === person.id)) {
      options.push({ id: person.id, name: `${person.name ?? "พนักงานเดิม"} (ปิดใช้งาน)` });
    }
  }

  return (
    <div className="stack">
      <div className="grid-2">
        <label className="label">
          พนักงานผู้ให้บริการคนที่ 1
          <select className="select" name="performedById" value={primaryId} required={required} disabled={disabled} onChange={(event) => {
            onPrimaryChange(event.target.value);
            if (!event.target.value) onSecondaryChange("");
          }}>
            <option value="">{required ? "เลือกพนักงานที่ทำ" : "ยังไม่ระบุพนักงาน"}</option>
            {options.map((person) => <option key={person.id} value={person.id} disabled={person.id === secondaryId}>{person.name}</option>)}
          </select>
        </label>
        <label className="label">
          พนักงานผู้ให้บริการคนที่ 2
          <select className="select" name="secondaryPerformedById" value={secondaryId} disabled={disabled || !primaryId} onChange={(event) => onSecondaryChange(event.target.value)}>
            <option value="">ไม่มีพนักงานคนที่ 2</option>
            {options.map((person) => <option key={person.id} value={person.id} disabled={person.id === primaryId}>{person.name}</option>)}
          </select>
        </label>
      </div>
      {!primaryId && !disabled ? <input type="hidden" name="secondaryPerformedById" value="" /> : null}
      <GroomingStageFields primaryId={primaryId} secondaryId={secondaryId} initial={groomingAllocation} options={options} required={required} disabled={disabled} />
    </div>
  );
}

function GroomingStageFields({ primaryId, secondaryId, initial, options, required, disabled }: {
  primaryId: string; secondaryId: string; initial: GroomingAllocation | null;
  options: { id: string; name: string }[]; required: boolean; disabled: boolean;
}) {
  const [profile, setProfile] = useState<GroomingProfile | "" | "whole_service">(initial?.profile ?? (required ? "" : "whole_service"));
  const [workers, setWorkers] = useState<Record<string, string>>(() => Object.fromEntries(
    Object.entries(initial?.stages ?? {}).map(([key, ids]) => [key, ids.length === 2 ? "both" : ids[0] === secondaryId ? "secondary" : "primary"])
  ));
  const stageProfile = profile === "bath_only" || profile === "bath_and_haircut" ? profile : null;
  const definitions = stageProfile ? GROOMING_PROFILES[stageProfile] : [];
  const stages = Object.fromEntries(definitions.map((stage) => {
    const selected = secondaryId ? workers[stage.key] ?? "primary" : "primary";
    return [stage.key, selected === "both" ? [primaryId, secondaryId].filter(Boolean) : [selected === "secondary" ? secondaryId : primaryId].filter(Boolean)];
  }));
  const allocation = stageProfile ? { profile: stageProfile, stages } : null;
  const shares = new Map<string, number>();
  for (const stage of definitions) {
    const ids = stages[stage.key];
    for (const id of ids) shares.set(id, (shares.get(id) ?? 0) + stage.percent / ids.length);
  }
  const name = (id: string) => options.find((person) => person.id === id)?.name ?? "ยังไม่ระบุ";
  return <div className="stack">
    <label className="label">รูปแบบแบ่งยอดตามขั้นตอน
      <select className="select" value={profile} required={required} disabled={disabled} onChange={(event) => setProfile(event.target.value as typeof profile)}>
        <option value="">เลือกรูปแบบบริการ</option>
        <option value="bath_only">อาบน้ำอย่างเดียว (หมาและแมว) — 10% / 30% / 60%</option>
        <option value="bath_and_haircut">อาบน้ำพร้อมตัดขน (หมาและแมว) — 5% / 20% / 30% / 45%</option>
        <option value="whole_service">บริการอื่น / แบบเดิม (แบ่งยอดทั้งบริการ)</option>
      </select>
    </label>
    <input type="hidden" name="groomingAllocation" value={JSON.stringify(allocation)} disabled={disabled} />
    {definitions.map((stage) => <label className="label" key={stage.key}>
      {stage.label} — {stage.percent}%
      <select className="select" disabled={disabled || !primaryId} value={secondaryId ? workers[stage.key] ?? "primary" : "primary"} onChange={(event) => setWorkers({ ...workers, [stage.key]: event.target.value })}>
        <option value="primary">{name(primaryId)} ทำคนเดียว</option>
        {secondaryId ? <option value="secondary">{name(secondaryId)} ทำคนเดียว</option> : null}
        {secondaryId ? <option value="both">ทำร่วมกัน 2 คน — คนละ {stage.percent / 2}%</option> : null}
      </select>
    </label>)}
    {stageProfile ? <span className="label-hint">{Array.from(shares, ([id, percent]) => `${name(id)} ${percent}%`).join(" · ")} ของยอดบริการ ก่อนคิดค่าคอมขั้นบันได</span> : <span className="label-hint">แบบเดิม: ทำ 1 คนได้ยอดเต็ม ทำ 2 คนแบ่งยอดทั้งบริการคนละครึ่ง</span>}
  </div>;
}
