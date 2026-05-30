import { Hotel } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="ห้องพัก" subtitle="เช็กห้องและราคาพื้นฐานได้จากหน้านี้" />
        <SetupNotice />
      </main>
    );
  }

  await requireAppUser();

  const supabase = await createClient();
  const { data: rooms } = await supabase.from("rooms").select("id, code, name, room_type, max_pets, nightly_rate, note").eq("is_active", true).order("code");

  return (
    <main className="stack">
      <PageHeader title="ห้องพัก" subtitle="ดูห้องพักสัตว์เลี้ยงและความจุแบบสแกนง่ายสำหรับหน้าร้าน" />

      <section className="stack">
        {(rooms ?? []).length ? (
          (rooms ?? []).map((room) => (
            <article key={room.id} className="card list-card">
              <div className="list-card-top">
                <h2 className="list-card-title">{room.code}</h2>
                <span className="status-badge status-confirmed">{room.room_type}</span>
              </div>

              <div className="list-card-body">
                <div className="meta-block">
                  <div className="meta-label">ชื่อห้อง</div>
                  <div className="meta-value">{room.name}</div>
                </div>
                <div className="meta-grid">
                  <div className="meta-block">
                    <div className="meta-label">รองรับสูงสุด</div>
                    <div className="meta-value">{room.max_pets} ตัว</div>
                  </div>
                  <div className="meta-block">
                    <div className="meta-label">ราคา/คืน</div>
                    <div className="meta-value">{room.nightly_rate} บาท</div>
                  </div>
                </div>
                {room.note ? <div className="soft-note">{room.note}</div> : null}
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            icon={<Hotel size={24} strokeWidth={2.1} />}
            title="ยังไม่มีข้อมูลห้องพัก"
            description="เมื่อมีการตั้งค่าห้องพักในระบบ รายการจะมาแสดงที่หน้านี้"
          />
        )}
      </section>
    </main>
  );
}
