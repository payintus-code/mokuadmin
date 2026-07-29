import { redirect } from "next/navigation";

export default async function LegacyScheduleMonthPage({ searchParams }: { searchParams?: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const query = new URLSearchParams({ view: "month" });
  if (params?.date) query.set("date", params.date);
  redirect(`/schedule?${query.toString()}`);
}
