import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { buildZoomableScheduleViewModel } from "@/lib/zoomable-schedule";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv()) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  if (!await getCurrentAppUser()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = request.nextUrl.searchParams;
  return NextResponse.json(await buildZoomableScheduleViewModel({ view: params.get("view") ?? undefined, date: params.get("date") ?? undefined }));
}
