"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { createPet } from "@/app/actions/pets";
import { StickyFormActions } from "@/components/ui/sticky-form-actions";
import { ToastActionForm } from "@/components/ui/toast-action-form";
import { useToast } from "@/components/ui/toast-provider";
import {
  CUSTOMER_PETS_DRAFT_STORAGE_KEY,
  type CustomerDraftPet
} from "@/lib/customer-drafts";
import type { Customer } from "@/types/database";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? "กำลังบันทึก..." : "เพิ่มสัตว์เลี้ยง"}
    </button>
  );
}

type PetFormProps = {
  customers: Customer[];
  draftMode?: boolean;
  returnTo?: string;
};

const EMPTY_DRAFT_PET: CustomerDraftPet = {
  name: "",
  species: "",
  breed: "",
  weightKg: "",
  temperamentNote: "",
  allergyNote: ""
};

export function PetForm({ customers, draftMode = false, returnTo = "/customers/new" }: PetFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [draftPet, setDraftPet] = useState<CustomerDraftPet>(EMPTY_DRAFT_PET);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  function updateDraftPet<K extends keyof CustomerDraftPet>(key: K, value: CustomerDraftPet[K]) {
    setDraftPet((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleDraftSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!draftPet.name.trim() || !draftPet.species.trim()) {
      setErrorMessage("กรุณากรอกชื่อสัตว์เลี้ยงและประเภทสัตว์");
      return;
    }

    if (draftPet.weightKg.trim() && Number.isNaN(Number(draftPet.weightKg))) {
      setErrorMessage("น้ำหนักไม่ถูกต้อง");
      return;
    }

    setIsSavingDraft(true);

    try {
      const savedPets = window.sessionStorage.getItem(CUSTOMER_PETS_DRAFT_STORAGE_KEY);
      const currentPets = savedPets ? (JSON.parse(savedPets) as CustomerDraftPet[]) : [];

      window.sessionStorage.setItem(
        CUSTOMER_PETS_DRAFT_STORAGE_KEY,
        JSON.stringify([
          ...currentPets,
          {
            ...draftPet,
            name: draftPet.name.trim(),
            species: draftPet.species.trim(),
            breed: draftPet.breed.trim(),
            weightKg: draftPet.weightKg.trim(),
            temperamentNote: draftPet.temperamentNote.trim(),
            allergyNote: draftPet.allergyNote.trim()
          }
        ])
      );

      showToast();
      router.push(returnTo);
      router.refresh();
    } catch {
      setErrorMessage("ไม่สามารถเพิ่มสัตว์เลี้ยงชั่วคราวได้");
      setIsSavingDraft(false);
    }
  }

  if (draftMode) {
    return (
      <form onSubmit={handleDraftSubmit} className="card stack">
        <div className="soft-note">สัตว์เลี้ยงที่เพิ่มในหน้านี้จะถูกแนบกลับไปที่ฟอร์มสร้างลูกค้าเดิมตามลำดับที่กดเพิ่ม</div>

        <div className="grid-2">
          <label className="label">
            ชื่อสัตว์เลี้ยง
            <input
              className="input"
              name="name"
              placeholder="เช่น โมจิ"
              required
              value={draftPet.name}
              onChange={(event) => updateDraftPet("name", event.target.value)}
            />
          </label>

          <label className="label">
            ประเภทสัตว์
            <input
              className="input"
              name="species"
              placeholder="เช่น dog, cat"
              required
              value={draftPet.species}
              onChange={(event) => updateDraftPet("species", event.target.value)}
            />
          </label>
        </div>

        <div className="grid-2">
          <label className="label">
            สายพันธุ์
            <input
              className="input"
              name="breed"
              placeholder="ไม่กรอกก็ได้"
              value={draftPet.breed}
              onChange={(event) => updateDraftPet("breed", event.target.value)}
            />
          </label>

          <label className="label">
            น้ำหนัก (กก.)
            <input
              className="input"
              name="weightKg"
              type="number"
              min="0"
              step="0.01"
              placeholder="เช่น 4.5"
              value={draftPet.weightKg}
              onChange={(event) => updateDraftPet("weightKg", event.target.value)}
            />
          </label>
        </div>

        <label className="label">
          นิสัย / ข้อควรระวัง
          <textarea
            className="textarea"
            name="temperamentNote"
            placeholder="เช่น ขี้ตกใจ ไม่ชอบไดร์เสียงดัง"
            value={draftPet.temperamentNote}
            onChange={(event) => updateDraftPet("temperamentNote", event.target.value)}
          />
        </label>

        <label className="label">
          แพ้อะไรบ้าง
          <textarea
            className="textarea"
            name="allergyNote"
            placeholder="เช่น แพ้น้ำหอม หรือไม่กรอกก็ได้"
            value={draftPet.allergyNote}
            onChange={(event) => updateDraftPet("allergyNote", event.target.value)}
          />
        </label>

        {errorMessage ? <div className="state-note state-note-danger">{errorMessage}</div> : null}

        <div className="btn-grid">
          <Link className="btn btn-secondary" href={returnTo}>
            กลับไปฟอร์มลูกค้า
          </Link>
        </div>

        <StickyFormActions title="พร้อมแนบสัตว์เลี้ยง" hint="รายการนี้จะกลับไปอยู่ในฟอร์มลูกค้าก่อนบันทึกจริง">
          <button className="btn btn-primary" type="submit" disabled={isSavingDraft}>
            {isSavingDraft ? "กำลังบันทึก..." : "เพิ่มสัตว์เลี้ยง"}
          </button>
        </StickyFormActions>
      </form>
    );
  }

  return (
    <ToastActionForm action={createPet} className="card stack">
      <label className="label">
        เจ้าของ
        <select className="select" name="customerId" required>
          <option value="">เลือกเจ้าของ</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.full_name} - {customer.phone}
            </option>
          ))}
        </select>
      </label>

      <div className="grid-2">
        <label className="label">
          ชื่อสัตว์เลี้ยง
          <input className="input" name="name" placeholder="เช่น โมจิ" required />
        </label>

        <label className="label">
          ประเภทสัตว์
          <input className="input" name="species" placeholder="เช่น dog, cat" required />
        </label>
      </div>

      <div className="grid-2">
        <label className="label">
          สายพันธุ์
          <input className="input" name="breed" placeholder="ไม่กรอกก็ได้" />
        </label>

        <label className="label">
          น้ำหนัก (กก.)
          <input className="input" name="weightKg" type="number" min="0" step="0.01" placeholder="เช่น 4.5" />
        </label>
      </div>

      <label className="label">
        นิสัย / ข้อควรระวัง
        <textarea className="textarea" name="temperamentNote" placeholder="เช่น ขี้ตกใจ ไม่ชอบไดร์เสียงดัง" />
      </label>

      <label className="label">
        แพ้อะไรบ้าง
        <textarea className="textarea" name="allergyNote" placeholder="เช่น แพ้น้ำหอม หรือไม่กรอกก็ได้" />
      </label>

      <StickyFormActions title="พร้อมบันทึกสัตว์เลี้ยง" hint="ตรวจเจ้าของและชื่อสัตว์เลี้ยงก่อนบันทึก">
        <SubmitButton />
      </StickyFormActions>
    </ToastActionForm>
  );
}
