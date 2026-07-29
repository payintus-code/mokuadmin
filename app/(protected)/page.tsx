import { DashboardQueueAccordion } from "@/components/ui/dashboard-queue-accordion";
import { SetupNotice } from "@/components/ui/setup-notice";
import { getDashboardQueueCounts } from "@/lib/bookings";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { formatDateInput } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<{ open?: string | string[] }> }) {
  if (!hasSupabaseEnv()) return <main className="stack dashboard-page"><h1 className="dashboard-brand">Moku Pet Admin</h1><SetupNotice /></main>;
  await requireAppUser();
  const day = formatDateInput();
  const counts = await getDashboardQueueCounts(day);
  const params = await searchParams;
  const initialOpen = params?.open === "unpaid" ? "unpaid" : null;
  return <main className="stack dashboard-page">
    <h1 className="dashboard-brand">Moku Pet Admin</h1>
    <DashboardQueueAccordion counts={counts} day={day} initialOpen={initialOpen} />
  </main>;
}
