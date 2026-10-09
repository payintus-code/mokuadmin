import { StaffForm } from "@/components/forms/staff-form";
import { PageHeader } from "@/components/ui/page-header";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAdmin } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { getStaffList } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="พนักงาน" subtitle="เพิ่มบัญชีพนักงานและดูรายชื่อผู้ให้บริการ" />
        <SetupNotice />
      </main>
    );
  }

  await requireAdmin();
  const staff = await getStaffList();

  return (
    <main className="stack">
      <PageHeader title="พนักงาน" subtitle="เพิ่มบัญชีพนักงานและดูรายชื่อผู้ให้บริการ" />
      <div className="staff-management-layout">
        <StaffForm />
        <section className="staff-directory stack" aria-labelledby="staff-list-title">
          <div>
            <h2 id="staff-list-title" className="section-title">รายชื่อพนักงาน · {staff.length} คน</h2>
            <p className="form-section-copy">บัญชีที่เปิดใช้งานจะแสดงในช่องเลือกพนักงานของคิว</p>
          </div>
          {staff.length ? (
            <ul className="staff-directory-list">
              {staff.map((person) => (
                <li className="staff-directory-row" key={person.id}>
                  <div className="staff-directory-person">
                    <strong>{person.full_name}</strong>
                    <span className="muted">{person.role === "admin" ? "ผู้ดูแลระบบ" : "พนักงาน"}</span>
                  </div>
                  <span className={`status-badge ${person.is_active ? "status-confirmed" : "status-cancelled"}`}>
                    {person.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="muted">ยังไม่มีพนักงาน เพิ่มพนักงานคนแรกได้จากฟอร์มนี้</p>}
        </section>
      </div>
    </main>
  );
}
