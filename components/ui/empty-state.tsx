import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="empty-state">
      {icon ? <div className="empty-state-icon">{icon}</div> : null}
      <div className="empty-state-content">
        <strong className="empty-state-title">{title}</strong>
        <p className="empty-state-description">{description}</p>
      </div>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </section>
  );
}
