import assert from "node:assert/strict";
import test from "node:test";
import { calculateStaffCommission, calculateStaffCommissionWithSharedIncome } from "../lib/commission.ts";

test("calculates progressive commission for each staff total", () => {
  const result = calculateStaffCommission(120_000);

  assert.equal(result.totalCommission, 7_600);
  assert.deepEqual(
    result.breakdown.map(({ tierAmount, commission }) => ({ tierAmount, commission })),
    [
      { tierAmount: 30_000, commission: 900 },
      { tierAmount: 30_000, commission: 1_500 },
      { tierAmount: 40_000, commission: 3_200 },
      { tierAmount: 20_000, commission: 2_000 }
    ]
  );
});

test("does not combine separate staff totals before applying tiers", () => {
  const firstStaff = calculateStaffCommission(20_000);
  const secondStaff = calculateStaffCommission(20_000);
  const incorrectlyCombined = calculateStaffCommission(40_000);

  assert.equal(firstStaff.totalCommission + secondStaff.totalCommission, 1_200);
  assert.equal(incorrectlyCombined.totalCommission, 1_400);
});

test("returns zero commission for no service income", () => {
  assert.equal(calculateStaffCommission(0).totalCommission, 0);
});

test("gives the full unassigned income to every active staff member without splitting it", () => {
  const firstStaff = calculateStaffCommissionWithSharedIncome(10_000, 20_000, true);
  const secondStaff = calculateStaffCommissionWithSharedIncome(5_000, 20_000, true);
  const inactiveStaff = calculateStaffCommissionWithSharedIncome(10_000, 20_000, false);

  assert.equal(firstStaff.serviceIncomeTotal, 30_000);
  assert.equal(secondStaff.serviceIncomeTotal, 25_000);
  assert.equal(inactiveStaff.serviceIncomeTotal, 10_000);
});
