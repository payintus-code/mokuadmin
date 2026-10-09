"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createStaffAccount, type CreateStaffResult } from "@/lib/staff-account";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createStaff(formData: FormData): Promise<CreateStaffResult> {
  await requireAdmin();

  const result = await createStaffAccount(createAdminClient(), {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? "")
  });

  if ("success" in result) {
    revalidatePath("/staff");
    revalidatePath("/bookings/new");
    revalidatePath("/bookings/[bookingId]", "page");
    revalidatePath("/payments/[bookingId]", "page");
    revalidatePath("/finance/report");
  }
  return result;
}
