import { notFound } from "next/navigation";
import "@/app/globals.css";
import { GroomingPreview } from "./preview";

export default function GroomingPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <GroomingPreview />;
}
