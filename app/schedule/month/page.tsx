import { PageHeader } from "@/components/ui/page-header";
import { ScheduleClient } from "@/components/ui/schedule-client";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { buildScheduleViewModel } from "@/lib/schedule-view";

type ScheduleMonthSearchParams = Promise<{
  month?: string;
  date?: string;
  grooming?: string;
  hotel?: string;
  filters?: string;
  work?: string;
}>;

function buildQueryString(params: Awaited<ScheduleMonthSearchParams>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      query.set(key, value);
    }
  }

  return query.toString();
}

function appendQuery(pathname: string, queryString: string) {
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export const dynamic = "force-dynamic";

export default async function ScheduleMonthPage({ searchParams }: { searchParams?: ScheduleMonthSearchParams }) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack schedule-page schedule-month-page">
        <PageHeader
          title="ปฏิทินคิวรายเดือน"
          subtitle="มุมมองคิวแบบเต็มเดือนสำหรับมือถือ"
          actionLabel="รายการรายวัน"
          actionHref="/schedule"
        />
        <SetupNotice />
      </main>
    );
  }

  await requireAppUser();

  const params = (await searchParams) ?? {};
  const queryString = buildQueryString(params);
  const initialData = await buildScheduleViewModel(params, { includeCalendarItems: true });

  return (
    <main className="stack schedule-page schedule-month-page">
      <PageHeader
        title="ปฏิทินคิวรายเดือน"
        subtitle="เห็นคิวทั้งเดือนพร้อมชื่อแมว เวลา และบริการ"
        actionLabel="รายการรายวัน"
        actionHref={appendQuery("/schedule", queryString)}
      />
      <ScheduleClient key={queryString} queryString={queryString} initialData={initialData} calendarVariant="queue" />
    </main>
  );
}
