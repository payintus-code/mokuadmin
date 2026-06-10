import assert from "node:assert/strict";
import test from "node:test";
import { buildNextReceiptNo } from "../lib/receipt-numbers.ts";

test("receipt number uses the highest existing sequence for the business day", () => {
  const issuedAt = new Date("2026-06-10T03:30:00.000Z");

  assert.equal(
    buildNextReceiptNo("RC", issuedAt, ["RC20260610-0001", "RC20260610-0004", "RC20260610-0002", "RC20260609-0099", null]),
    "RC20260610-0005"
  );
});

test("receipt number retry offset advances past the next sequence", () => {
  const issuedAt = new Date("2026-06-10T03:30:00.000Z");

  assert.equal(buildNextReceiptNo("RC", issuedAt, ["RC20260610-0004"], 2), "RC20260610-0007");
});
