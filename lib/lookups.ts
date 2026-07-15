import { createClient } from "@/lib/supabase/server";
import type { Customer, Pet } from "@/types/database";

const DEFAULT_CUSTOMER_LIMIT = 25;
const DEFAULT_PET_LIMIT = 25;
const MAX_LOOKUP_LIMIT = 80;

function clampLimit(limit: number | undefined, fallback: number) {
  if (!limit || Number.isNaN(limit)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(limit), 1), MAX_LOOKUP_LIMIT);
}

function normalizeLookupQuery(query: string) {
  return query.replace(/[%,()]/g, " ").trim();
}

export async function lookupCustomers(query = "", limit?: number): Promise<Customer[]> {
  const supabase = await createClient();
  const boundedLimit = clampLimit(limit, DEFAULT_CUSTOMER_LIMIT);
  const normalizedQuery = normalizeLookupQuery(query);
  const { data, error } = await supabase.rpc("search_customers", {
    p_query: normalizedQuery,
    p_limit: boundedLimit
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Customer[];
}

export async function lookupCustomerPets(customerId: string): Promise<Pet[]> {
  if (!customerId) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pets")
    .select("id, customer_id, name, species, breed, weight_kg")
    .eq("customer_id", customerId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Pet[];
}

export async function lookupPets(query = "", limit?: number): Promise<Pet[]> {
  const supabase = await createClient();
  const boundedLimit = clampLimit(limit, DEFAULT_PET_LIMIT);
  const normalizedQuery = normalizeLookupQuery(query);

  const { data, error } = await supabase.rpc("search_pets", {
    p_query: normalizedQuery,
    p_limit: boundedLimit
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Pet[];
}
