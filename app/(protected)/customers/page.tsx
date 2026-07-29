import { Search, Users } from "lucide-react";
import { deleteCustomer } from "@/app/actions/customers";
import { DeleteButton } from "@/components/forms/delete-button";
import { EmptyState } from "@/components/ui/empty-state";
import { MobileActionSheet } from "@/components/ui/mobile-action-sheet";
import { PageHeader } from "@/components/ui/page-header";
import { PendingLink } from "@/components/ui/pending-link";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { lookupCustomers } from "@/lib/lookups";
import { createClient } from "@/lib/supabase/server";

type CustomerWithPets = {
  id: string;
  full_name: string;
  phone: string;
  facebook_name: string | null;
  note: string | null;
  pets: Array<{ id: string; name: string; species: string; is_active: boolean }> | null;
};

export const dynamic = "force-dynamic";

const DEFAULT_VISIBLE_CUSTOMERS = 25;
const SEARCH_VISIBLE_CUSTOMERS = 50;

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
  const visibleLimit = query ? SEARCH_VISIBLE_CUSTOMERS : DEFAULT_VISIBLE_CUSTOMERS;
  const fetchedCustomers = await lookupCustomers(query, visibleLimit + 1);
  const visibleCustomers = fetchedCustomers.slice(0, visibleLimit);
  const hasMoreCustomers = fetchedCustomers.length > visibleCustomers.length;
  const visibleCustomerIds = visibleCustomers.map((customer) => customer.id);

  const supabase = await createClient();
  const { data: activePets } = visibleCustomerIds.length
    ? await supabase
        .from("pets")
        .select("id, customer_id, name, species, is_active")
        .in("customer_id", visibleCustomerIds)
        .eq("is_active", true)
        .order("name")
    : { data: [] };
  const petsByCustomerId = new Map<string, NonNullable<CustomerWithPets["pets"]>>();

  for (const pet of activePets ?? []) {
    const pets = petsByCustomerId.get(pet.customer_id) ?? [];
    pets.push(pet);
    petsByCustomerId.set(pet.customer_id, pets);
  }

  const customers: CustomerWithPets[] = visibleCustomers.map((customer) => ({
    ...customer,
    pets: petsByCustomerId.get(customer.id) ?? []
  }));

  return (
    <main className="stack">
      <PageHeader
        title="ข้อมูลลูกค้า"
        subtitle="ค้นหาจากชื่อลูกค้า ชื่อสัตว์เลี้ยง หรือเบอร์โทรได้จากจุดเดียว"
        actionLabel="สร้างลูกค้าใหม่"
        actionHref="/customers/new"
      />

      <form className="panel stack sticky-search-panel" method="get">
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
          <PendingLink className="btn btn-secondary" href="/customers">
            ล้างคำค้น
          </PendingLink>
        </div>
      </form>

      <section className="stack">
        {customers.length ? (
          <>
          {hasMoreCustomers ? (
            <div className="soft-note list-limit-note">
              <strong>แสดง {visibleCustomers.length} รายการแรก</strong>
              <span>พิมพ์ชื่อ เบอร์โทร หรือชื่อสัตว์เลี้ยงเพื่อค้นหาให้แคบลงก่อนแก้ไขข้อมูล</span>
            </div>
          ) : null}

          {customers.map((customer) => {
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
                  {currentUser.role === "admin" ? (
                    <MobileActionSheet label="จัดการ">
                      <DeleteButton
                        action={deleteCustomer.bind(null, customer.id)}
                        label="ลบลูกค้า"
                        description={`ยืนยันลบลูกค้า ${customer.full_name} รายการนี้จะไม่แสดงในรายการใช้งาน`}
                        confirmLabel="ยืนยันลบลูกค้า"
                      />
                    </MobileActionSheet>
                  ) : null}
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
                <PendingLink className="tap-row-link" href={`/customers/${customer.id}`}>
                  <span>ดูประวัติลูกค้า</span>
                  <span aria-hidden="true">›</span>
                </PendingLink>
              </article>
            );
          })}
          </>
        ) : (
          <EmptyState
            icon={<Users size={24} strokeWidth={2.1} />}
            title="ไม่พบข้อมูลที่ค้นหา"
            description="ลองค้นหาด้วยชื่อลูกค้า ชื่อสัตว์เลี้ยง หรือเบอร์โทรคำอื่น"
            action={
              <PendingLink className="btn btn-secondary" href="/customers">
                กลับไปดูทั้งหมด
              </PendingLink>
            }
          />
        )}
      </section>
    </main>
  );
}
