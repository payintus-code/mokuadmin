"use client";

import { CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const SAVE_SUCCESS_MESSAGE = "บันทึกเรียบร้อยแล้ว";
const SAVE_TOAST_QUERY_VALUE = "save";
const TOAST_DURATION_MS = 2800;

type ToastContextValue = {
  showToast: (message?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");

  const showToast = useCallback((nextMessage = SAVE_SUCCESS_MESSAGE) => {
    setMessage(nextMessage);
  }, []);

  const hideToast = useCallback(() => {
    setMessage("");
  }, []);

  const readToastFromUrl = useCallback(() => {
    const currentUrl = new URL(window.location.href);

    if (currentUrl.searchParams.get("toast") !== SAVE_TOAST_QUERY_VALUE) {
      return;
    }

    showToast(currentUrl.searchParams.get("toastMessage") || SAVE_SUCCESS_MESSAGE);
    currentUrl.searchParams.delete("toast");
    currentUrl.searchParams.delete("toastMessage");
    window.history.replaceState(window.history.state, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  }, [showToast]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(hideToast, TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [hideToast, message]);

  useEffect(() => {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    let urlChangeTimer: number | null = null;
    const notifyUrlChange = () => {
      if (urlChangeTimer !== null) {
        window.clearTimeout(urlChangeTimer);
      }

      urlChangeTimer = window.setTimeout(() => {
        urlChangeTimer = null;
        window.dispatchEvent(new Event("moku:urlchange"));
      }, 0);
    };

    window.history.pushState = function pushState(...args) {
      const result = originalPushState.apply(this, args);
      notifyUrlChange();
      return result;
    };

    window.history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      notifyUrlChange();
      return result;
    };

    window.addEventListener("popstate", readToastFromUrl);
    window.addEventListener("moku:urlchange", readToastFromUrl);
    readToastFromUrl();

    return () => {
      if (urlChangeTimer !== null) {
        window.clearTimeout(urlChangeTimer);
      }

      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", readToastFromUrl);
      window.removeEventListener("moku:urlchange", readToastFromUrl);
    };
  }, [readToastFromUrl]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {message ? (
          <div className="app-toast app-toast-success" role="status">
            <CheckCircle2 size={20} strokeWidth={2.3} />
            <strong>{message}</strong>
            <button className="toast-close-button" type="button" onClick={hideToast} aria-label="ปิดข้อความแจ้งเตือน">
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
