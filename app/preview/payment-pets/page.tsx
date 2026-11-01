import "@/app/globals.css";
import { notFound } from "next/navigation";
import { PaymentPetsPreview } from "./preview";

export default function PaymentPetsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PaymentPetsPreview />;
}
