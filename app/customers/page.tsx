import { Search, Users } from "lucide-react";
import { deleteCustomer } from "@/app/actions/customers";
import { DeleteButton } from "@/components/forms/delete-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type CustomerWithPets = {
  id: string;
  full_name: string;
  phone: string;
  facebook_name: string | null;
  note: string | null;
  pets: Array<{ id: string; name: string; species: string; is_active: boolean }> | null;
};

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase();
}

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="ข้อมูลลูกค้า" subtitle="ดูข้อมูลลูกค้าและช่องทางติดต่อทั้งหมด" actionLabel="สร้างลูกค้าใหม่" actionHref="/customers/new" />
        <SetupNotice />
      </main>
    );
  }

  const currentUser = await requireAppUser();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const normalizedQuery = normalizeSearch(query);

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, full_name, phone, facebook_name, note, pets(id, name, species, is_active)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  const customers = ((data ?? []) as CustomerWithPets[]).filter((customer) => {
    if (!normalizedQuery) {
      return true;
    }

    const activePets = (customer.pets ?? []).filter((pet) => pet.is_active);

    return (
      customer.full_name.toLocaleLowerCase().includes(normalizedQuery) ||
      customer.phone.toLocaleLowerCase().includes(normalizedQuery) ||
      activePets.some((pet) => pet.name.toLocaleLowerCase().includes(normalizedQuery))
    );
  });

  return (
    <main className="stack">
      <PageHeader
        title="ข้อมูลลูกค้า"
        subtitle="ค้นหาจากชื่อลูกค้า ชื่อสัตว์เลี้ยง หรือเบอร์โทรได้จากจุดเดียว"
        actionLabel="สร้างลูกค้าใหม่"
        actionHref="/customers/new"
      />

      <form className="panel stack" method="get">
        <div className="section-kicker">
          <Search size={14} strokeWidth={2.2} />
          <span>Search</span>
        </div>
        <label className="label">
          ค้นหาลูกค้า สัตว์เลี้ยง หรือเบอร์โทร
          <input className="input" name="q" defaultValue={query} placeholder="พิมพ์ชื่อลูกค้า ชื่อสัตว์ หรือเบอร์โทร" />
          <p className="label-hint">ผลลัพธ์จะยังคงใช้ข้อมูลและ logic เดิม เพียงจัดให้อ่านง่ายขึ้น</p>
        </label>

        <div className="schedule-filter-actions">
          <button className="btn btn-primary" type="submit">
            ค้นหา
          </button>
          <a className="btn btn-secondary" href="/customers">
            ล้างคำค้น
          </a>
        </div>
      </form>

      <section className="stack">
        {customers.length ? (
          customers.map((customer) => {
            const activePets = (customer.pets ?? []).filter((pet) => pet.is_active);

            return (
              <article key={customer.id} className="card list-card">
                <div className="list-card-top">
                  <div>
                    <h2 className="list-card-title">{customer.full_name}</h2>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {customer.phone}
                    </div>
                  </div>
                  {currentUser.role === "admin" ? <DeleteButton action={deleteCustomer.bind(null, customer.id)} label="ลบลูกค้า" /> : null}
                </div>

                <div className="list-card-body">
                  {customer.facebook_name ? (
                    <div className="meta-block">
                      <div className="meta-label">Facebook</div>
                      <div className="meta-value">{customer.facebook_name}</div>
                    </div>
                  ) : null}

                  {activePets.length ? (
                    <div className="meta-block">
                      <div className="meta-label">สัตว์เลี้ยง</div>
                      <div className="meta-value">{activePets.map((pet) => `${pet.name} (${pet.species})`).join(", ")}</div>
                    </div>
                  ) : null}

                  {customer.note ? (
                    <div className="soft-note">
                      <strong>หมายเหตุ</strong>
                      <div style={{ marginTop: 6 }}>{customer.note}</div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <EmptyState
            icon={<Users size={24} strokeWidth={2.1} />}
            title="ไม่พบข้อมูลที่ค้นหา"
            description="ลองค้นหาด้วยชื่อลูกค้า ชื่อสัตว์เลี้ยง หรือเบอร์โทรคำอื่น"
            action={
              <a className="btn btn-secondary" href="/customers">
                กลับไปดูทั้งหมด
              </a>
            }
          />
        )}
      </section>
    </main>
  );
}
