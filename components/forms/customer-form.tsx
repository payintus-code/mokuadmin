"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createCustomer } from "@/app/actions/customers";
import { useToast } from "@/components/ui/toast-provider";
import {
  CUSTOMER_DRAFT_STORAGE_KEY,
  CUSTOMER_PETS_DRAFT_STORAGE_KEY,
  EMPTY_CUSTOMER_DRAFT,
  type CustomerDraftPet,
  type CustomerDraftValues
} from "@/lib/customer-drafts";
import { StickyFormActions } from "@/components/ui/sticky-form-actions";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to save customer";
}

function readDraftFromStorage(): CustomerDraftValues {
  if (typeof window === "undefined") {
    return EMPTY_CUSTOMER_DRAFT;
  }

  const savedDraft = window.sessionStorage.getItem(CUSTOMER_DRAFT_STORAGE_KEY);

  if (!savedDraft) {
    return EMPTY_CUSTOMER_DRAFT;
  }

  try {
    const parsedDraft = JSON.parse(savedDraft) as Partial<CustomerDraftValues>;

    return {
      fullName: String(parsedDraft.fullName ?? ""),
      phone: String(parsedDraft.phone ?? ""),
      facebookName: String(parsedDraft.facebookName ?? ""),
      note: String(parsedDraft.note ?? "")
    };
  } catch {
    window.sessionStorage.removeItem(CUSTOMER_DRAFT_STORAGE_KEY);
    return EMPTY_CUSTOMER_DRAFT;
  }
}

function readPetsFromStorage(): CustomerDraftPet[] {
  if (typeof window === "undefined") {
    return [];
  }

  const savedPets = window.sessionStorage.getItem(CUSTOMER_PETS_DRAFT_STORAGE_KEY);

  if (!savedPets) {
    return [];
  }

  try {
    const parsedPets = JSON.parse(savedPets);

    if (!Array.isArray(parsedPets)) {
      return [];
    }

    return parsedPets.map((pet) => ({
      name: String(pet?.name ?? ""),
      species: String(pet?.species ?? ""),
      breed: String(pet?.breed ?? ""),
      weightKg: String(pet?.weightKg ?? ""),
      temperamentNote: String(pet?.temperamentNote ?? ""),
      allergyNote: String(pet?.allergyNote ?? "")
    }));
  } catch {
    window.sessionStorage.removeItem(CUSTOMER_PETS_DRAFT_STORAGE_KEY);
    return [];
  }
}

