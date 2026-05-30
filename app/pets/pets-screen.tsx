import { PawPrint } from "lucide-react";
import { deletePet } from "@/app/actions/pets";
import { DeleteButton } from "@/components/forms/delete-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function PetsScreen() {
  const currentUser = await requireAppUser();
  const supabase = await createClient();
  const { data: pets } = await supabase
    .from("pets")
    .select("id, name, species, breed, weight_kg, customers(full_name)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return (
    <main className="stack">
      <PageHeader title="ข้อมูลสัตว์เลี้ยง" subtitle="ดูข้อมูลสัตว์เลี้ยงทั้งหมด เรียงจากที่สร้างล่าสุด" actionLabel="สร้างสัตว์เลี้ยงใหม่" actionHref="/pets/new" />

      <section className="stack">
        {(pets ?? []).length ? (
          (pets ?? []).map((pet) => (
            <article key={pet.id} className="card list-card">
              <div className="list-card-top">
                <div>
                  <h2 className="list-card-title">{pet.name}</h2>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {pet.species}
                    {pet.breed ? ` | ${pet.breed}` : ""}
                  </div>
                </div>
                {currentUser.role === "admin" ? <DeleteButton action={deletePet.bind(null, pet.id)} label="ลบสัตว์เลี้ยง" /> : null}
              </div>

              <div className="meta-grid">
                <div className="meta-block">
                  <div className="meta-label">เจ้าของ</div>
                  <div className="meta-value">{(pet.customers as { full_name?: string } | null)?.full_name ?? "-"}</div>
                </div>
                <div className="meta-block">
                  <div className="meta-label">น้ำหนัก</div>
                  <div className="meta-value">{pet.weight_kg ?? "-"} kg</div>
                </div>
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            icon={<PawPrint size={24} strokeWidth={2.1} />}
            title="ยังไม่มีข้อมูลสัตว์เลี้ยง"
            description="เมื่อมีการเพิ่มสัตว์เลี้ยงใหม่ รายการจะปรากฏที่หน้านี้ทันที"
          />
        )}
      </section>
    </main>
  );
}
