import Link from "next/link";
import { BookingPaymentForm } from "@/components/forms/booking-payment-form";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { formatBaht } from "@/lib/format";
import { prepareBookingPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function PaymentPage({
  params
}: {
  params: Promise<{ bookingId: string }>;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="รับชำระเงิน" subtitle="บันทึกมัดจำหรือยอดที่เหลือของคิว" />
        <SetupNotice />
      </main>
    );
  }

  await requireAppUser();

  const { bookingId } = await params;
  const paymentInfo = await prepareBookingPayment(bookingId, { useAdminClient: true });

  return (
    <main className="stack">
      <PageHeader title="รับชำระเงิน" subtitle="บันทึกยอดสะสมของคิวนี้" actionLabel="กลับไปตารางคิว" actionHref="/schedule" />

      <section className="card stack">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <strong>{paymentInfo.bookingNo}</strong>
            <div className="muted">{paymentInfo.bookingType === "hotel" ? "โรงแรม" : "อาบน้ำ / ตัดขน"}</div>
          </div>
          <PaymentStatusBadge status={paymentInfo.paymentStatus} />
        </div>

        <div className="grid-2">
          <div>
            <div className="muted">ลูกค้า</div>
            <strong>{paymentInfo.customerName}</strong>
          </div>
          <div>
            <div className="muted">สัตว์เลี้ยง</div>
            <strong>{paymentInfo.petName}</strong>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <div className="muted">บริการ / ห้อง</div>
            <strong>{paymentInfo.roomName || paymentInfo.servicesSummary || "-"}</strong>
          </div>
          <div>
            <div className="muted">ยอดรวม</div>
            <strong>{formatBaht(paymentInfo.totalAmount)}</strong>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <div className="muted">รับแล้ว</div>
            <strong>{formatBaht(paymentInfo.paidAmount)}</strong>
          </div>
          <div>
            <div className="muted">คงเหลือ</div>
            <strong>{formatBaht(paymentInfo.remainingAmount)}</strong>
          </div>
        </div>

        {paymentInfo.paymentStatus === "paid" ? (
          <Link className="btn btn-secondary" href={`/receipts/${bookingId}`}>
            เปิดใบเสร็จ
          </Link>
        ) : null}
      </section>

      <BookingPaymentForm
        bookingId={paymentInfo.bookingId}
        totalAmount={paymentInfo.totalAmount}
        paidAmount={paymentInfo.paidAmount}
        remainingAmount={paymentInfo.remainingAmount}
        bookingNo={paymentInfo.bookingNo}
        qrDataUrl={paymentInfo.promptpayQrDataUrl}
        promptpayAvailable={Boolean(paymentInfo.shop.promptpay_target)}
        payment={paymentInfo.payment}
      />
    </main>
  );
}