export function CustomerForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<CustomerDraftValues>(readDraftFromStorage);
  const [pets, setPets] = useState<CustomerDraftPet[]>(readPetsFromStorage);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    window.sessionStorage.setItem(CUSTOMER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    window.sessionStorage.setItem(CUSTOMER_PETS_DRAFT_STORAGE_KEY, JSON.stringify(pets));
  }, [pets]);

  function updateDraft<K extends keyof CustomerDraftValues>(key: K, value: CustomerDraftValues[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleAddPet() {
    window.sessionStorage.setItem(CUSTOMER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    window.sessionStorage.setItem(CUSTOMER_PETS_DRAFT_STORAGE_KEY, JSON.stringify(pets));
    router.push("/pets/new?mode=draft&returnTo=/customers/new");
  }

  function handleRemovePet(indexToRemove: number) {
    setPets((current) => current.filter((_, index) => index !== indexToRemove));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const formData = new FormData();
    formData.set("fullName", draft.fullName);
    formData.set("phone", draft.phone);
    formData.set("facebookName", draft.facebookName);
    formData.set("note", draft.note);
    formData.set("petDrafts", JSON.stringify(pets));

    startTransition(() => {
      void (async () => {
        try {
          await createCustomer(formData);
          window.sessionStorage.removeItem(CUSTOMER_DRAFT_STORAGE_KEY);
          window.sessionStorage.removeItem(CUSTOMER_PETS_DRAFT_STORAGE_KEY);
          setDraft(EMPTY_CUSTOMER_DRAFT);
          setPets([]);
          showToast();
          router.push("/customers");
          router.refresh();
        } catch (error) {
          setErrorMessage(getErrorMessage(error));
        }
      })();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card stack">
      <label className="label">
        ชื่อลูกค้า
        <input
          className="input"
          name="fullName"
          placeholder="เช่น คุณเมย์"
          required
          value={draft.fullName}
          onChange={(event) => updateDraft("fullName", event.target.value)}
        />
      </label>

      <label className="label">
        เบอร์โทร
        <input
          className="input"
          name="phone"
          inputMode="tel"
          placeholder="0812345678"
          required
          value={draft.phone}
          onChange={(event) => updateDraft("phone", event.target.value)}
        />
      </label>

      <label className="label">
        ชื่อ Facebook
        <input
          className="input"
          name="facebookName"
          placeholder="ไม่กรอกก็ได้"
          value={draft.facebookName}
          onChange={(event) => updateDraft("facebookName", event.target.value)}
        />
      </label>

      <label className="label">
        หมายเหตุ
        <textarea
          className="textarea"
          name="note"
          placeholder="เช่น โทรก่อนมารับ"
          value={draft.note}
          onChange={(event) => updateDraft("note", event.target.value)}
        />
      </label>

      <section className="form-section">
        <div className="stack">
          <div>
            <h2 className="form-section-title">สัตว์เลี้ยงที่เพิ่มไว้</h2>
            <p className="form-section-copy">เพิ่มสัตว์เลี้ยงไว้ก่อนได้หลายตัว แล้วค่อยบันทึกลูกค้าพร้อมกันครั้งเดียว</p>
          </div>

          <button className="btn btn-ghost" type="button" onClick={handleAddPet}>
            เพิ่มสัตว์เลี้ยง
          </button>
        </div>

        {pets.length ? (
          <div className="stack">
            {pets.map((pet, index) => (
              <article key={`${pet.name}-${index}`} className="card list-card">
                <div className="list-card-top">
                  <div>
                    <h3 className="list-card-title">
                      {index + 1}. {pet.name || "ยังไม่ระบุชื่อ"}
                    </h3>
                    <div className="muted">
                      {pet.species || "ยังไม่ระบุประเภท"}
                      {pet.breed ? ` | ${pet.breed}` : ""}
                    </div>
                  </div>

                  <button className="btn btn-secondary" type="button" onClick={() => handleRemovePet(index)} disabled={isPending}>
                    ลบ
                  </button>
                </div>

                <div className="meta-grid">
                  <div className="meta-block">
                    <div className="meta-label">น้ำหนัก</div>
                    <div className="meta-value">{pet.weightKg ? `${pet.weightKg} kg` : "-"}</div>
                  </div>
                  <div className="meta-block">
                    <div className="meta-label">ข้อควรระวัง</div>
                    <div className="meta-value">{pet.temperamentNote || "-"}</div>
                  </div>
                  <div className="meta-block">
                    <div className="meta-label">อาการแพ้</div>
                    <div className="meta-value">{pet.allergyNote || "-"}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="soft-note">ยังไม่มีสัตว์เลี้ยงที่เพิ่มไว้ กดปุ่มเพิ่มสัตว์เลี้ยงเพื่อกลับมาพร้อมรายการที่สร้างตามลำดับ</div>
        )}
      </section>

      {errorMessage ? <div className="state-note state-note-danger">{errorMessage}</div> : null}

      <StickyFormActions title="พร้อมบันทึกลูกค้า" hint="ปุ่มเพิ่มสัตว์เลี้ยงเป็นขั้นตอนเสริม ส่วนปุ่มนี้คือบันทึกลูกค้าจริง">
        <button className="btn btn-primary" type="submit" disabled={isPending}>
          {isPending ? "กำลังบันทึก..." : "เพิ่มลูกค้า"}
        </button>
      </StickyFormActions>
    </form>
  );
}
