import { PetForm } from "@/components/forms/pet-form";
import { PageHeader } from "@/components/ui/page-header";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type NewPetPageProps = {
  searchParams?: Promise<{
    mode?: string;
    returnTo?: string;
  }>;
};

export default async function NewPetPage({ searchParams }: NewPetPageProps) {
  const params = (await searchParams) ?? {};
  const draftMode = params.mode === "draft";
  const returnTo = params.returnTo || "/customers/new";

  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader
          title="สร้างสัตว์เลี้ยงใหม่"
          subtitle="เพิ่มข้อมูลสัตว์เลี้ยงเพื่อใช้สร้างคิวต่อได้ทันที"
          actionLabel="ดูข้อมูลสัตว์เลี้ยง"
          actionHref="/pets"
        />
        <SetupNotice />
      </main>
    );
  }

  await requireAppUser();

  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, full_name, phone, facebook_name, note")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return (
    <main className="stack">
      <PageHeader
        title="สร้างสัตว์เลี้ยงใหม่"
        subtitle={
          draftMode
            ? "เพิ่มสัตว์เลี้ยงชั่วคราวแล้วพากลับไปที่ฟอร์มสร้างลูกค้าเดิมได้ทันที"
            : "เลือกลูกค้าล่าสุดได้ง่ายขึ้นก่อนบันทึกสัตว์เลี้ยง"
        }
        actionLabel="ดูข้อมูลสัตว์เลี้ยง"
        actionHref="/pets"
      />
      <PetForm customers={customers ?? []} draftMode={draftMode} returnTo={returnTo} />
    </main>
  );
}
