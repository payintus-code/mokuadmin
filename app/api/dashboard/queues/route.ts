import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { getDailySchedule, getUnpaidBookings } from "@/lib/bookings";
import { formatDateInput } from "@/lib/format";

export const dynamic = "force-dynamic";
const groups = ["todayAll", "pending", "done", "unpaid"] as const;
type Group = (typeof groups)[number];

export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv()) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  if (!await getCurrentAppUser()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const group = request.nextUrl.searchParams.get("group") as Group | null;
  if (!group || !groups.includes(group)) return NextResponse.json({ error: "Invalid queue group" }, { status: 400 });
  const day = request.nextUrl.searchParams.get("day") || formatDateInput();
  if (group === "unpaid") return NextResponse.json({ items: await getUnpaidBookings() });
  const today = await getDailySchedule(day);
  const items = group === "todayAll" ? today : today.filter((item) => group === "done" ? item.status === "done" : ["pending", "confirmed", "in_progress"].includes(item.status));
  return NextResponse.json({ items });
}
