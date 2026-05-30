export type GroomingDraftAvailability = {
  ok: boolean;
  level: "success" | "error";
  message: string;
  activeCount: number;
  capacity: number;
  conflictBookingNo: string | null;
};

export type GroomingOverlapRow = {
  booking_no: string;
  pet_id: string;
  secondary_pet_id: string | null;
  pet_names: string;
};

export function evaluateGroomingDraftAvailability(input: {
  petIds: string[];
  overlappingBookings: GroomingOverlapRow[];
  capacity: number;
}): GroomingDraftAvailability {
  const samePetConflict = input.overlappingBookings.find((booking) =>
    input.petIds.some((petId) => booking.pet_id === petId || booking.secondary_pet_id === petId)
  );

  if (samePetConflict) {
    return {
      ok: false,
      level: "error",
      message: `สัตว์เลี้ยงตัวนี้มีคิวซ้อนกับ ${samePetConflict.booking_no} (${samePetConflict.pet_names})`,
      activeCount: input.overlappingBookings.length,
      capacity: input.capacity,
      conflictBookingNo: samePetConflict.booking_no
    };
  }

  if (input.overlappingBookings.length >= input.capacity) {
    return {
      ok: false,
      level: "error",
      message: `ช่วงเวลานี้มีคิว grooming active อยู่แล้ว ${input.overlappingBookings.length}/${input.capacity} คิว`,
      activeCount: input.overlappingBookings.length,
      capacity: input.capacity,
      conflictBookingNo: null
    };
  }

  return {
    ok: true,
    level: "success",
    message: `ช่วงเวลานี้ยังรับคิวได้ (${input.overlappingBookings.length}/${input.capacity} คิว)`,
    activeCount: input.overlappingBookings.length,
    capacity: input.capacity,
    conflictBookingNo: null
  };
}
