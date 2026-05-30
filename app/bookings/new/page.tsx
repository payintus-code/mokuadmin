import { BookingForm } from "@/components/forms/booking-form";
import { PageHeader } from "@/components/ui/page-header";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="สร้างการจอง" subtitle="ออกแบบให้สร้างคิวได้เร็วบนมือถือ" />
        <SetupNotice />
      </main>
    );
  }

  await requireAppUser();

  const supabase = await createClient();

  const [{ data: customers }, { data: pets }, { data: rooms }, { data: services }] = await Promise.all([
    supabase.from("customers").select("id, full_name, phone, facebook_name, note").eq("is_active", true).order("created_at", { ascending: false }),
    supabase.from("pets").select("id, customer_id, name, species, breed, weight_kg").eq("is_active", true).order("name"),
    supabase.from("rooms").select("id, code, name, room_type, nightly_rate, max_pets").eq("is_active", true).order("code"),
    supabase.from("services").select("id, name, category, duration_minutes, price").eq("is_active", true).order("name")
  ]);

  return (
    <main className="stack">
      <PageHeader title="สร้างการจอง" subtitle="ออกแบบให้สร้างคิวได้เร็วบนมือถือ" />
      <BookingForm
        customers={customers ?? []}
        pets={pets ?? []}
        rooms={rooms ?? []}
        services={services ?? []}
      />
    </main>
  );
}
