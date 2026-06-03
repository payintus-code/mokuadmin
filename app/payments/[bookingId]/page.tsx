import { BookingPaymentForm } from "@/components/forms/booking-payment-form";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { SetupNotice } from "@/components/ui/setup-notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { prepareBookingPayment } from "@/lib/payments";
import type { BookingStatus } from "@/types/database";

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
          <div className="schedule-badge-stack">
            <StatusBadge status={paymentInfo.bookingStatus as BookingStatus} />
            <PaymentStatusBadge status={paymentInfo.paymentStatus} />
          </div>
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

        <div>
          <div className="muted">บริการ / ห้อง</div>
          <strong>{paymentInfo.roomName || paymentInfo.servicesSummary || "-"}</strong>
        </div>
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
