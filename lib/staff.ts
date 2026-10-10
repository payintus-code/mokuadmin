import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffOption } from "@/types/database";
import { validateBookingStaff } from "@/lib/booking-staff";

export async function validateStaffAssignment(primaryId: string | null, secondaryId: string | null, existingIds: Array<string | null> = []) {
  validateBookingStaff(primaryId, secondaryId);
  const newIds = [primaryId, secondaryId].filter((id): id is string => Boolean(id) && !existingIds.includes(id));
  if (!newIds.length) return;
  const { data, error } = await createAdminClient().from("app_users").select("id").in("id", newIds).eq("is_active", true);
  if (error || data?.length !== newIds.length) {
    throw new Error("ไม่พบพนักงานผู้ให้บริการ หรือบัญชีถูกปิดใช้งานแล้ว");
  }
}

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
