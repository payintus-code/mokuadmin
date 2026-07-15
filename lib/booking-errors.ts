export function formatCreateBookingError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message ?? "Unable to create booking";
  const duplicatePrefix = "Duplicate booking already exists:";
  if (error?.code === "23505" && message.startsWith(duplicatePrefix)) {
    const bookingNo = message.slice(duplicatePrefix.length).trim();
    return bookingNo
      ? `คิวนี้มีอยู่แล้ว ไม่สามารถสร้างคิวซ้ำได้ (${bookingNo})`
      : "คิวนี้มีอยู่แล้ว ไม่สามารถสร้างคิวซ้ำได้";
  }
  return message;
}
