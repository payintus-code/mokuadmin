const BUSINESS_TIME_ZONE = "Asia/Bangkok";

function formatBusinessDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatDateKey(date = new Date()) {
  return formatBusinessDate(date).replaceAll("-", "");
}

export function getReceiptNoBase(prefix: string, issuedAt: Date) {
  return `${prefix}${formatDateKey(issuedAt)}-`;
}

export function buildNextReceiptNo(prefix: string, issuedAt: Date, existingReceiptNos: Array<string | null | undefined>, offset = 0) {
  const base = getReceiptNoBase(prefix, issuedAt);
  const highestSequence = existingReceiptNos.reduce((highest, receiptNo) => {
    if (!receiptNo?.startsWith(base)) {
      return highest;
    }

    const sequenceText = receiptNo.slice(base.length);

    if (!/^\d+$/.test(sequenceText)) {
      return highest;
    }

    return Math.max(highest, Number(sequenceText));
  }, 0);

  return `${base}${String(highestSequence + 1 + offset).padStart(4, "0")}`;
}
