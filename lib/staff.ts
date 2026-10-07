import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffOption } from "@/types/database";

export async function getActiveStaffOptions(): Promise<StaffOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, full_name, role")
    .eq("is_active", true)
    .order("full_name");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as StaffOption[];
}
