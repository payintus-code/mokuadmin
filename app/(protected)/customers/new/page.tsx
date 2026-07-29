import { CustomerForm } from "@/components/forms/customer-form";
import { PageHeader } from "@/components/ui/page-header";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="สร้างลูกค้าใหม่" subtitle="เพิ่มข้อมูลลูกค้าใหม่สำหรับใช้สร้างคิวต่อทันที" actionLabel="ดูข้อมูลลูกค้า" actionHref="/customers" />
        <SetupNotice />
      </main>
    );
  }

  await requireAppUser();

  return (
    <main className="stack">
      <PageHeader title="สร้างลูกค้าใหม่" subtitle="เพิ่มข้อมูลลูกค้าใหม่สำหรับใช้สร้างคิวต่อทันที" actionLabel="ดูข้อมูลลูกค้า" actionHref="/customers" />
      <CustomerForm />
    </main>
  );
}
