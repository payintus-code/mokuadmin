import assert from "node:assert/strict";
import test from "node:test";
import { canReceiveBookingPayment, partitionDashboardQueues } from "../lib/dashboard.ts";
import type { DailyScheduleItem } from "../types/database.ts";

const item = (status: DailyScheduleItem["status"], id: string): DailyScheduleItem => ({
  booking_id: id,
  booking_no: id,
  booking_type: "grooming",
  status,
  payment_status: "pending",
  start_at: "2026-07-15T09:00:00+07:00",
  end_at: "2026-07-15T10:00:00+07:00",
  customer_name: "Customer",
  pet_name: "Pet",
  room_name: null,
  services_summary: "Bath",
  total_amount: 100
});

test("keeps all statuses in todayAll and excludes cancelled from pending", () => {
    const queues = partitionDashboardQueues(
      [item("pending", "1"), item("confirmed", "2"), item("in_progress", "3"), item("done", "4"), item("cancelled", "5")],
      []
    );
    assert.equal(queues.todayAll.length, 5);
    assert.deepEqual(queues.todayPending.map((entry) => entry.booking_id), ["1", "2", "3"]);
    assert.deepEqual(queues.todayDone.map((entry) => entry.booking_id), ["4"]);
});

test("passes every unpaid booking through unchanged", () => {
    const unpaid = [item("done", "old"), item("pending", "future")];
    assert.deepEqual(partitionDashboardQueues([], unpaid).unpaid, unpaid);
});

test("allows receiving payment for every non-cancelled unpaid status", () => {
    for (const status of ["pending", "confirmed", "in_progress", "done"] as const) {
        assert.equal(canReceiveBookingPayment({ status, payment_status: "pending" }), true);
    }
});

test("does not allow receiving payment for paid or cancelled bookings", () => {
    assert.equal(canReceiveBookingPayment({ status: "pending", payment_status: "paid" }), false);
    assert.equal(canReceiveBookingPayment({ status: "cancelled", payment_status: "pending" }), false);
    assert.equal(canReceiveBookingPayment({ status: "cancelled", payment_status: "paid" }), false);
});
