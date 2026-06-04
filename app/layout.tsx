import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getCurrentAppUser } from "@/lib/auth";
import { BottomNav } from "@/components/ui/bottom-nav";
import { FloatingBookingAction } from "@/components/ui/floating-booking-action";
import { ToastProvider } from "@/components/ui/toast-provider";

export const metadata: Metadata = {
  title: "Moku Pet Grooming",
  description: "Pet grooming and hotel admin dashboard"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAF7F2"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const currentUser = await getCurrentAppUser();

  return (
    <html lang="th">
      <body>
        <ToastProvider>
          <div className="app-shell">
            <div className="app-shell-glow app-shell-glow-left" aria-hidden="true" />
            <div className="app-shell-glow app-shell-glow-right" aria-hidden="true" />
            <div className="shell">{children}</div>
            {currentUser ? (
              <>
                <FloatingBookingAction />
                <BottomNav canViewFinance={currentUser.role === "admin"} />
              </>
            ) : null}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
