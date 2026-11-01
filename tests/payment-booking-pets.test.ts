import test from "node:test";
import assert from "node:assert/strict";
import { parsePaymentPetDrafts, resolvePaymentBookingPetIds, remapPaymentPetAllocation } from "../lib/payment-booking-pets.ts";
import { allocateGroomingIncome, validatePetGroomingAllocation, type PerPetGroomingAllocation } from "../lib/grooming-allocation.ts";

test("legacy bill name editing rejects combined, missing, duplicate and excessive pets", () => {
  assert.deepEqual(parsePaymentPetDrafts([{ id: null, name: " น้องโอ๊ะ ", species: "cat" }]), [{ id: null, name: "น้องโอ๊ะ", species: "cat" }]);
  for (const raw of [null, [], [{ id: null, name: "น้องโอ๊ะ/อุง", species: "cat" }], [{ id: null, name: "", species: "cat" }],
    [{ id: "foreign", name: "อุง", species: "bird" }], Array(3).fill({ id: null, name: "อุง", species: "cat" }),
    [{ id: null, name: "อุง", species: "cat" }, { id: null, name: "อุง", species: "cat" }]]) assert.throws(() => parsePaymentPetDrafts(raw));
});

test("bill editing reuses the owner's named pet and creates only the missing pet", async () => {
  const created: string[] = [];
  const available = [{ id: "oh", name: "น้องโอ๊ะ", species: "cat", is_active: true }];
  const drafts = parsePaymentPetDrafts([{ id: null, name: "น้องโอ๊ะ", species: "cat" }, { id: null, name: "อุง", species: "cat" }]);
  const ids = await resolvePaymentBookingPetIds(drafts, available, async (pet) => { created.push(pet.name); return "ung"; });
  assert.deepEqual(ids, ["oh", "ung"]);
  assert.deepEqual(created, ["อุง"]);
  assert.equal(available[0].name, "น้องโอ๊ะ");
});

test("foreign pet IDs, tampered selected names, ambiguous names and duplicate IDs cannot be assigned", async () => {
  const available = [{ id: "oh", name: "น้องโอ๊ะ", species: "cat" }];
  const create = async () => { assert.fail("No records should be created"); };
  await assert.rejects(() => resolvePaymentBookingPetIds([{ id: "foreign", name: "อื่น", species: "cat" }], available, create));
  await assert.rejects(() => resolvePaymentBookingPetIds([{ id: "oh", name: "เปลี่ยนชื่อ", species: "cat" }], available, create));
  await assert.rejects(() => resolvePaymentBookingPetIds([{ id: null, name: "น้องโอ๊ะ", species: "cat" }], [...available, { id: "other", name: "น้องโอ๊ะ", species: "cat" }], create));
  await assert.rejects(() => resolvePaymentBookingPetIds([{ id: "oh", name: "น้องโอ๊ะ", species: "cat" }, { id: null, name: "น้องโอ๊ะ", species: "cat" }], available, create));
});

test("replacing or reordering names preserves all existing prices and staff income", () => {
  const old: PerPetGroomingAllocation = { version: 2, pets: [
    { petId: "a", amount: 900, performedById: "staff1", secondaryPerformedById: null, allocation: null },
    { petId: "b", amount: 600, performedById: "staff2", secondaryPerformedById: null, allocation: null }
  ] };
  for (const nextIds of [["c", "d"], ["b", "a"], ["c", "a"], ["b", "c"]]) {
    const mapped = remapPaymentPetAllocation(old, ["a", "b"], nextIds)!;
    validatePetGroomingAllocation(mapped, nextIds, 1500);
    assert.deepEqual(allocateGroomingIncome(1500, mapped).sort((a, b) => a.staffId.localeCompare(b.staffId)), allocateGroomingIncome(1500, old));
  }
  assert.deepEqual(old.pets.map((pet) => pet.petId), ["a", "b"]);
  assert.throws(() => remapPaymentPetAllocation(old, ["a", "b"], ["a"]));
});

test("adding a name preserves existing bill allocation until prices are explicitly reassigned", () => {
  assert.equal(remapPaymentPetAllocation(null, ["combined"], ["oh", "ung"]), null);
  const old: PerPetGroomingAllocation = { version: 2, pets: [{ petId: "a", amount: 1000, performedById: "staff1", secondaryPerformedById: null, allocation: null }] };
  const next = remapPaymentPetAllocation(old, ["a"], ["a", "b"])!;
  validatePetGroomingAllocation(next, ["a", "b"], 1000);
  const totalFor = (value: typeof next) => allocateGroomingIncome(1000, value).reduce((sum, share) => sum + share.amount, 0);
  assert.equal(totalFor(next), 1000);
  assert.deepEqual(allocateGroomingIncome(1000, next), allocateGroomingIncome(1000, old));
});
