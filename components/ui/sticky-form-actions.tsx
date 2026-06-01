import type { ReactNode } from "react";

export function StickyFormActions({
  title,
  hint,
  children
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="sticky-form-actions">
      {title || hint ? (
        <div className="sticky-form-actions-copy">
          {title ? <strong>{title}</strong> : null}
          {hint ? <p>{hint}</p> : null}
        </div>
      ) : null}
      <div className="sticky-form-actions-buttons">{children}</div>
    </div>
  );
}
