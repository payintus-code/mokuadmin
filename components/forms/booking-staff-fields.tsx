"use client";

import type { StaffOption } from "@/types/database";
import { useCallback, useEffect, useId, useState } from "react";
import { GROOMING_PROFILES, isPerPetAllocation, type GroomingAllocation, type GroomingStageAllocation, type GroomingProfile } from "@/lib/grooming-allocation";
import { formatBaht } from "@/lib/format";

type SavedStaff = { id: string | null; name: string | null };
export type GroomingPetOption = { id: string; name: string };

export function BookingStaffFields({
  primaryId, secondaryId, onPrimaryChange, onSecondaryChange, staffOptions, savedStaff = [], required = false, disabled = false, groomingAllocation = null,
  pets = [], totalAmount = 0, allocationInputName = "groomingAllocation", fieldPrefix = "", onAllocationChange, defaultWholeService = false
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
  pets?: GroomingPetOption[];
  totalAmount?: number;
  allocationInputName?: string;
  fieldPrefix?: string;
  onAllocationChange?: (value: GroomingStageAllocation | null) => void;
  defaultWholeService?: boolean;
}) {
  if (pets.length > 1 || (groomingAllocation && isPerPetAllocation(groomingAllocation) && pets.length > 0)) {
    return <PerPetStaffFields key={pets.map((pet) => pet.id).join(":")} pets={pets} totalAmount={totalAmount} staffOptions={staffOptions} savedStaff={savedStaff}
      initial={groomingAllocation} primaryId={primaryId} secondaryId={secondaryId} disabled={disabled} onPrimaryChange={onPrimaryChange} onSecondaryChange={onSecondaryChange} />;
  }
  const options = [...staffOptions.map((person) => ({ id: person.id, name: person.full_name }))];
  for (const person of savedStaff) {
    if (person.id && [primaryId, secondaryId].includes(person.id) && !options.some((option) => option.id === person.id)) {
      options.push({ id: person.id, name: `${person.name ?? "พนักงานเดิม"} (ปิดใช้งาน)` });
    }
  }

  return (
    <div className="stack">
      <div className="grid-2">
        <label className="label">
          พนักงานหลัก
          <select className="select" name={`${fieldPrefix}performedById`} value={primaryId} required={required} disabled={disabled} onChange={(event) => {
            onPrimaryChange(event.target.value);
            if (!event.target.value) onSecondaryChange("");
          }}>
            <option value="">{required ? "เลือกพนักงานที่ทำ" : "ยังไม่ระบุพนักงาน"}</option>
            {options.map((person) => <option key={person.id} value={person.id} disabled={person.id === secondaryId}>{person.name}</option>)}
          </select>
        </label>
        <label className="label">
          พนักงานร่วมงาน (ถ้ามี)
          <select className="select" name={`${fieldPrefix}secondaryPerformedById`} value={secondaryId} disabled={disabled || !primaryId} onChange={(event) => onSecondaryChange(event.target.value)}>
            <option value="">ไม่มีพนักงานคนที่ 2</option>
            {options.map((person) => <option key={person.id} value={person.id} disabled={person.id === primaryId}>{person.name}</option>)}
          </select>
        </label>
      </div>
      {!primaryId && !disabled ? <input type="hidden" name={`${fieldPrefix}secondaryPerformedById`} value="" /> : null}
      <GroomingStageFields primaryId={primaryId} secondaryId={secondaryId} initial={groomingAllocation && !isPerPetAllocation(groomingAllocation) ? groomingAllocation : null} options={options} required={required} disabled={disabled} inputName={allocationInputName} onAllocationChange={onAllocationChange} defaultWholeService={defaultWholeService} />
    </div>
  );
}

