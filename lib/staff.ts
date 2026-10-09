import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffOption } from "@/types/database";

export type StaffListItem = StaffOption & { is_active: boolean };

export async function getStaffList(): Promise<StaffListItem[]> {
  const { data, error } = await createAdminClient()
    .from("app_users")
    .select("id, full_name, role, is_active")
    .order("is_active", { ascending: false })
    .order("full_name");

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as StaffListItem[];
}

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
