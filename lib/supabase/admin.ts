import { createClient } from "@supabase/supabase-js";
import { getMissingSupabaseEnv, getSupabaseSecretKey } from "@/lib/env";

export function createAdminClient() {
  const missing = getMissingSupabaseEnv();

  if (missing.length > 0) {
    throw new Error(`Missing Supabase environment variables: ${missing.join(", ")}`);
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getSupabaseSecretKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
