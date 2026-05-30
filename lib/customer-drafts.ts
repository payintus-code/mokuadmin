export type CustomerDraftPet = {
  name: string;
  species: string;
  breed: string;
  weightKg: string;
  temperamentNote: string;
  allergyNote: string;
};

export type CustomerDraftValues = {
  fullName: string;
  phone: string;
  facebookName: string;
  note: string;
};

export const CUSTOMER_DRAFT_STORAGE_KEY = "customers:new:draft";
export const CUSTOMER_PETS_DRAFT_STORAGE_KEY = "customers:new:pets";

export const EMPTY_CUSTOMER_DRAFT: CustomerDraftValues = {
  fullName: "",
  phone: "",
  facebookName: "",
  note: ""
};

export function parseCustomerDraftPets(value: string): CustomerDraftPet[] {
  if (!value.trim()) {
    return [];
  }

  const parsed = JSON.parse(value);

  if (!Array.isArray(parsed)) {
    throw new Error("Pet draft payload is invalid");
  }

  return parsed.map((item) => {
    const pet = item as Partial<CustomerDraftPet>;

    return {
      name: String(pet.name ?? "").trim(),
      species: String(pet.species ?? "").trim(),
      breed: String(pet.breed ?? "").trim(),
      weightKg: String(pet.weightKg ?? "").trim(),
      temperamentNote: String(pet.temperamentNote ?? "").trim(),
      allergyNote: String(pet.allergyNote ?? "").trim()
    };
  });
}
