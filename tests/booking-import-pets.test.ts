import test from "node:test";
import assert from "node:assert/strict";
import { resolveNamedBookingPets, remapDraftGroomingPets, DRAFT_PET_IDS } from "../lib/booking-import-pets.ts";
import { validatePetGroomingAllocation, type PerPetGroomingAllocation } from "../lib/grooming-allocation.ts";

test("reuses the existing first pet and creates only the missing second pet", async () => {
  const created: string[] = [];
  const updated: string[] = [];
  const ids = await resolveNamedBookingPets([{ name: "น้องโอ๊ะ", species: "cat" }, { name: "อุง", species: "cat" }], {
    async find(name) { return name === "น้องโอ๊ะ" ? "existing-oh" : null; },
    async create(pet) { created.push(pet.name); return "new-ung"; },
    async update(id) { updated.push(id); }
  });
  assert.deepEqual(ids, ["existing-oh", "new-ung"]);
  assert.deepEqual(created, ["อุง"]);
  assert.deepEqual(updated, ["existing-oh"]);
});

test("two existing pets never create a combined-name record", async () => {
  const ids = await resolveNamedBookingPets([{ name: "น้องโอ๊ะ", species: "cat" }, { name: "อุง", species: "cat" }], {
    async find(name) { return name === "น้องโอ๊ะ" ? "oh" : "ung"; },
    async create() { assert.fail("Must reuse existing pets"); },
    async update() {}
  });
  assert.deepEqual(ids, ["oh", "ung"]);
});

test("invalid combined or duplicate names fail before touching pet records", async () => {
  for (const names of [["น้องโอ๊ะ/อุง"], ["น้องโอ๊ะ", "น้องโอ๊ะ"], ["น้องโอ๊ะ", "อุง", "โมจิ"]]) {
    await assert.rejects(() => resolveNamedBookingPets(names.map((name) => ({ name, species: "cat" })), {
      async find() { assert.fail("Validation must run first"); },
      async create() { assert.fail("Validation must run first"); }, async update() { assert.fail("Validation must run first"); }
    }));
  }
});

test("new pet IDs keep the correct per-pet price and worker assignment", () => {
  const allocation: PerPetGroomingAllocation = { version: 2, pets: [
    { petId: DRAFT_PET_IDS[0], amount: 700, performedById: "a", secondaryPerformedById: null, allocation: null },
    { petId: DRAFT_PET_IDS[1], amount: 500, performedById: "b", secondaryPerformedById: null, allocation: null }
  ] };
  const mapped = remapDraftGroomingPets(allocation, ["real-oh", "real-ung"]) as PerPetGroomingAllocation;
  assert.deepEqual(mapped.pets.map((pet) => [pet.petId, pet.amount, pet.performedById]), [["real-oh", 700, "a"], ["real-ung", 500, "b"]]);
  assert.doesNotThrow(() => validatePetGroomingAllocation(mapped, ["real-oh", "real-ung"], 1200));
  assert.equal(allocation.pets[0].petId, DRAFT_PET_IDS[0]);
  assert.throws(() => remapDraftGroomingPets(allocation, ["real-oh"]));
  assert.equal(remapDraftGroomingPets(null, []), null);
});
