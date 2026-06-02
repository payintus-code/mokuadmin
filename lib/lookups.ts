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

function mergeById<T extends { id: string }>(groups: Array<T[] | null | undefined>, limit: number) {
  const map = new Map<string, T>();

  for (const group of groups) {
    for (const item of group ?? []) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values()).slice(0, limit);
}

export async function lookupCustomers(query = "", limit?: number): Promise<Customer[]> {
  const supabase = await createClient();
  const boundedLimit = clampLimit(limit, DEFAULT_CUSTOMER_LIMIT);
  const normalizedQuery = normalizeLookupQuery(query);

  if (!normalizedQuery) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, full_name, phone, facebook_name, note")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(boundedLimit);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as Customer[];
  }

  const pattern = `%${normalizedQuery}%`;
  const [{ data: byName, error: nameError }, { data: byPhone, error: phoneError }, { data: byFacebook, error: facebookError }, { data: petMatches, error: petError }] =
    await Promise.all([
      supabase.from("customers").select("id, full_name, phone, facebook_name, note").eq("is_active", true).ilike("full_name", pattern).limit(boundedLimit),
      supabase.from("customers").select("id, full_name, phone, facebook_name, note").eq("is_active", true).ilike("phone", pattern).limit(boundedLimit),
      supabase.from("customers").select("id, full_name, phone, facebook_name, note").eq("is_active", true).ilike("facebook_name", pattern).limit(boundedLimit),
      supabase.from("pets").select("customer_id").eq("is_active", true).ilike("name", pattern).limit(boundedLimit)
    ]);

  if (nameError || phoneError || facebookError || petError) {
    throw new Error(nameError?.message ?? phoneError?.message ?? facebookError?.message ?? petError?.message ?? "Unable to search customers");
  }

  const petCustomerIds = Array.from(new Set((petMatches ?? []).map((pet) => pet.customer_id).filter(Boolean)));
  const { data: byPetName, error: byPetNameError } = petCustomerIds.length
    ? await supabase
        .from("customers")
        .select("id, full_name, phone, facebook_name, note")
        .eq("is_active", true)
        .in("id", petCustomerIds)
        .limit(boundedLimit)
    : { data: [], error: null };

  if (byPetNameError) {
    throw new Error(byPetNameError.message);
  }

  return mergeById<Customer>([byName, byPhone, byFacebook, byPetName], boundedLimit);
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

  if (!normalizedQuery) {
    const { data, error } = await supabase
      .from("pets")
      .select("id, customer_id, name, species, breed, weight_kg")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(boundedLimit);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as Pet[];
  }

  const pattern = `%${normalizedQuery}%`;
  const [{ data: byName, error: nameError }, { data: bySpecies, error: speciesError }, { data: byBreed, error: breedError }, { data: matchingCustomers, error: customerError }] =
    await Promise.all([
      supabase.from("pets").select("id, customer_id, name, species, breed, weight_kg").eq("is_active", true).ilike("name", pattern).limit(boundedLimit),
      supabase.from("pets").select("id, customer_id, name, species, breed, weight_kg").eq("is_active", true).ilike("species", pattern).limit(boundedLimit),
      supabase.from("pets").select("id, customer_id, name, species, breed, weight_kg").eq("is_active", true).ilike("breed", pattern).limit(boundedLimit),
      supabase.from("customers").select("id").eq("is_active", true).ilike("full_name", pattern).limit(boundedLimit)
    ]);

  if (nameError || speciesError || breedError || customerError) {
    throw new Error(nameError?.message ?? speciesError?.message ?? breedError?.message ?? customerError?.message ?? "Unable to search pets");
  }

  const customerIds = (matchingCustomers ?? []).map((customer) => customer.id);
  const { data: byOwner, error: byOwnerError } = customerIds.length
    ? await supabase
        .from("pets")
        .select("id, customer_id, name, species, breed, weight_kg")
        .eq("is_active", true)
        .in("customer_id", customerIds)
        .limit(boundedLimit)
    : { data: [], error: null };

  if (byOwnerError) {
    throw new Error(byOwnerError.message);
  }

  return mergeById<Pet>([byName, bySpecies, byBreed, byOwner], boundedLimit);
}
