import { PawPrint } from "lucide-react";
import { PendingLink } from "@/components/ui/pending-link";

export function PageHeader({
  title,
  subtitle,
  actionLabel,
  actionHref
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <section className="page-header">
      <div className="page-header-grid">
        <div className="page-header-main">
          <div className="page-header-eyebrow">
            <PawPrint size={14} strokeWidth={2.3} />
            <span>Moku Pet Grooming</span>
          </div>
          <div>
            <h1 className="page-header-title">{title}</h1>
            {subtitle ? <p className="page-header-subtitle">{subtitle}</p> : null}
          </div>
        </div>
        {actionLabel && actionHref ? (
          <div className="page-header-action">
            <PendingLink className="btn btn-primary" href={actionHref}>
              {actionLabel}
            </PendingLink>
          </div>
        ) : null}
      </div>
    </section>
  );
}
