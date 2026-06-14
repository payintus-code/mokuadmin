"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function DashboardSchedulePrefetch() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/schedule");
  }, [router]);

  return null;
}
