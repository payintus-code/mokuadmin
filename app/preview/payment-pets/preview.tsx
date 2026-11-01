"use client";

import { useState } from "react";
import { BookingPaymentPets } from "@/components/forms/booking-payment-pets";
import { BookingStaffFields } from "@/components/forms/booking-staff-fields";
import { resolvePaymentBookingPetIds, type PaymentPetOption } from "@/lib/payment-booking-pets";

export function PaymentPetsPreview() {
  const [pets, setPets] = useState<PaymentPetOption[]>([{ id: "old-combined", name: "น้องโอ๊ะ/อุง", species: "cat" }]);
  const [primary, setPrimary] = useState("staff-a");
  const [secondary, setSecondary] = useState("staff-b");
  const [saved, setSaved] = useState(false);
  const customerPets = [{ id: "oh", name: "น้องโอ๊ะ", species: "cat" }];
  const combined = pets.some((pet) => /[\/／]/.test(pet.name));
  return <main className="stack" style={{ maxWidth: 820, margin: "0 auto" }}>
    <div><p className="muted">MOKU · ตัวอย่างหน้ารับเงิน</p><h1>จัดการชื่อในบิลเก่า</h1><p className="muted">ข้อมูลสมมติ ทดลองแยกชื่อ เพิ่มตัว และระบุผู้ทำได้ ไม่บันทึกลงระบบจริง</p></div>
    <section className="card stack"><strong>บิลตัวอย่าง · คุณฝน</strong><div className="grid-2"><div><span className="muted">สัตว์เลี้ยงในบิล</span><div>{pets.map((pet) => pet.name).join(" / ")}</div></div><div><span className="muted">ยอดบิล / รับแล้ว</span><div>1,500 บาท / 200 บาท</div></div></div></section>
    <BookingPaymentPets key={pets.map((pet) => pet.id).join(":")} bookingId="sample-bill" pets={pets} customerPets={customerPets} onSave={async (drafts) => {
      const ids = await resolvePaymentBookingPetIds(drafts, [...pets, ...customerPets], async (pet) => `sample-${pet.name}`);
      setPets(drafts.map((pet, index) => ({ id: ids[index], name: pet.name, species: pet.species })));
      setSaved(false);
    }} />
    {combined ? <p className="soft-note">แยกชื่อและบันทึกรายชื่อด้านบนก่อน แล้วเลือกผู้ทำแยกแต่ละตัวได้ที่นี่</p> : <form className="card stack" onChange={() => setSaved(false)} onSubmit={(event) => { event.preventDefault(); setSaved(true); }}>
      <h2 className="section-title">ราคาและผู้ทำรายตัว</h2>
      <BookingStaffFields key={pets.map((pet) => pet.id).join(":")} pets={pets} totalAmount={1500} primaryId={primary} secondaryId={secondary}
        onPrimaryChange={setPrimary} onSecondaryChange={setSecondary} staffOptions={[{ id: "staff-a", full_name: "พี่แนน", role: "staff" }, { id: "staff-b", full_name: "พี่เมย์", role: "staff" }]} required />
      <button type="submit" className="btn btn-primary">ทดลองบันทึกผู้ทำรายตัว</button>
      {saved ? <p className="state-note state-note-success" role="status">ข้อมูลตัวอย่างพร้อมบันทึกแล้ว</p> : null}
    </form>}
  </main>;
}
