import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";

export function MobileActionSheet({
  label = "การทำงาน",
  children
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <details className="mobile-action-sheet">
      <summary className="mobile-action-trigger" aria-label={label}>
        <MoreHorizontal size={18} strokeWidth={2.3} />
        <span>{label}</span>
      </summary>
      <div className="mobile-action-panel">{children}</div>
    </details>
  );
}
