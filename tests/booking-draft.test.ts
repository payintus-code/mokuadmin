import test from "node:test";
import assert from "node:assert/strict";
import { validateHotelStayDates, validatePaymentDraft } from "../lib/booking-draft.ts";
import { evaluateGroomingDraftAvailability } from "../lib/grooming-draft.ts";

test("hotel stay requires checkout after checkin", () => {
  const result = validateHotelStayDates("2026-05-29T10:00", "2026-05-29T10:00");

  assert.equal(result.ok, false);
  assert.equal(result.blocking, true);
  assert.match(result.message, /เช็กเอาต์/);
});

test("deposit requires total amount and must be lower than total", () => {
  const missingTotal = validatePaymentDraft({
    showPaymentNow: true,
    paymentCollectionType: "deposit",
    totalAmount: 0,
    receivedAmount: 490
  });

  assert.equal(missingTotal.ok, false);
  assert.equal(missingTotal.blocking, true);
  assert.match(missingTotal.message, /ยอดรวม/);

  const tooHigh = validatePaymentDraft({
    showPaymentNow: true,
    paymentCollectionType: "deposit",
    totalAmount: 490,
    receivedAmount: 490
  });

  assert.equal(tooHigh.ok, false);
  assert.equal(tooHigh.blocking, true);
  assert.match(tooHigh.message, /มัดจำ/);
});

test("full payment must match total amount", () => {
  const result = validatePaymentDraft({
    showPaymentNow: true,
    paymentCollectionType: "full",
    totalAmount: 980,
    receivedAmount: 490
  });

  assert.equal(result.ok, false);
  assert.equal(result.blocking, true);
  assert.match(result.message, /เต็มจำนวน/);
});

test("grooming draft availability catches same pet conflict", () => {
  const result = evaluateGroomingDraftAvailability({
    petIds: ["pet-1"],
    overlappingBookings: [
      {
        booking_no: "BK001",
        pet_id: "pet-1",
        secondary_pet_id: null,
        pet_names: "น้องมะอง"
      }
    ],
    capacity: 3
  });

  assert.equal(result.ok, false);
  assert.equal(result.conflictBookingNo, "BK001");
  assert.match(result.message, /BK001/);
});

test("grooming draft availability catches capacity overflow even without same pet", () => {
  const result = evaluateGroomingDraftAvailability({
    petIds: [],
    overlappingBookings: [
      { booking_no: "BK001", pet_id: "pet-1", secondary_pet_id: null, pet_names: "A" },
      { booking_no: "BK002", pet_id: "pet-2", secondary_pet_id: null, pet_names: "B" },
      { booking_no: "BK003", pet_id: "pet-3", secondary_pet_id: null, pet_names: "C" }
    ],
    capacity: 3
  });

  assert.equal(result.ok, false);
  assert.equal(result.conflictBookingNo, null);
  assert.match(result.message, /3\/3/);
});
