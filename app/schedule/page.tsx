import { PageHeader } from "@/components/ui/page-header";
import { ScheduleClient } from "@/components/ui/schedule-client";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";

type ScheduleSearchParams = Promise<{
  month?: string;
  date?: string;
  grooming?: string;
  hotel?: string;
  filters?: string;
  work?: string;
}>;

function buildQueryString(params: Awaited<ScheduleSearchParams>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      query.set(key, value);
    }
  }

  return query.toString();
}

export const dynamic = "force-dynamic";

export default async function SchedulePage({ searchParams }: { searchParams?: ScheduleSearchParams }) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="ตารางคิว" subtitle="ภาพรวมคิวรายเดือน พร้อมกดดูรายละเอียดแต่ละวัน" actionLabel="สร้างคิวใหม่" actionHref="/bookings/new" />
        <SetupNotice />
      </main>
    );
  }

  await requireAppUser();

  const params = (await searchParams) ?? {};

  return (
    <main className="stack schedule-page">
      <div className="schedule-mobile-hidden">
        <PageHeader title="ตารางคิว" subtitle="มุมมองรายเดือนสำหรับกดดูคิวแต่ละวันได้ง่ายทั้งบนคอมและมือถือ" actionLabel="สร้างคิวใหม่" actionHref="/bookings/new" />
      </div>
      <ScheduleClient queryString={buildQueryString(params)} />
    </main>
  );
}
