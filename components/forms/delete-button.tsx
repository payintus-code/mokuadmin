import { ConfirmActionButton } from "@/components/ui/confirm-action-button";

export function DeleteButton({
  action,
  label,
  description = "รายการนี้จะถูกลบออกจากระบบหลังยืนยัน",
  confirmLabel = "ยืนยันลบ"
}: {
  action: () => void | Promise<void>;
  label: string;
  description?: string;
  confirmLabel?: string;
}) {
  return (
    <ConfirmActionButton
      action={action}
      label={label}
      description={description}
      confirmLabel={confirmLabel}
      pendingLabel="กำลังลบ..."
    />
  );
}
