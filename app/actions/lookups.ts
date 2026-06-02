"use server";

import { requireAppUser } from "@/lib/auth";
import { lookupCustomerPets, lookupCustomers, lookupPets } from "@/lib/lookups";

export async function searchCustomers(query: string, limit?: number) {
  await requireAppUser();
  return lookupCustomers(query, limit);
}

export async function getCustomerPets(customerId: string) {
  await requireAppUser();
  return lookupCustomerPets(customerId);
}

export async function searchPets(query: string, limit?: number) {
  await requireAppUser();
  return lookupPets(query, limit);
}
