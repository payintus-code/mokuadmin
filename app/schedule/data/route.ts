import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { buildScheduleViewModel, type ScheduleSearchParamsInput } from "@/lib/schedule-view";

export const dynamic = "force-dynamic";

function readScheduleParams(request: NextRequest): ScheduleSearchParamsInput {
  const params = request.nextUrl.searchParams;

  return {
    month: params.get("month") ?? undefined,
    date: params.get("date") ?? undefined,
    grooming: params.get("grooming") ?? undefined,
    hotel: params.get("hotel") ?? undefined,
    filters: params.get("filters") ?? undefined,
    work: params.get("work") ?? undefined
  };
}

export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const currentUser = await getCurrentAppUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await buildScheduleViewModel(readScheduleParams(request));
  return NextResponse.json(data);
}
