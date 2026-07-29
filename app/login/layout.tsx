import type { ReactNode } from "react";
import "./login.css";

export default function LoginLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
