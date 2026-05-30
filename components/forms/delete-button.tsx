"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";

function SubmitDangerButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="btn btn-danger" type="submit" disabled={pending}>
      <Trash2 size={16} strokeWidth={2.2} />
      <span>{pending ? "กำลังลบ..." : label}</span>
    </button>
  );
}

export function DeleteButton({
  action,
  label
}: {
  action: () => void | Promise<void>;
  label: string;
}) {
  return (
    <form action={action}>
      <SubmitDangerButton label={label} />
    </form>
  );
}
