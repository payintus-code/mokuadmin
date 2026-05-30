export type ImportedServiceType = "grooming" | "hotel";

type ImportedBookingBase = {
  serviceType: ImportedServiceType;
  petName: string;
  customerName: string;
  phone: string;
  normalizedPhone: string;
  depositAmount: number | null;
  speciesHint: "cat" | "dog" | null;
};

export type ImportedGroomingBooking = ImportedBookingBase & {
  serviceType: "grooming";
  serviceText: string;
  appointmentDateTime: string;
};

export type ImportedHotelBooking = ImportedBookingBase & {
  serviceType: "hotel";
  stayNights: number | null;
  checkInDate: string;
  checkOutDate: string;
  additionalServiceText: string;
  totalAmount: number | null;
};

export type ImportedBookingChatData = ImportedGroomingBooking | ImportedHotelBooking;

export type ImportedBookingChatSuccess = {
  success: true;
  data: ImportedBookingChatData;
  warnings: string[];
};

export type ImportedBookingChatFailure = {
  success: false;
  error: string;
  warnings: string[];
  detectedServiceType: ImportedServiceType | null;
};

export type ImportedBookingChatResult = ImportedBookingChatSuccess | ImportedBookingChatFailure;

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readLabeledValue(source: string, labels: string[]) {
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegExp(label)}\\s*[:：]\\s*(.+)`, "i");
    const match = source.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function extractAmount(value: string) {
  const match = value.match(/(\d[\d,]*)\s*฿?/);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

export function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function parseOwnerAndPhone(value: string) {
  const phoneMatch = value.match(/(\+?\d[\d -]{7,}\d|\d{8,})/);
  const phone = phoneMatch ? phoneMatch[1].trim() : "";
  const customerName = value.replace(phone, "").trim().replace(/[\/\-–—]+$/g, "").trim();

  return {
    customerName,
    phone,
    normalizedPhone: normalizePhone(phone)
  };
}

function toGregorianYear(shortThaiYear: number) {
  return 2500 + shortThaiYear - 543;
}

function toIsoDate(day: number, month: number, year: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseThaiDate(value: string) {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? toGregorianYear(rawYear) : rawYear - 543;

  return toIsoDate(day, month, year);
}

function parseThaiDateTime(value: string) {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})/);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? toGregorianYear(rawYear) : rawYear - 543;
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  return `${toIsoDate(day, month, year)} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function detectServiceType(source: string): ImportedServiceType | null {
  if (/Moku Hotel|เข้าพัก|จำนวนคืน/i.test(source)) {
    return "hotel";
  }

  if (/ยืนยันการจอง|รายการ|วันเวลา/i.test(source)) {
    return "grooming";
  }

  return null;
}

function detectSpeciesHint(source: string): "cat" | "dog" | null {
  if (/ชื่อน้องแมว|แมว/i.test(source)) {
    return "cat";
  }

  if (/ชื่อน้องหมา|สุนัข|หมา/i.test(source)) {
    return "dog";
  }

  return null;
}

function buildMissingFieldError(fields: string[]) {
  return `ข้อมูลไม่ครบ: ${fields.join(", ")}`;
}

function parseGrooming(source: string): ImportedBookingChatResult {
  const petName = readLabeledValue(source, ["ชื่อน้อง", "ชื่อน้องแมว", "ชื่อน้องหมา"]);
  const ownerLine = readLabeledValue(source, ["ชื่อเจ้าของ/เบอร์", "ชื่อเจ้าของ / เบอร์"]);
  const serviceText = readLabeledValue(source, ["รายการ"]);
  const appointmentDateTime = parseThaiDateTime(readLabeledValue(source, ["วันเวลา"]));
  const depositAmount = extractAmount(source.match(/\(.*?โอนมัดจำ.*?\)/i)?.[0] ?? "");
  const ownerInfo = parseOwnerAndPhone(ownerLine);

  const missingFields = [
    !petName ? "petName" : "",
    !ownerInfo.customerName ? "customerName" : "",
    !ownerInfo.normalizedPhone ? "phone" : "",
    !serviceText ? "serviceText" : "",
    !appointmentDateTime ? "appointmentDateTime" : ""
  ].filter(Boolean);

  if (missingFields.length) {
    return {
      success: false,
      error: buildMissingFieldError(missingFields),
      warnings: [],
      detectedServiceType: "grooming"
    };
  }

  return {
    success: true,
    warnings: [],
    data: {
      serviceType: "grooming",
      petName,
      customerName: ownerInfo.customerName,
      phone: ownerInfo.phone,
      normalizedPhone: ownerInfo.normalizedPhone,
      serviceText,
      depositAmount,
      appointmentDateTime: appointmentDateTime!,
      speciesHint: detectSpeciesHint(source)
    }
  };
}

