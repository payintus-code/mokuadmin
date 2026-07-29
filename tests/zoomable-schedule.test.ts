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

test("counts a multi-day hotel booking only on check-in and check-out dates", () => {
  const item: ScheduleMonthSummaryItem = { booking_id: "hotel", booking_type: "hotel", status: "confirmed", start_at: "2026-07-14T12:00:00Z", end_at: "2026-07-17T12:00:00Z" };
  const cells = buildMonthCells([item], new Date("2026-07-15T00:00:00Z"), new Date("2026-07-15T00:00:00Z"));
  assert.equal(cells.find((cell) => cell.date === "2026-07-14")?.hotelCheckInCount, 1);
  assert.equal(cells.find((cell) => cell.date === "2026-07-14")?.hotelCount, 1);
  assert.equal(cells.find((cell) => cell.date === "2026-07-15")?.hotelCount, 0);
  assert.equal(cells.find((cell) => cell.date === "2026-07-16")?.hotelCount, 0);
  assert.equal(cells.find((cell) => cell.date === "2026-07-17")?.hotelCheckOutCount, 1);
  assert.equal(cells.find((cell) => cell.date === "2026-07-17")?.hotelCount, 1);
});

test("counts same-day hotel check-in and check-out as separate schedule events", () => {
  const item: ScheduleMonthSummaryItem = { booking_id: "hotel", booking_type: "hotel", status: "confirmed", start_at: "2026-07-14T10:00:00Z", end_at: "2026-07-14T18:00:00Z" };
  const cell = buildMonthCells([item], new Date("2026-07-14T00:00:00Z"), new Date("2026-07-14T00:00:00Z")).find((entry) => entry.date === "2026-07-14");
  assert.equal(cell?.totalCount, 2);
  assert.equal(cell?.hotelCount, 2);
  assert.equal(cell?.hotelCheckInCount, 1);
  assert.equal(cell?.hotelCheckOutCount, 1);
});

function groomingEvent(id: string, start: string, end: string): DailyScheduleItem {
  return { booking_id: id, booking_no: id, booking_type: "grooming", status: "confirmed", payment_status: "pending", start_at: start, end_at: end, customer_name: "Customer", pet_name: "Pet", room_name: null, services_summary: "Bath", total_amount: 500 };
}

function hotelEvent(id: string, start: string, end: string): DailyScheduleItem {
  return { booking_id: id, booking_no: id, booking_type: "hotel", status: "confirmed", payment_status: "pending", start_at: start, end_at: end, customer_name: "Customer", pet_name: "Pet", room_name: "Room 1", services_summary: "", total_amount: 900 };
}

test("creates hotel check-in and check-out events without middle-day events", () => {
  const layouts = layoutTimedEvents(
    [hotelEvent("hotel", "2026-07-14T14:00:00Z", "2026-07-17T12:00:00Z")],
    ["2026-07-14", "2026-07-15", "2026-07-16", "2026-07-17"]
  );
  assert.deepEqual(layouts.map((event) => [event.eventKind, event.dayKey, event.startMinute]), [
    ["hotel-check-in", "2026-07-14", 14 * 60],
    ["hotel-check-out", "2026-07-17", 12 * 60]
  ]);
});

test("keeps only the hotel endpoint visible in the selected range", () => {
  const layouts = layoutTimedEvents(
    [hotelEvent("hotel", "2026-07-14T14:00:00Z", "2026-07-17T12:00:00Z")],
    ["2026-07-16", "2026-07-17"]
  );
  assert.equal(layouts.length, 1);
  assert.equal(layouts[0].eventKind, "hotel-check-out");
  assert.equal(layouts[0].dayKey, "2026-07-17");
});

test("places a midnight hotel check-out at the start of the check-out day", () => {
  const layouts = layoutTimedEvents(
    [hotelEvent("hotel", "2026-07-14T14:00:00Z", "2026-07-17T00:00:00Z")],
    ["2026-07-17"]
  );
  assert.equal(layouts.length, 1);
  assert.equal(layouts[0].eventKind, "hotel-check-out");
  assert.equal(layouts[0].startMinute, 0);
});

test("lays hotel endpoints and grooming events in separate columns when their times overlap", () => {
  const layouts = layoutTimedEvents(
    [
      groomingEvent("grooming", "2026-07-15T14:00:00Z", "2026-07-15T15:00:00Z"),
      hotelEvent("hotel", "2026-07-15T14:00:00Z", "2026-07-17T12:00:00Z")
    ],
    ["2026-07-15"]
  );
  assert.equal(layouts.length, 2);
  assert.equal(layouts[0].columns, 2);
  assert.equal(layouts[1].columns, 2);
  assert.notEqual(layouts[0].column, layouts[1].column);
});

test("lays overlapping timed events in separate columns", () => {
  const layouts = layoutTimedEvents([groomingEvent("a", "2026-07-15T09:00:00Z", "2026-07-15T10:00:00Z"), groomingEvent("b", "2026-07-15T09:30:00Z", "2026-07-15T10:30:00Z")]);
  assert.equal(layouts[0].columns, 2);
  assert.notEqual(layouts[0].column, layouts[1].column);
});
