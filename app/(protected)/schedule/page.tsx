import { PageHeader } from "@/components/ui/page-header";
import { SetupNotice } from "@/components/ui/setup-notice";
import { ZoomableSchedule } from "@/components/ui/zoomable-schedule";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { buildZoomableScheduleViewModel } from "@/lib/zoomable-schedule";

type SearchParams = Promise<{ view?: string; date?: string }>;
export const dynamic = "force-dynamic";

export default async function SchedulePage({ searchParams }: { searchParams?: SearchParams }) {
  if (!hasSupabaseEnv()) return <main className="stack schedule-page"><PageHeader title="ตารางคิว" subtitle="ปฏิทินคิวแบบเดือน สัปดาห์ และวัน" actionLabel="สร้างคิวใหม่" actionHref="/bookings/new" /><SetupNotice /></main>;
  await requireAppUser();
  const params = (await searchParams) ?? {};
  const initialData = await buildZoomableScheduleViewModel(params);
  return <main className="schedule-zoom-page"><ZoomableSchedule initialData={initialData} /></main>;
}
