import { AlertTriangle, Settings2 } from "lucide-react";
import { getMissingSupabaseEnv } from "@/lib/env";

export function SetupNotice() {
  const missing = getMissingSupabaseEnv();

  return (
    <section className="panel panel-muted stack">
      <div className="section-kicker">
        <AlertTriangle size={14} strokeWidth={2.2} />
        <span>Setup required</span>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <h2 className="section-title">Supabase ยังไม่ได้ตั้งค่า</h2>
        <p className="section-copy" style={{ margin: 0 }}>
          แอปเปิดได้ตามปกติ แต่ยังดึงข้อมูลจริงไม่ได้จนกว่าจะใส่ environment ที่จำเป็นครบ
        </p>
      </div>
      <div className="state-note state-note-warning">
        <strong>Missing variables</strong>
        <div style={{ marginTop: 6 }}>{missing.join(", ")}</div>
      </div>
      <div className="soft-note">
        <strong style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Settings2 size={14} strokeWidth={2.2} />
          <span>How to fix</span>
        </strong>
        <p className="section-copy" style={{ margin: "8px 0 0" }}>
          สร้าง <code>.env.local</code> จาก <code>.env.example</code> แล้วใส่ค่าจากโปรเจกต์ Supabase ของร้าน
        </p>
      </div>
    </section>
  );
}
