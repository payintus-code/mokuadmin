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
  const roomList = rooms ?? [];
  const roomTypeCounts = roomList.reduce<Record<string, number>>((counts, room) => {
    counts[room.room_type] = (counts[room.room_type] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <main className="stack">
      <PageHeader title="ห้องพัก" subtitle="ดูห้องพักสัตว์เลี้ยงและความจุแบบสแกนง่ายสำหรับหน้าร้าน" />

      {roomList.length ? (
        <section className="panel stack">
          <div>
            <div className="section-kicker">Room status</div>
            <h2 className="section-title">สรุปห้อง active</h2>
          </div>
          <div className="room-stat-grid">
            <div className="soft-note">
              <strong>{roomList.length} ห้อง</strong>
              <div>ห้องที่เปิดใช้งานในระบบ</div>
            </div>
            {Object.entries(roomTypeCounts).map(([type, count]) => (
              <div key={type} className="soft-note">
                <strong>{type}</strong>
                <div>{count} ห้อง</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="stack">
        {roomList.length ? (
          roomList.map((room) => (
            <article key={room.id} className="card list-card room-card">
              <div className="room-card-head">
                <div>
                  <h2 className="list-card-title room-code">{room.code}</h2>
                  <div className="muted" style={{ marginTop: 4 }}>{room.name}</div>
                </div>
                <span className="status-badge status-confirmed">{room.room_type}</span>
              </div>

              <div className="list-card-body">
                <div className="room-stat-grid">
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
