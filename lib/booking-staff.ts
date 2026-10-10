export function validateBookingStaff(primaryId: string | null | undefined, secondaryId: string | null | undefined) {
  if (secondaryId && !primaryId) {
    throw new Error("กรุณาเลือกพนักงานคนที่ 1 ก่อนเลือกคนที่ 2");
  }
  if (primaryId && primaryId === secondaryId) {
    throw new Error("กรุณาเลือกพนักงานคนละคน");
  }
}

export function splitStaffIncome(amount: number, primaryId?: string | null, secondaryId?: string | null) {
  const staffIds = [...new Set([primaryId, secondaryId].filter((id): id is string => Boolean(id)))];
  // Keep fractional satang in the commission base so both staff receive exactly half.
  return staffIds.map((staffId) => ({ staffId, amount: amount / staffIds.length }));
}
