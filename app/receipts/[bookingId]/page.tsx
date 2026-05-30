import Link from "next/link";
import { PrintButton } from "@/components/ui/print-button";
import { PageHeader } from "@/components/ui/page-header";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { formatBaht } from "@/lib/format";
import { getReceiptData } from "@/lib/payments";

const paymentMethodLabelMap = {
  cash: "เงินสด",
  promptpay_qr: "PromptPay QR",
  transfer: "โอน",
  card: "บัตร",
  other: "อื่น ๆ"
} as const;

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params
}: {
  params: Promise<{ bookingId: string }>;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="ใบเสร็จ" subtitle="พิมพ์หรือบันทึกเป็น PDF ได้จากเบราว์เซอร์" />
        <SetupNotice />
      </main>
    );
  }

  await requireAppUser();

  const { bookingId } = await params;
  const receipt = await getReceiptData(bookingId);

  return (
    <main className="stack">
      <PageHeader title="ใบเสร็จ" subtitle="พิมพ์หรือบันทึกเป็น PDF ได้จากเบราว์เซอร์" actionLabel="กลับหน้ารับชำระเงิน" actionHref={`/payments/${bookingId}`} />

      <section className="card stack" style={{ gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <h2 className="section-title" style={{ marginBottom: 4 }}>{receipt.shop_name}</h2>
            {receipt.shop_address ? <div className="muted">{receipt.shop_address}</div> : null}
            {receipt.shop_phone ? <div className="muted">โทร {receipt.shop_phone}</div> : null}
          </div>
          <div style={{ textAlign: "right" }}>
            <strong>{receipt.receipt_no}</strong>
            <div className="muted">{new Date(receipt.receipt_issued_at).toLocaleString("th-TH")}</div>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <div className="muted">ลูกค้า</div>
            <strong>{receipt.customer_name}</strong>
          </div>
          <div>
            <div className="muted">สัตว์เลี้ยง</div>
            <strong>{receipt.pet_name}</strong>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <div className="muted">เลขที่คิว</div>
            <strong>{receipt.booking_no}</strong>
          </div>
          <div>
            <div className="muted">วิธีชำระ</div>
            <strong>{paymentMethodLabelMap[receipt.payment_method]}</strong>
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div className="muted">รายการ</div>
          <strong>{receipt.room_name || receipt.services_summary || "-"}</strong>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="muted">ยอดรวม</span>
          <strong style={{ fontSize: "1.2rem" }}>{formatBaht(receipt.total_amount)}</strong>
        </div>

        <div className="grid-2">
          <PrintButton />
          <Link className="btn btn-secondary" href={`/payments/${bookingId}`}>
            กลับหน้ารับชำระเงิน
          </Link>
        </div>
      </section>
    </main>
  );
}