function GroomingStageFields({ primaryId, secondaryId, initial, options, required, disabled, inputName, onAllocationChange, defaultWholeService }: {
  primaryId: string; secondaryId: string; initial: GroomingStageAllocation | null;
  options: { id: string; name: string }[]; required: boolean; disabled: boolean;
  inputName: string;
  onAllocationChange?: (value: GroomingStageAllocation | null) => void;
  defaultWholeService: boolean;
}) {
  const groupId = useId();
  const [profile, setProfile] = useState<GroomingProfile | "" | "whole_service">(initial?.profile ?? (defaultWholeService || !required ? "whole_service" : ""));
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
  const serializedAllocation = JSON.stringify(allocation);
  useEffect(() => { onAllocationChange?.(JSON.parse(serializedAllocation)); }, [serializedAllocation, onAllocationChange]);
  const name = (id: string) => options.find((person) => person.id === id)?.name ?? "ยังไม่ระบุ";
  return <div className="grooming-workflow">
    <fieldset className="grooming-fieldset" disabled={disabled}>
      <legend>ประเภทบริการ</legend>
      <div className="grooming-profile-options">
        {([
          ["bath_only", "อาบน้ำอย่างเดียว", "อาบน้ำ เป่าขน และเก็บงาน"],
          ["bath_and_haircut", "อาบน้ำพร้อมตัดขน", "ดูแลครบ พร้อมตัดแต่งทรง"],
          ["whole_service", "บริการอื่น", "ระบุผู้ทำทั้งบริการ"]
        ] as const).map(([value, title, hint]) => <label className="grooming-profile-option" key={value}>
          <input type="radio" name={`${groupId}-profile`} value={value} checked={profile === value} required={required} onChange={() => setProfile(value)} />
          <span><strong>{title}</strong><small>{hint}</small></span>
        </label>)}
      </div>
    </fieldset>
    <input type="hidden" name={inputName} value={serializedAllocation} disabled={disabled} />
    {stageProfile ? <div className="stack">
      <div><strong>ใครทำขั้นตอนไหน</strong><p className="grooming-help">{!primaryId ? "เลือกพนักงานด้านบนก่อนระบุผู้ทำแต่ละขั้นตอน" : secondaryId ? "แตะชื่อผู้ทำ หรือเลือกทำร่วมกัน" : "พนักงานหลักรับผิดชอบทุกขั้นตอน เพิ่มพนักงานร่วมงานได้ด้านบน"}</p></div>
      <div className="grooming-stage-list">
        {definitions.map((stage, index) => <fieldset className="grooming-stage" key={stage.key} disabled={disabled || !primaryId}>
          <legend><span className="grooming-step-number">{index + 1}</span>{stage.label}</legend>
          <div className="grooming-worker-options">
            {([
              ["primary", name(primaryId)],
              ...(secondaryId ? [["secondary", name(secondaryId)], ["both", "ทำร่วมกัน"]] : [])
            ]).map(([value, label]) => <label className="grooming-worker-option" key={value}>
              <input type="radio" name={`${groupId}-${stage.key}`} value={value} checked={(secondaryId ? workers[stage.key] ?? "primary" : "primary") === value} onChange={() => setWorkers((current) => ({ ...current, [stage.key]: value }))} />
              <span>{label}</span>
            </label>)}
          </div>
        </fieldset>)}
      </div>
    </div> : profile === "whole_service" ? <p className="grooming-help">บันทึกผู้ให้บริการทั้งงาน โดยไม่แยกขั้นตอน</p> : <p className="grooming-help">เลือกประเภทบริการเพื่อระบุขั้นตอนการทำงาน</p>}
  </div>;
}

type PetDraft = { amount: string; primaryId: string; secondaryId: string; allocation: GroomingStageAllocation | null; savedWholeService: boolean };

