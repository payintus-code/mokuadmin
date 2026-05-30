import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  tone = "default",
  detail,
  icon
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <article className={`metric-card metric-card-${tone}`}>
      <div className="metric-card-top">
        <span className="metric-card-label">{label}</span>
        {icon ? <span className="metric-card-icon">{icon}</span> : null}
      </div>
      <strong className="metric-card-value">{value}</strong>
      {detail ? <p className="metric-card-detail">{detail}</p> : null}
    </article>
  );
}
