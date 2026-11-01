"use client";

import { useState } from "react";
import { BookingStaffFields } from "@/components/forms/booking-staff-fields";

export function GroomingPreview() {
  const [primaryId, setPrimaryId] = useState("a");
  const [secondaryId, setSecondaryId] = useState("b");
  const [saved, setSaved] = useState(false);
  return <main className="stack" style={{ maxWidth: 820, margin: "0 auto" }}>
    <div><p className="muted">MOKU · ตัวอย่างหน้าจอ</p><h1 style={{ margin: "8px 0" }}>แยกงานตามตัวในบิลเดียว</h1><p className="muted">ข้อมูลสมมติสำหรับทดลองใช้งาน ไม่บันทึกลงระบบ</p></div>
    <form className="card stack" onChange={() => setSaved(false)} onSubmit={(event) => { event.preventDefault(); setSaved(true); }}>
      <div className="grooming-pet-heading" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }}><div><strong>บิลตัวอย่าง · แมว 2 ตัว</strong><div className="muted" style={{ marginTop: 6 }}>คุณมิน · โมจิ และ ลูน่า</div></div><strong>ยอดบิล 1,500 บาท</strong></div>
      <BookingStaffFields primaryId={primaryId} secondaryId={secondaryId} onPrimaryChange={setPrimaryId} onSecondaryChange={setSecondaryId} staffOptions={[
        { id: "a", full_name: "พี่แนน", role: "staff" },
        { id: "b", full_name: "พี่เมย์", role: "staff" },
        { id: "c", full_name: "พี่ป่าน", role: "staff" }
      ]} pets={[{ id: "mochi", name: "โมจิ" }, { id: "luna", name: "ลูน่า" }]} totalAmount={1500}
        groomingAllocation={{ version: 2, pets: [
          { petId: "mochi", amount: 900, performedById: "a", secondaryPerformedById: "b", allocation: { profile: "bath_and_haircut", stages: { prep: ["a"], bath: ["a"], dry: ["a", "b"], cut: ["b"] } } },
          { petId: "luna", amount: 600, performedById: "c", secondaryPerformedById: "b", allocation: { profile: "bath_only", stages: { prep: ["c"], bath: ["c"], dry: ["b"] } } }
        ] }} required />
      <button className="btn btn-primary" type="submit">ทดลองบันทึก</button>
      {saved ? <p role="status" style={{ margin: 0, color: "var(--success)" }}>ข้อมูลตัวอย่างครบถ้วน พร้อมบันทึก</p> : null}
    </form>
  </main>;
}
