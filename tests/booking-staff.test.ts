import assert from "node:assert/strict";
import test from "node:test";
import { validateBookingStaff, splitStaffIncome } from "../lib/booking-staff.ts";
import { calculateStaffCommission } from "../lib/commission.ts";

test("one staff receives the full commission base", () => {
  assert.deepEqual(splitStaffIncome(1000, "a", null), [{ staffId: "a", amount: 1000 }]);
});

test("two staff share the received amount equally before commission tiers", () => {
  const shares = splitStaffIncome(1000, "a", "b");
  assert.deepEqual(shares, [{ staffId: "a", amount: 500 }, { staffId: "b", amount: 500 }]);
  assert.equal(shares.reduce((sum, share) => sum + share.amount, 0), 1000);
  for (const share of shares) assert.equal(calculateStaffCommission(share.amount).totalCommission, 15);
});

test("fractional amounts split exactly without doubling or losing income", () => {
  const shares = splitStaffIncome(1000.01, "a", "b");
  assert.equal(shares[0].amount, shares[1].amount);
  assert.equal(shares.reduce((sum, share) => sum + share.amount, 0), 1000.01);
});

test("unassigned income stays unassigned and deleted first staff leaves second eligible", () => {
  assert.deepEqual(splitStaffIncome(1000), []);
  assert.deepEqual(splitStaffIncome(1000, null, "b"), [{ staffId: "b", amount: 1000 }]);
});

test("duplicate staff cannot be saved and legacy duplicates cannot double income", () => {
  assert.throws(() => validateBookingStaff("a", "a"));
  assert.deepEqual(splitStaffIncome(1000, "a", "a"), [{ staffId: "a", amount: 1000 }]);
});

test("second staff requires first; single staff and unassigned are valid", () => {
  assert.throws(() => validateBookingStaff(null, "b"));
  assert.doesNotThrow(() => validateBookingStaff("a", "b"));
  assert.doesNotThrow(() => validateBookingStaff("a", null));
  assert.doesNotThrow(() => validateBookingStaff(null, null));
});
