"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createStaff } from "@/app/actions/staff";
import { useToast } from "@/components/ui/toast-provider";

export function StaffForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setErrorMessage("");

    startTransition(async () => {
      try {
        const result = await createStaff(formData);
        if ("error" in result) {
          setErrorMessage(result.error);
          return;
        }
        form.reset();
        showToast("เพิ่มพนักงานเรียบร้อยแล้ว");
        router.refresh();
      } catch {
        setErrorMessage("เพิ่มพนักงานไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และลองอีกครั้ง");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card stack" aria-labelledby="staff-form-title" aria-busy={isPending}>
      <div>
        <h2 id="staff-form-title" className="section-title">เพิ่มพนักงาน</h2>
        <p className="form-section-copy">สร้างบัญชีสำหรับเข้าสู่ระบบและเลือกเป็นผู้ให้บริการ</p>
      </div>
      <fieldset className="staff-form-fields stack" disabled={isPending}>
        <label className="label">
          ชื่อพนักงาน
          <input className="input" name="fullName" autoComplete="off" maxLength={120} placeholder="ชื่อที่แสดงในคิวและรายงานค่าคอม" required />
        </label>
        <label className="label">
          อีเมลเข้าสู่ระบบ
          <input className="input" name="email" type="email" autoComplete="off" maxLength={254} placeholder="staff@example.com" required />
        </label>
        <label className="label">
          รหัสผ่าน
          <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} aria-describedby="staff-password-hint" required />
          <span id="staff-password-hint" className="label-hint">อย่างน้อย 8 ตัวอักษร แจ้งอีเมลและรหัสผ่านนี้ให้พนักงานเพื่อเข้าสู่ระบบ</span>
        </label>
      </fieldset>
      <p className="form-section-copy">บัญชีใหม่มีสิทธิ์พนักงาน ใช้งานคิวและรับชำระเงินได้</p>
      {errorMessage ? <div className="state-note state-note-danger" role="alert">{errorMessage}</div> : null}
      <button className="btn btn-primary" type="submit" disabled={isPending}>
        {isPending ? "กำลังเพิ่มพนักงาน..." : "เพิ่มพนักงาน"}
      </button>
    </form>
  );
}
