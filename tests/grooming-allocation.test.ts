import assert from "node:assert/strict";
import test from "node:test";
import { allocateGroomingIncome, parseGroomingAllocation, GROOMING_PROFILES } from "../lib/grooming-allocation.ts";
import { calculateStaffCommission } from "../lib/commission.ts";

test("fixed profiles each total 100 percent", () => {
  for (const stages of Object.values(GROOMING_PROFILES)) {
    assert.equal(stages.reduce((sum, stage) => sum + stage.percent, 0), 100);
  }
});

test("bath only: solo preparation and bath, shared drying allocates 70/30", () => {
  const allocation = parseGroomingAllocation({ profile: "bath_only", stages: { prep: ["a"], bath: ["a"], dry: ["a", "b"] } }, ["a", "b"]);
  assert.deepEqual(allocateGroomingIncome(1000, allocation!), [{ staffId: "a", amount: 700 }, { staffId: "b", amount: 300 }]);
});

test("bath and haircut: shared preparation and drying, solo bath and haircut", () => {
  const allocation = parseGroomingAllocation({ profile: "bath_and_haircut", stages: { prep: ["a", "b"], bath: ["a"], dry: ["a", "b"], cut: ["b"] } });
  assert.deepEqual(allocateGroomingIncome(1000, allocation!), [{ staffId: "a", amount: 375 }, { staffId: "b", amount: 625 }]);
});

test("one worker gets the full amount and all shared stages split equally", () => {
  for (const profile of ["bath_only", "bath_and_haircut"] as const) {
    for (const ids of [["a"], ["a", "b"]]) {
      const allocation = { profile, stages: Object.fromEntries(GROOMING_PROFILES[profile].map((stage) => [stage.key, ids])) };
      const shares = allocateGroomingIncome(1000.01, allocation);
      for (const share of shares) assert.ok(Math.abs(share.amount - 1000.01 / ids.length) < 1e-9);
      assert.ok(Math.abs(shares.reduce((sum, share) => sum + share.amount, 0) - 1000.01) < 1e-9);
    }
  }
});

test("partial payments allocate proportionally without duplicating the service total", () => {
  const allocation = { profile: "bath_only" as const, stages: { prep: ["a"], bath: ["a"], dry: ["b"] } };
  const deposit = allocateGroomingIncome(200, allocation);
  const balance = allocateGroomingIncome(800, allocation);
  assert.equal(deposit[0].amount + balance[0].amount, 400);
  assert.equal(deposit[1].amount + balance[1].amount, 600);
});

test("commission tiers apply separately after stage allocation", () => {
  const shares = allocateGroomingIncome(100_000, {
    profile: "bath_only", stages: { prep: ["a"], bath: ["a"], dry: ["a", "b"] }
  });
  assert.deepEqual(shares.map((share) => calculateStaffCommission(share.amount).totalCommission), [3_200, 900]);
});

test("legacy null stays null and JSON round trips", () => {
  assert.equal(parseGroomingAllocation(null), null);
  assert.equal(parseGroomingAllocation("null"), null);
  const allocation = { profile: "bath_only", stages: { prep: ["a"], bath: ["a"], dry: ["b"] } };
  assert.deepEqual(parseGroomingAllocation(JSON.stringify(allocation), ["a", "b"]), allocation);
});

test("earlier profile names normalize to service types without changing allocations", () => {
  for (const [previous, current] of [["cat_bath", "bath_only"], ["dog_groom", "bath_and_haircut"]] as const) {
    const stages = Object.fromEntries(GROOMING_PROFILES[current].map((stage) => [stage.key, ["a", "b"]]));
    assert.deepEqual(parseGroomingAllocation({ profile: previous, stages }), { profile: current, stages });
  }
});

test("rejects missing stages, extra stages, duplicate workers, outsiders and invalid profiles", () => {
  for (const value of [
    { profile: "other", stages: {} },
    { profile: "bath_only", stages: { prep: ["a"], bath: ["a"] } },
    { profile: "bath_only", stages: { prep: ["a"], bath: ["a"], dry: [] } },
    { profile: "bath_only", stages: { prep: ["a", "a"], bath: ["a"], dry: ["b"] } },
    { profile: "bath_only", stages: { prep: ["a", "b", "c"], bath: ["a"], dry: ["b"] } },
    { profile: "bath_only", stages: { prep: ["c"], bath: ["a"], dry: ["b"] } },
    { profile: "bath_only", stages: { prep: ["a"], bath: ["a"], dry: ["b"], cut: ["b"] } },
    "{broken", [], 42
  ]) assert.throws(() => parseGroomingAllocation(value, ["a", "b"]));
});
