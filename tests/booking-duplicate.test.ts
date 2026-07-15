import assert from "node:assert/strict";
import test from "node:test";
import { formatCreateBookingError } from "../lib/booking-errors.ts";

test("formats duplicate booking errors with the existing booking number", () => {
  assert.equal(
    formatCreateBookingError({ code: "23505", message: "Duplicate booking already exists: BK20260716-0007" }),
    "คิวนี้มีอยู่แล้ว ไม่สามารถสร้างคิวซ้ำได้ (BK20260716-0007)"
  );
});

test("leaves unrelated booking errors unchanged", () => {
  assert.equal(formatCreateBookingError({ code: "23505", message: "bookings_booking_no_key" }), "bookings_booking_no_key");
});
