import assert from "node:assert/strict";
import test from "node:test";
import { getBookingDurationMinutes, validateBookingAmountEdit } from "../lib/booking-edit.ts";

test("allows an unpaid booking total to change", () => {
  assert.equal(
    validateBookingAmountEdit({
      currentTotalAmount: 500,
      nextTotalAmount: 650,
      paidAmount: 0,
      paymentStatus: "pending"
    }).ok,
    true
  );
});

test("allows a partially paid booking total when it is not below the received amount", () => {
  assert.equal(
    validateBookingAmountEdit({
      currentTotalAmount: 500,
      nextTotalAmount: 300,
      paidAmount: 300,
      paymentStatus: "pending"
    }).ok,
    true
  );
});

test("rejects a total below the received amount", () => {
  const result = validateBookingAmountEdit({
    currentTotalAmount: 500,
    nextTotalAmount: 299,
    paidAmount: 300,
    paymentStatus: "pending"
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /300/);
});

test("locks the total after full payment and receipt issuance", () => {
  const result = validateBookingAmountEdit({
    currentTotalAmount: 500,
    nextTotalAmount: 600,
    paidAmount: 500,
    paymentStatus: "paid",
    receiptNo: "RC-001"
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /ใบเสร็จ/);
});

test("rejects negative and fractional baht totals", () => {
  assert.equal(
    validateBookingAmountEdit({
      currentTotalAmount: 500,
      nextTotalAmount: -1,
      paidAmount: 0
    }).ok,
    false
  );
  assert.equal(
    validateBookingAmountEdit({
      currentTotalAmount: 500,
      nextTotalAmount: 500.5,
      paidAmount: 0
    }).ok,
    false
  );
});

test("calculates booking duration and rejects invalid ranges", () => {
  assert.equal(
    getBookingDurationMinutes("2026-07-29T10:00:00.000Z", "2026-07-29T11:30:00.000Z"),
    90
  );
  assert.equal(
    getBookingDurationMinutes("2026-07-29T11:30:00.000Z", "2026-07-29T10:00:00.000Z"),
    null
  );
});
