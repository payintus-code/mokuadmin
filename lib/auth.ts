import { redirect } from "next/navigation";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type AppUserContext = {
  id: string;
  email: string | null;
  fullName: string;
  role: UserRole;
};

type AppUserRow = {
  full_name: string;
  role: UserRole;
  is_active: boolean;
};

export const getCurrentAppUser = cache(async (): Promise<AppUserContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const admin = createAdminClient();
  const { data: appUser, error: appUserError } = await admin
    .from("app_users")
    .select("full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle<AppUserRow>();

  if (appUserError || !appUser || !appUser.is_active) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: appUser.full_name,
    role: appUser.role
  };
});

export async function requireAppUser(options?: { role?: UserRole }) {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login");
  }

  if (options?.role === "admin" && user.role !== "admin") {
    redirect("/forbidden");
  }

  return user;
}

export async function requireAdmin() {
  return requireAppUser({ role: "admin" });
}