function parseHotel(source: string): ImportedBookingChatResult {
  const petName = readLabeledValue(source, ["ชื่อน้องแมว", "ชื่อน้องหมา", "ชื่อน้อง"]);
  const ownerLine = readLabeledValue(source, ["ชื่อเจ้าของ / เบอร์", "ชื่อเจ้าของ/เบอร์"]);
  const stayLine = readLabeledValue(source, ["เข้าพัก"]);
  const nightsLine = readLabeledValue(source, ["จำนวนคืน"]);
  const additionalServiceText = readLabeledValue(source, ["รายการเพิ่มเติม"]);
  const totalAmount = extractAmount(readLabeledValue(source, ["รวมยอด"]));
  const depositAmount = extractAmount(source.match(/\(.*?โอนมัดจำ.*?\)/i)?.[0] ?? "");
  const ownerInfo = parseOwnerAndPhone(ownerLine);

  const dateRangeLine = [stayLine, nightsLine].find((line) =>
    /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/.test(line)
  ) ?? "";
  const stayNightsLine = [nightsLine, stayLine].find((line) => /\d+/.test(line) && !line.includes("/")) ?? "";
  const rangeMatch = dateRangeLine.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  const checkInDate = rangeMatch ? parseThaiDate(rangeMatch[1]) : null;
  const checkOutDate = rangeMatch ? parseThaiDate(rangeMatch[2]) : null;
  const stayNightsMatch = stayNightsLine.match(/(\d+)/);
  const stayNights = stayNightsMatch ? Number(stayNightsMatch[1]) : null;

  const missingFields = [
    !petName ? "petName" : "",
    !ownerInfo.customerName ? "customerName" : "",
    !ownerInfo.normalizedPhone ? "phone" : "",
    !checkInDate ? "checkInDate" : "",
    !checkOutDate ? "checkOutDate" : ""
  ].filter(Boolean);

  if (missingFields.length) {
    return {
      success: false,
      error: buildMissingFieldError(missingFields),
      warnings: [],
      detectedServiceType: "hotel"
    };
  }

  return {
    success: true,
    warnings: [],
    data: {
      serviceType: "hotel",
      petName,
      customerName: ownerInfo.customerName,
      phone: ownerInfo.phone,
      normalizedPhone: ownerInfo.normalizedPhone,
      stayNights,
      checkInDate: checkInDate!,
      checkOutDate: checkOutDate!,
      additionalServiceText,
      totalAmount,
      depositAmount,
      speciesHint: detectSpeciesHint(source)
    }
  };
}

/**
 * Example input/output:
 * - "✅ ยืนยันการจอง ... วันเวลา : 24/5/69 17:00" -> grooming with appointmentDateTime "2026-05-24 17:00"
 * - "รายละเอียดการเข้าพัก Moku Hotel ... จำนวนคืน : 31/5/69 - 2/6/69" -> hotel with checkInDate "2026-05-31"
 */
export function parseImportedBookingChat(rawText: string): ImportedBookingChatResult {
  const source = normalizeLineEndings(rawText);

  if (!source) {
    return {
      success: false,
      error: "กรุณาวางข้อความก่อน import",
      warnings: [],
      detectedServiceType: null
    };
  }

  const serviceType = detectServiceType(source);

  if (!serviceType) {
    return {
      success: false,
      error: "ไม่สามารถระบุประเภทการจองจากข้อความนี้ได้",
      warnings: [],
      detectedServiceType: null
    };
  }

  return serviceType === "grooming" ? parseGrooming(source) : parseHotel(source);
}
