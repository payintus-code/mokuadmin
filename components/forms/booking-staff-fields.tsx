"use client";

import type { StaffOption } from "@/types/database";

type SavedStaff = { id: string | null; name: string | null };

export function BookingStaffFields({
  primaryId, secondaryId, onPrimaryChange, onSecondaryChange, staffOptions, savedStaff = [], required = false, disabled = false
}: {
  primaryId: string;
  secondaryId: string;
  onPrimaryChange: (value: string) => void;
  onSecondaryChange: (value: string) => void;
  staffOptions: StaffOption[];
  savedStaff?: SavedStaff[];
  required?: boolean;
  disabled?: boolean;
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
      <span className="label-hint">เลือก 1 คนจะนับยอดรับจริงเต็มจำนวน เลือก 2 คนจะแบ่งยอดคนละครึ่งก่อนคิดค่าคอม</span>
    </div>
  );
}
