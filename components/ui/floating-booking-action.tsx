"use client";

import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { PendingLink } from "@/components/ui/pending-link";

const visiblePaths = new Set(["/", "/schedule", "/customers", "/pets", "/rooms", "/finance", "/finance/report"]);

export function FloatingBookingAction() {
  const pathname = usePathname();

  if (!visiblePaths.has(pathname)) {
    return null;
  }

  return (
    <PendingLink className="floating-booking-action" href="/bookings/new" aria-label="สร้างคิวใหม่">
      <Plus size={22} strokeWidth={2.6} />
      <span>สร้างคิว</span>
    </PendingLink>
  );
}
