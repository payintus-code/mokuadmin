import { BookingForm } from "@/components/forms/booking-form";
import { PageHeader } from "@/components/ui/page-header";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { lookupCustomers } from "@/lib/lookups";
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

  const [initialCustomers, { data: rooms }, { data: services }] = await Promise.all([
    lookupCustomers("", 25),
    supabase.from("rooms").select("id, code, name, room_type, nightly_rate, max_pets").eq("is_active", true).order("code"),
    supabase.from("services").select("id, name, category, duration_minutes, price").eq("is_active", true).order("name")
  ]);

  return (
    <main className="stack">
      <PageHeader title="สร้างการจอง" subtitle="ออกแบบให้สร้างคิวได้เร็วบนมือถือ" />
      <BookingForm
        initialCustomers={initialCustomers}
        rooms={rooms ?? []}
        services={services ?? []}
      />
    </main>
  );
}
