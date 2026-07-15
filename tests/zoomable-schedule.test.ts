import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthCells, getScheduleRange, layoutTimedEvents, parseScheduleAnchor, parseScheduleZoomLevel, zoomScheduleLevel } from "../lib/zoomable-schedule-core.ts";
import type { DailyScheduleItem, ScheduleMonthSummaryItem } from "../types/database.ts";

test("parses schedule view and invalid date safely", () => {
  assert.equal(parseScheduleZoomLevel("week"), "week");
  assert.equal(parseScheduleZoomLevel("nope"), "month");
  assert.equal(parseScheduleAnchor("bad", new Date("2026-07-15T00:00:00Z")).toISOString().slice(0, 10), "2026-07-15");
});

test("zooms one semantic level per action", () => {
  assert.equal(zoomScheduleLevel("month", "in"), "week");
  assert.equal(zoomScheduleLevel("week", "in"), "day");
  assert.equal(zoomScheduleLevel("day", "out"), "week");
  assert.equal(zoomScheduleLevel("month", "out"), "month");
});

test("builds month, week and day ranges", () => {
  const date = new Date("2026-07-15T00:00:00Z");
  assert.equal(getScheduleRange("day", date).nextDate, "2026-07-16");
  assert.equal(getScheduleRange("week", date).nextDate, "2026-07-22");
  assert.equal(getScheduleRange("month", date).nextDate, "2026-08-15");
});

test("spreads a multi-day hotel booking across month cells", () => {
  const item: ScheduleMonthSummaryItem = { booking_id: "hotel", booking_type: "hotel", status: "confirmed", start_at: "2026-07-14T12:00:00Z", end_at: "2026-07-17T12:00:00Z" };
  const cells = buildMonthCells([item], new Date("2026-07-15T00:00:00Z"), new Date("2026-07-15T00:00:00Z"));
  assert.equal(cells.find((cell) => cell.date === "2026-07-15")?.hotelCount, 1);
  assert.equal(cells.find((cell) => cell.date === "2026-07-17")?.hotelCount, 1);
});

function event(id: string, start: string, end: string): DailyScheduleItem {
  return { booking_id: id, booking_no: id, booking_type: "grooming", status: "confirmed", payment_status: "pending", start_at: start, end_at: end, customer_name: "Customer", pet_name: "Pet", room_name: null, services_summary: "Bath", total_amount: 500 };
}

test("lays overlapping timed events in separate columns", () => {
  const layouts = layoutTimedEvents([event("a", "2026-07-15T09:00:00Z", "2026-07-15T10:00:00Z"), event("b", "2026-07-15T09:30:00Z", "2026-07-15T10:30:00Z")]);
  assert.equal(layouts[0].columns, 2);
  assert.notEqual(layouts[0].column, layouts[1].column);
});
