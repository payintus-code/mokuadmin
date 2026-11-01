"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePaymentBookingPets } from "@/app/actions/payment-pets";
import { splitImportedPetNames } from "@/lib/booking-chat-import";
import { parsePaymentPetDrafts, type PaymentPetDraft, type PaymentPetOption } from "@/lib/payment-booking-pets";

export function BookingPaymentPets({ bookingId, pets, customerPets, onSave }: {
  bookingId: string; pets: PaymentPetOption[]; customerPets: PaymentPetOption[];
  onSave?: (pets: PaymentPetDraft[]) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<PaymentPetDraft[]>(() => pets.map((pet) => ({ id: pet.id, name: pet.name, species: pet.species === "dog" ? "dog" : "cat" })));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const options = [...pets, ...customerPets.filter((pet) => !pets.some((current) => current.id === pet.id))];
  const hasCombinedNames = rows.some((pet) => /[\/／]/.test(pet.name));
  function changeRow(index: number, patch: Partial<PaymentPetDraft>) {
    setRows((current) => current.map((row, position) => position === index ? { ...row, ...patch } : row));
    setSaved(false);
    setError("");
  }
  function splitNames() {
    try {
      const names = splitImportedPetNames(rows.map((row) => row.name).join("/"));
      setRows(names.map((name, index) => {
        const existing = options.find((pet) => pet.name.trim() === name);
        return { id: existing?.id ?? null, name, species: existing?.species === "dog" || (!existing && rows[Math.min(index, rows.length - 1)].species === "dog") ? "dog" : "cat" };
      }));
      setError(""); setSaved(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถแยกชื่อได้"); }
  }
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSaved(false);
    startTransition(async () => {
      try {
        const next = parsePaymentPetDrafts(rows);
        if (onSave) await onSave(next);
        else await updatePaymentBookingPets({ bookingId, expectedPetIds: pets.map((pet) => pet.id), pets: next });
        setSaved(true);
        if (!onSave) router.refresh();
      } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกรายชื่อได้"); }
    });
  }
  return <section className="card stack payment-card">
    <div><h2 className="section-title">จัดการชื่อสัตว์เลี้ยงในบิล</h2><p className="form-section-copy">บันทึกรายชื่อให้ครบ แล้วระบุราคาและผู้ทำแต่ละตัวด้านล่าง</p></div>
    <form className="stack" onSubmit={save}>
      <fieldset className="grooming-fieldset stack" disabled={pending}>
        {hasCombinedNames ? <div className="state-note state-note-warning stack"><span>พบชื่อที่คั่นด้วย / สามารถแยกเป็นคนละตัวก่อนระบุผู้ทำงาน</span><button className="btn btn-secondary" type="button" onClick={splitNames}>แยกชื่อที่คั่นด้วย /</button></div> : null}
        {rows.map((row, index) => <div className="grooming-pet-panel stack" key={index}>
          <div className="grooming-pet-heading"><strong>สัตว์เลี้ยงตัวที่ {index + 1}</strong>
            {row.id ? <button className="btn btn-ghost" type="button" onClick={() => changeRow(index, { id: null })}>กำหนดชื่อให้ตัวนี้</button> : null}
            {index >= pets.length ? <button className="btn btn-ghost" type="button" onClick={() => { setRows((current) => current.slice(0, index)); setSaved(false); setError(""); }}>นำตัวที่เพิ่มออก</button> : null}
          </div>
          <label className="label">เลือกจากข้อมูลลูกค้า หรือกำหนดชื่อใหม่
            <select className="select" aria-label={`เลือกสัตว์เลี้ยงตัวที่ ${index + 1}`} value={row.id ?? ""} onChange={(event) => {
              const selected = options.find((pet) => pet.id === event.target.value);
              changeRow(index, selected ? { id: selected.id, name: selected.name, species: selected.species === "dog" ? "dog" : "cat" } : { id: null });
            }}>
              <option value="">กรอกชื่อ / เพิ่มสัตว์เลี้ยงใหม่</option>
              {options.map((pet) => <option key={pet.id} value={pet.id} disabled={rows.some((other, position) => position !== index && other.id === pet.id)}>{pet.name}{pet.species === "dog" ? " · สุนัข" : " · แมว"}</option>)}
            </select>
          </label>
          <div className="grid-2">
            <label className="label">ชื่อน้อง<input className="input" aria-label={`ชื่อสัตว์เลี้ยงตัวที่ ${index + 1}`} value={row.name} readOnly={Boolean(row.id)} required pattern="[^/／]+" title="กรอกชื่อน้องหนึ่งตัวต่อช่อง หรือกดแยกชื่อที่คั่นด้วย /" onChange={(event) => changeRow(index, { name: event.target.value })} placeholder="ชื่อน้องหนึ่งตัว" /></label>
            <label className="label">ประเภทสัตว์<select className="select" aria-label={`ประเภทสัตว์ตัวที่ ${index + 1}`} value={row.species} disabled={Boolean(row.id)} onChange={(event) => changeRow(index, { species: event.target.value as "cat" | "dog" })}><option value="cat">แมว</option><option value="dog">สุนัข</option></select></label>
          </div>
        </div>)}
        {rows.length < 2 ? <button className="btn btn-secondary" type="button" onClick={() => { setRows((current) => [...current, { id: null, name: "", species: current[0]?.species ?? "cat" }]); setSaved(false); setError(""); }}>เพิ่มสัตว์เลี้ยงตัวที่ 2</button> : null}
        <p className="grooming-help">กำหนดชื่อสำหรับบิลนี้ได้ โดยชื่อในบิลอื่นยังคงเดิม รองรับสูงสุด 2 ตัวต่อบิล</p>
        <button className="btn btn-primary" type="submit">{pending ? "กำลังบันทึกรายชื่อ..." : "บันทึกรายชื่อในบิล"}</button>
      </fieldset>
      {error ? <p className="state-note state-note-danger" role="alert">{error}</p> : null}
      {saved ? <p className="state-note state-note-success" role="status">บันทึกรายชื่อแล้ว เลือกราคาและผู้ทำแต่ละตัวด้านล่างได้เลย</p> : null}
    </form>
  </section>;
}
