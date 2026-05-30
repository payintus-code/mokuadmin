import test from "node:test";
import assert from "node:assert/strict";
import { parseImportedBookingChat } from "../lib/booking-chat-import.ts";

test("parses grooming booking text", () => {
  const result = parseImportedBookingChat(`✅ ยืนยันการจอง
ชื่อน้อง : น้องอุนจิ
ชื่อเจ้าของ/เบอร์ : คุณซิสตร้า 065-0170175
รายการ : อาบน้ำ ตัดขน สังกะตัง
(โอนมัดจำ 200฿)
วันเวลา : 24/5/69 17:00`);

  assert.equal(result.success, true);

  if (!result.success) {
    return;
  }

  assert.equal(result.data.serviceType, "grooming");
  assert.equal(result.data.petName, "น้องอุนจิ");
  assert.equal(result.data.customerName, "คุณซิสตร้า");
  assert.equal(result.data.phone, "065-0170175");
  assert.equal(result.data.normalizedPhone, "0650170175");
  assert.equal(result.data.depositAmount, 200);
  assert.equal(result.data.serviceText, "อาบน้ำ ตัดขน สังกะตัง");
  assert.equal(result.data.appointmentDateTime, "2026-05-24 17:00");
});

test("parses hotel booking text", () => {
  const result = parseImportedBookingChat(`รายละเอียดการเข้าพัก Moku Hotel

ชื่อน้องแมว : น้องบัดดี้
ชื่อเจ้าของ / เบอร์ : คุณอาภา  069-1656252
เข้าพัก : 2 คืน
จำนวนคืน : 31/5/69 - 2/6/69
รายการเพิ่มเติม : ทราย 1 กระบะ 50฿
รวมยอด : 450฿
(โอนมัดจำ 125฿)`);

  assert.equal(result.success, true);

  if (!result.success) {
    return;
  }

  assert.equal(result.data.serviceType, "hotel");
  assert.equal(result.data.petName, "น้องบัดดี้");
  assert.equal(result.data.customerName, "คุณอาภา");
  assert.equal(result.data.phone, "069-1656252");
  assert.equal(result.data.normalizedPhone, "0691656252");
  assert.equal(result.data.stayNights, 2);
  assert.equal(result.data.checkInDate, "2026-05-31");
  assert.equal(result.data.checkOutDate, "2026-06-02");
  assert.equal(result.data.additionalServiceText, "ทราย 1 กระบะ 50฿");
  assert.equal(result.data.totalAmount, 450);
  assert.equal(result.data.depositAmount, 125);
});

test("parses hotel booking text with stay date first and deposited already wording", () => {
  const result = parseImportedBookingChat(`รายละเอียดการเข้าพัก Moku Hotel

ชื่อน้องแมว : น้องมะอง
ชื่อเจ้าของ / เบอร์ : คุณโอปอ 087-895-1883
เข้าพัก : 29/5/69-2/6/69
จำนวนคืน : 4 คืน
รายการเพิ่มเติม : กล้อง
รวมยอด : 980฿

(โอนมัดจำแล้ว 490฿)`);

  assert.equal(result.success, true);

  if (!result.success) {
    return;
  }

  assert.equal(result.data.serviceType, "hotel");
  assert.equal(result.data.petName, "น้องมะอง");
  assert.equal(result.data.customerName, "คุณโอปอ");
  assert.equal(result.data.phone, "087-895-1883");
  assert.equal(result.data.normalizedPhone, "0878951883");
  assert.equal(result.data.checkInDate, "2026-05-29");
  assert.equal(result.data.checkOutDate, "2026-06-02");
  assert.equal(result.data.stayNights, 4);
  assert.equal(result.data.additionalServiceText, "กล้อง");
  assert.equal(result.data.totalAmount, 980);
  assert.equal(result.data.depositAmount, 490);
});

test("supports phone without hyphen", () => {
  const result = parseImportedBookingChat(`✅ ยืนยันการจอง
ชื่อน้อง : น้องโมจิ
ชื่อเจ้าของ/เบอร์ : คุณเมย์ 0811111111
รายการ : อาบน้ำ
วันเวลา : 1/6/69 09:30`);

  assert.equal(result.success, true);

  if (!result.success) {
    return;
  }

  assert.equal(result.data.normalizedPhone, "0811111111");
});

test("returns clear error when required fields are missing", () => {
  const result = parseImportedBookingChat(`✅ ยืนยันการจอง
ชื่อน้อง : น้องโมจิ
วันเวลา : 1/6/69 09:30`);

  assert.equal(result.success, false);

  if (result.success) {
    return;
  }

  assert.match(result.error, /customerName/);
  assert.match(result.error, /phone/);
  assert.match(result.error, /serviceText/);
});
