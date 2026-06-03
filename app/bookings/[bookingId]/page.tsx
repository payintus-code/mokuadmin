import Link from "next/link";
import { deleteBooking } from "@/app/actions/bookings";
import { DeleteButton } from "@/components/forms/delete-button";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { SetupNotice } from "@/components/ui/setup-notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAppUser } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { getBookingDetail } from "@/lib/bookings";
import { formatBaht, formatDate, formatDateTime } from "@/lib/format";

const bookingTypeLabel = {
  grooming: "อาบน้ำ / ตัดขน",
  hotel: "โรงแรม / ฝากเลี้ยง"
} as const;

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({
  params
}: {
  params: Promise<{ bookingId: string }>;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="รายละเอียดคิว" subtitle="ดูข้อมูลคิวและจัดการสถานะ" />
        <SetupNotice />
      </main>
    );
  }

  const currentUser = await requireAppUser();
  const { bookingId } = await params;
  const booking = await getBookingDetail(bookingId);
  const roomOrService = booking.room_name || booking.services_summary || "-";
  const paidAmount = Number(booking.payment?.amount ?? 0);
  const remainingAmount = Math.max(booking.total_amount - paidAmount, 0);

  return (
    <main className="stack">
      <PageHeader title="รายละเอียดคิว" subtitle={booking.booking_no} actionLabel="กลับไปตารางคิว" actionHref="/schedule" />

      <section className="card stack">
        <div className="schedule-list-top">
          <div>
            <strong>{booking.booking_no}</strong>
            <div className="muted" style={{ marginTop: 4 }}>
              {bookingTypeLabel[booking.booking_type]}
            </div>
          </div>
          <div className="schedule-badge-stack">
            <StatusBadge status={booking.status} />
            <PaymentStatusBadge status={booking.payment_status} />
          </div>
        </div>

        <div className="grid-2">
          <div>
            <div className="muted">วันที่</div>
            <strong>{formatDate(booking.start_at, "EEEE d MMM yyyy")}</strong>
          </div>
          <div>
            <div className="muted">ยอดรวม</div>
            <strong>{formatBaht(booking.total_amount)}</strong>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <div className="muted">รับแล้ว</div>
            <strong>{formatBaht(paidAmount)}</strong>
          </div>
          <div>
            <div className="muted">คงเหลือ</div>
            <strong>{formatBaht(remainingAmount)}</strong>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <div className="muted">เริ่ม</div>
            <strong>{formatDateTime(booking.start_at)}</strong>
          </div>
          <div>
            <div className="muted">สิ้นสุด</div>
            <strong>{formatDateTime(booking.end_at)}</strong>
          </div>
        </div>

        <div className="grid-2">
          <div>
            <div className="muted">สัตว์เลี้ยง</div>
            <strong>{booking.pet_name}</strong>
          </div>
          <div>
            <div className="muted">ลูกค้า</div>
            <strong>{booking.customer_name}</strong>
            <div className="muted" style={{ marginTop: 4 }}>
              {booking.customer_phone}
            </div>
          </div>
        </div>

        <div>
          <div className="muted">บริการ / ห้อง</div>
          <strong>{roomOrService}</strong>
        </div>

        <div>
          <div className="muted">หมายเหตุ</div>
          <div>{booking.note?.trim() ? booking.note : "-"}</div>
        </div>

        <div className={currentUser.role === "admin" ? "grid-2" : undefined}>
          <Link className="btn btn-secondary" href={`/payments/${booking.booking_id}`}>
            รับชำระเงิน
          </Link>
          {currentUser.role === "admin" ? (
            <DeleteButton
              action={deleteBooking.bind(null, booking.booking_id)}
              label="ลบคิวนี้"
              description={`ยืนยันลบคิว ${booking.booking_no} และข้อมูลที่เกี่ยวข้อง`}
              confirmLabel="ยืนยันลบคิว"
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
