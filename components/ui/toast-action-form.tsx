"use client";

import type { ReactNode } from "react";
import { SAVE_SUCCESS_MESSAGE, useToast } from "@/components/ui/toast-provider";

type ToastActionFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
  message?: string;
};

export function ToastActionForm({
  action,
  children,
  className,
  message = SAVE_SUCCESS_MESSAGE
}: ToastActionFormProps) {
  const { showToast } = useToast();

  async function handleAction(formData: FormData) {
    await action(formData);
    showToast(message);
  }

  return (
    <form action={handleAction} className={className}>
      {children}
    </form>
  );
}
