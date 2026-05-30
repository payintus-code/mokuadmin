import { PageHeader } from "@/components/ui/page-header";
import { SetupNotice } from "@/components/ui/setup-notice";
import { PetsScreen } from "@/app/pets/pets-screen";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function PetsPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="ข้อมูลสัตว์เลี้ยง" subtitle="ดูข้อมูลสัตว์เลี้ยงทั้งหมดในหน้าจอเดียว" actionLabel="สร้างสัตว์เลี้ยงใหม่" actionHref="/pets/new" />
        <SetupNotice />
      </main>
    );
  }

  await requireAppUser();

  return <PetsScreen />;
}
