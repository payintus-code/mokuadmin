import { PawPrint, Search } from "lucide-react";
import { deletePet } from "@/app/actions/pets";
import { DeleteButton } from "@/components/forms/delete-button";
import { EmptyState } from "@/components/ui/empty-state";
import { MobileActionSheet } from "@/components/ui/mobile-action-sheet";
import { PageHeader } from "@/components/ui/page-header";
import { requireAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_VISIBLE_PETS = 25;
const SEARCH_VISIBLE_PETS = 60;

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase();
}

export async function PetsScreen({ query = "" }: { query?: string }) {
  const currentUser = await requireAppUser();
  const supabase = await createClient();
  const { data: pets } = await supabase
    .from("pets")
    .select("id, name, species, breed, weight_kg, customers(full_name)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  const normalizedQuery = normalizeSearch(query);
  const filteredPets = (pets ?? []).filter((pet) => {
    if (!normalizedQuery) {
      return true;
    }

    const ownerName = (pet.customers as { full_name?: string } | null)?.full_name ?? "";
    return [pet.name, pet.species, pet.breed ?? "", ownerName].some((value) =>
      value.toLocaleLowerCase().includes(normalizedQuery)
    );
  });
  const visibleLimit = normalizedQuery ? SEARCH_VISIBLE_PETS : DEFAULT_VISIBLE_PETS;
  const visiblePets = filteredPets.slice(0, visibleLimit);
  const hiddenPetCount = Math.max(filteredPets.length - visiblePets.length, 0);

  return (
    <main className="stack">
      <PageHeader title="ข้อมูลสัตว์เลี้ยง" subtitle="ดูข้อมูลสัตว์เลี้ยงทั้งหมด เรียงจากที่สร้างล่าสุด" actionLabel="สร้างสัตว์เลี้ยงใหม่" actionHref="/pets/new" />

      <form className="panel stack sticky-search-panel" method="get">
        <div className="section-kicker">
          <Search size={14} strokeWidth={2.2} />
          <span>Search</span>
        </div>
        <label className="label">
          ค้นหาสัตว์เลี้ยง เจ้าของ ประเภท หรือสายพันธุ์
          <input className="input" name="q" defaultValue={query} placeholder="พิมพ์ชื่อสัตว์เลี้ยงหรือเจ้าของ" />
        </label>
        <div className="schedule-filter-actions">
          <button className="btn btn-primary" type="submit">
            ค้นหา
          </button>
          <a className="btn btn-secondary" href="/pets">
            ล้างคำค้น
          </a>
        </div>
      </form>

      <section className="stack">
        {filteredPets.length ? (
          <>
          {hiddenPetCount > 0 ? (
            <div className="soft-note list-limit-note">
              <strong>แสดง {visiblePets.length} จาก {filteredPets.length} รายการ</strong>
              <span>ใช้ช่องค้นหาเพื่อเจอสัตว์เลี้ยงหรือเจ้าของที่ต้องการได้เร็วขึ้น</span>
            </div>
          ) : null}

          {visiblePets.map((pet) => (
            <article key={pet.id} className="card list-card">
              <div className="list-card-top">
                <div>
                  <h2 className="list-card-title">{pet.name}</h2>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {pet.species}
                    {pet.breed ? ` | ${pet.breed}` : ""}
                  </div>
                </div>
                {currentUser.role === "admin" ? (
                  <MobileActionSheet label="จัดการ">
                    <DeleteButton
                      action={deletePet.bind(null, pet.id)}
                      label="ลบสัตว์เลี้ยง"
                      description={`ยืนยันลบข้อมูล ${pet.name} รายการนี้จะไม่แสดงในรายการใช้งาน`}
                      confirmLabel="ยืนยันลบสัตว์เลี้ยง"
                    />
                  </MobileActionSheet>
                ) : null}
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
          ))}
          </>
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
