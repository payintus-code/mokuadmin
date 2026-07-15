import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { getMissingSupabasePublicEnv, getSupabasePublicKey } from "@/lib/env";
import { createTimedFetch } from "@/lib/supabase/timed-fetch";

export async function createClient(options?: { timeoutMs?: number }) {
  const missing = getMissingSupabasePublicEnv();

  if (missing.length > 0) {
    throw new Error(`Missing Supabase environment variables: ${missing.join(", ")}`);
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getSupabasePublicKey(),
    {
      global: {
        fetch: createTimedFetch(options?.timeoutMs)
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(items: { name: string; value: string; options: CookieOptions }[]) {
          items.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        }
      }
    }
  );
}