function PerPetStaffFields({ pets, totalAmount, staffOptions, savedStaff, initial, primaryId, secondaryId, disabled, onPrimaryChange, onSecondaryChange }: {
  pets: GroomingPetOption[]; totalAmount: number; staffOptions: StaffOption[]; savedStaff: SavedStaff[];
  initial: GroomingAllocation | null; primaryId: string; secondaryId: string; disabled: boolean;
  onPrimaryChange: (value: string) => void; onSecondaryChange: (value: string) => void;
}) {
  const panelGroupId = useId();
  const [activeId, setActiveId] = useState(pets[0].id);
  const [drafts, setDrafts] = useState<Record<string, PetDraft>>(() => Object.fromEntries(pets.map((pet) => {
    const saved = initial && isPerPetAllocation(initial) ? initial.pets.find((entry) => entry.petId === pet.id) : null;
    return [pet.id, { amount: saved ? String(saved.amount) : "", primaryId: saved?.performedById ?? primaryId,
      secondaryId: saved ? saved.secondaryPerformedById ?? "" : secondaryId,
      savedWholeService: Boolean(saved && !saved.allocation),
      allocation: saved ? saved.allocation : initial && !isPerPetAllocation(initial) ? initial : null }];
  })));
  const updateDraft = useCallback((id: string, patch: Partial<PetDraft>) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }, []);
  const firstPrimaryId = drafts[pets[0].id].primaryId;
  const firstSecondaryId = drafts[pets[0].id].secondaryId;
  useEffect(() => { onPrimaryChange(firstPrimaryId); onSecondaryChange(firstSecondaryId); }, [firstPrimaryId, firstSecondaryId, onPrimaryChange, onSecondaryChange]);
  const sum = pets.reduce((total, pet) => total + Number(drafts[pet.id].amount || 0), 0);
  const completePrices = pets.every((pet) => drafts[pet.id].amount.trim() !== "" && Number(drafts[pet.id].amount) >= 0);
  const matches = completePrices && Math.abs(sum - totalAmount) < 0.0001;
  const allocation = { version: 2, pets: pets.map((pet) => ({ petId: pet.id, amount: Number(drafts[pet.id].amount),
    performedById: drafts[pet.id].primaryId, secondaryPerformedById: drafts[pet.id].secondaryId || null, allocation: drafts[pet.id].allocation })) };
  return <div className="stack" onInvalidCapture={(event) => {
    const target = event.target as HTMLInputElement;
    const id = target.closest<HTMLElement>("[data-pet-id]")?.dataset.petId;
    if (id && id !== activeId) { event.preventDefault(); setActiveId(id); requestAnimationFrame(() => { target.focus(); target.reportValidity(); }); }
  }}>
    <input type="hidden" name="groomingAllocation" value={JSON.stringify(allocation)} disabled={disabled} />
    <input type="hidden" name="performedById" value={drafts[pets[0].id].primaryId} disabled={disabled} />
    <input type="hidden" name="secondaryPerformedById" value={drafts[pets[0].id].secondaryId} disabled={disabled} />
    <div><strong>เลือกตัวที่ต้องการระบุผู้ทำ</strong><p className="grooming-help">แยกราคาและผู้ทำงานของแต่ละตัวในบิลเดียวกัน</p></div>
    <div className="grooming-pet-tabs" role="group" aria-label="เลือกสัตว์เลี้ยง">
      {pets.map((pet, index) => <button className="grooming-pet-tab" key={pet.id} type="button" aria-pressed={activeId === pet.id} aria-controls={`${panelGroupId}-${pet.id}`} onClick={() => setActiveId(pet.id)}>
        <span className="grooming-pet-avatar" aria-hidden="true">{index + 1}</span>
        <span><strong>{pet.name}</strong><small>{drafts[pet.id].amount ? formatBaht(Number(drafts[pet.id].amount)) : "ยังไม่ระบุราคา"}</small></span>
        <span className="grooming-pet-status">{drafts[pet.id].primaryId ? "ระบุผู้ทำแล้ว" : "รอระบุผู้ทำ"}</span>
      </button>)}
    </div>
    {pets.map((pet) => <div key={pet.id} id={`${panelGroupId}-${pet.id}`} data-pet-id={pet.id} hidden={activeId !== pet.id}>
      <PetStaffPanel pet={pet} draft={drafts[pet.id]} updateDraft={updateDraft} staffOptions={staffOptions} savedStaff={savedStaff} disabled={disabled}
        priceError={activeId === pet.id && completePrices && !matches ? "ยอดบริการรายตัวรวมกันต้องเท่ากับยอดรวมของบิล" : ""} />
    </div>)}
    <div className={`grooming-bill-summary ${matches ? "is-balanced" : ""}`} aria-live="polite">
      <div><span>รวมบริการ {pets.length} ตัว</span><strong>{formatBaht(sum)}</strong></div>
      <div><span>ยอดบิล</span><strong>{formatBaht(totalAmount)}</strong></div>
      <p>{matches ? "ยอดรายตัวตรงกับยอดบิลแล้ว" : !completePrices ? "กรอกราคาบริการให้ครบทุกตัว" : `ยอดรายตัวยัง${sum < totalAmount ? "ขาด" : "เกิน"} ${formatBaht(Math.abs(totalAmount - sum))}`}</p>
    </div>
  </div>;
}

function PetStaffPanel({ pet, draft, updateDraft, staffOptions, savedStaff, disabled, priceError }: {
  pet: GroomingPetOption; draft: PetDraft; updateDraft: (id: string, patch: Partial<PetDraft>) => void;
  staffOptions: StaffOption[]; savedStaff: SavedStaff[]; disabled: boolean; priceError: string;
}) {
  const onAllocationChange = useCallback((allocation: GroomingStageAllocation | null) => updateDraft(pet.id, { allocation }), [pet.id, updateDraft]);
  return <div className="grooming-pet-panel stack">
    <div className="grooming-pet-heading"><div><span className="grooming-help">กำลังระบุงานของ</span><h3>{pet.name}</h3></div>
      <label className="label">ราคาบริการ (บาท)<input ref={(input) => { input?.setCustomValidity(priceError); }} className="input" type="number" inputMode="numeric" min="0" step="1" required disabled={disabled}
        aria-label={`ราคาบริการ ${pet.name}`} placeholder="กรอกราคาของตัวนี้" value={draft.amount} onChange={(event) => updateDraft(pet.id, { amount: event.target.value })} /></label>
    </div>
    <BookingStaffFields primaryId={draft.primaryId} secondaryId={draft.secondaryId} onPrimaryChange={(value) => updateDraft(pet.id, { primaryId: value })}
      onSecondaryChange={(value) => updateDraft(pet.id, { secondaryId: value })} staffOptions={staffOptions} savedStaff={savedStaff} groomingAllocation={draft.allocation}
      required disabled={disabled} fieldPrefix={`${pet.id}-`} allocationInputName={`${pet.id}-allocation`} onAllocationChange={onAllocationChange} defaultWholeService={draft.savedWholeService} />
  </div>;
}
