"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing_credentials");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    const authError = encodeURIComponent(error.code ?? error.name ?? "auth_error");
    const authMessage = encodeURIComponent(error.message ?? "Unable to sign in");
    redirect(`/login?error=invalid_credentials&auth_code=${authError}&auth_message=${authMessage}`);
  }

  redirect("/");
}
