export function ConfirmActionButton({
  action,
  label,
  description,
  confirmLabel,
  tone = "danger"
}: {
  action: () => void | Promise<void>;
  label: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  tone?: "danger" | "secondary";
}) {
  return (
    <form action={action} className="confirm-action-form">
      <details className="confirm-action-disclosure">
        <summary className={`btn btn-${tone} confirm-action-summary`}>{label}</summary>
        <div className="confirm-action">
          <div className="confirm-action-copy">{description}</div>
          <div className="confirm-action-buttons">
            <span className="confirm-action-cancel-hint">แตะปุ่มเดิมเพื่อยกเลิก</span>
            <button className={`btn btn-${tone}`} type="submit">
              {confirmLabel}
            </button>
          </div>
        </div>
      </details>
    </form>
  );
}
