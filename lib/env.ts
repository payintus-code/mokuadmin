function getPublicKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

function getSecretKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function hasSupabasePublicEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getPublicKey());
}

export function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && getPublicKey() && getSecretKey());
}

export function getMissingSupabasePublicEnv() {
  const missing: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!getPublicKey()) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return missing;
}

export function getMissingSupabaseEnv() {
  const missing = getMissingSupabasePublicEnv();

  if (!getSecretKey()) {
    missing.push("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export function getSupabasePublicKey() {
  const key = getPublicKey();

  if (!key) {
    throw new Error("Missing Supabase publishable key");
  }

  return key;
}

export function getSupabaseSecretKey() {
  const key = getSecretKey();

  if (!key) {
    throw new Error("Missing Supabase secret key");
  }

  return key;
}
