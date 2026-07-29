import Link from "next/link";
import { FinanceEntryForm } from "@/components/forms/finance-entry-form";
import { PageHeader } from "@/components/ui/page-header";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAdmin } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { formatDateInput } from "@/lib/format";
import { getActiveCustomers } from "@/lib/finance";

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="รายจ่ายทั่วไป" subtitle="กรอกรายจ่ายที่ไม่ผูกกับ booking ได้เร็ว" />
        <SetupNotice />
      </main>
    );
  }

  await requireAdmin();

  const customers = await getActiveCustomers();

  return (
    <main className="stack">
      <PageHeader title="รายจ่ายทั่วไป" subtitle="ใช้สำหรับค่าใช้จ่ายหน้าร้าน เช่น ของใช้ ค่าแรง ค่าน้ำยา ค่าอาหาร" />

      <section className="card stack">
        <Link className="btn btn-secondary" href="/finance">
          กลับหน้าการเงิน
        </Link>
      </section>

      <FinanceEntryForm
        customers={customers}
        today={formatDateInput()}
        initialType="expense"
        title="เพิ่มรายจ่ายทั่วไป"
        hideBookingField
      />
    </main>
  );
}
