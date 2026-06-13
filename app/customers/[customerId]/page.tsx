import { CalendarClock, Hotel, Phone, Scissors, UserRound, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { PendingLink } from "@/components/ui/pending-link";
import { SetupNotice } from "@/components/ui/setup-notice";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireAppUser } from "@/lib/auth";
import { getCustomerHistory } from "@/lib/customer-history";
import { hasSupabaseEnv } from "@/lib/env";
import { formatBaht, formatDate, formatDateTime } from "@/lib/format";

const bookingTypeLabel = {
  grooming: "อาบน้ำ / ตัดขน",
  hotel: "โรงแรม / ฝากเลี้ยง"
} as const;

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params
}: {
  params: Promise<{ customerId: string }>;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <PageHeader title="ประวัติลูกค้า" subtitle="ดูการใช้บริการและคิวย้อนหลังของลูกค้า" actionLabel="กลับไปข้อมูลลูกค้า" actionHref="/customers" />
        <SetupNotice />
      </main>
    );
  }

  await requireAppUser();
  const { customerId } = await params;
  const customer = await getCustomerHistory(customerId);

  if (!customer) {
    notFound();
  }

  return (
    <main className="stack">
      <PageHeader
        title={customer.full_name}
        subtitle="ดูสรุปการใช้บริการจริงและประวัติคิวย้อนหลังของลูกค้ารายนี้"
        actionLabel="กลับไปข้อมูลลูกค้า"
        actionHref="/customers"
      />

      <section className="panel stack customer-profile-panel">
        <div className="customer-profile-top">
          <div>
            <div className="section-kicker">
              <UserRound size={14} strokeWidth={2.2} />
              <span>Customer Profile</span>
            </div>
            <h2 className="section-title" style={{ marginTop: 8 }}>
              {customer.full_name}
            </h2>
          </div>
          <div className="customer-profile-actions">
            <a className="soft-note customer-contact-chip" href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`}>
              <Phone size={16} strokeWidth={2.1} />
              <span>{customer.phone}</span>
            </a>
            {customer.facebook_name?.trim() ? (
              <a className="btn btn-secondary" href={`https://www.facebook.com/search/top?q=${encodeURIComponent(customer.facebook_name)}`} target="_blank" rel="noreferrer">
                เปิด Facebook
              </a>
            ) : null}
          </div>
        </div>

        <div className="meta-grid">
          <div className="meta-block">
            <div className="meta-label">เบอร์โทร</div>
            <div className="meta-value">{customer.phone}</div>
          </div>
          <div className="meta-block">
            <div className="meta-label">Facebook</div>
            <div className="meta-value">{customer.facebook_name?.trim() ? customer.facebook_name : "-"}</div>
          </div>
        </div>

        <div className="meta-block">
          <div className="meta-label">สัตว์เลี้ยงที่ใช้งานอยู่</div>
          {customer.pets.length ? (
            <div className="customer-pet-list">
              {customer.pets.map((pet) => (
                <span key={pet.id} className="customer-pet-chip">
                  {pet.name} ({pet.species})
                </span>
              ))}
            </div>
          ) : (
            <div className="meta-value">-</div>
          )}
        </div>

        <div className="meta-block">
          <div className="meta-label">หมายเหตุ</div>
          <div className="meta-value">{customer.note?.trim() ? customer.note : "-"}</div>
        </div>
      </section>

      <section className="grid-2 customer-metrics-grid">
        <MetricCard
          label="อาบน้ำ / ตัดขนแล้ว"
          value={`${customer.grooming_count} ครั้ง`}
          detail="นับเฉพาะคิวที่ปิดงานแล้ว"
          icon={<Scissors size={18} strokeWidth={2.1} />}
        />
        <MetricCard
          label="โรงแรมแมวแล้ว"
          value={`${customer.hotel_count} ครั้ง`}
          detail="นับเฉพาะคิวที่ปิดงานแล้ว"
          icon={<Hotel size={18} strokeWidth={2.1} />}
        />
        <MetricCard
          label="ใช้บริการรวม"
          value={`${customer.total_completed_count} ครั้ง`}
          detail="รวม grooming และ hotel ที่เสร็จสมบูรณ์"
          tone="success"
          icon={<Users size={18} strokeWidth={2.1} />}
        />
        <MetricCard
          label="ล่าสุดเมื่อ"
          value={customer.last_service_at ? formatDate(customer.last_service_at) : "-"}
          detail={customer.last_service_at ? formatDateTime(customer.last_service_at, "d MMM yyyy HH.mm") : "ยังไม่มีคิวที่เสร็จแล้ว"}
          tone="warning"
          icon={<CalendarClock size={18} strokeWidth={2.1} />}
        />
      </section>

      <section className="stack">
        <div className="frontdesk-section-heading">
          <div>
            <div className="section-kicker">History</div>
            <h2 className="section-title">ประวัติการใช้บริการ</h2>
          </div>
        </div>

        {customer.history.length ? (
          <div className="customer-history-list">
            {customer.history.map((item) => {
              const roomOrService = item.room_name || item.services_summary || "-";

              return (
                <article key={item.booking_id} className="card list-card customer-history-card">
                  <div className="customer-history-head">
                    <div>
                      <strong>{item.booking_no}</strong>
                      <div className="muted" style={{ marginTop: 4 }}>
                        {bookingTypeLabel[item.booking_type]}
                      </div>
                    </div>
                    <div className="schedule-badge-stack">
                      <StatusBadge status={item.status} />
                      <PaymentStatusBadge status={item.payment_status} />
                    </div>
                  </div>

                  <div className="meta-grid">
                    <div className="meta-block">
                      <div className="meta-label">วันที่</div>
                      <div className="meta-value">{formatDate(item.start_at, "EEEE d MMM yyyy")}</div>
                    </div>
                    <div className="meta-block">
                      <div className="meta-label">ยอดรวม</div>
                      <div className="meta-value">{formatBaht(item.total_amount)}</div>
                    </div>
                  </div>

                  <div className="meta-grid">
                    <div className="meta-block">
                      <div className="meta-label">สัตว์เลี้ยง</div>
                      <div className="meta-value">{item.pet_name}</div>
                    </div>
                    <div className="meta-block">
                      <div className="meta-label">บริการ / ห้อง</div>
                      <div className="meta-value">{roomOrService}</div>
                    </div>
                  </div>

                  <div className="inline-meta">
                    <div className="muted">
                      {formatDateTime(item.start_at)} - {formatDateTime(item.end_at, "HH.mm")}
                    </div>
                    <div className="customer-history-actions">
                      <PendingLink className="tap-row-link customer-history-link" href={`/bookings/${item.booking_id}`}>
                        <span>ดูรายละเอียดคิว</span>
                        <span aria-hidden="true">›</span>
                      </PendingLink>
                      <PendingLink className="tap-row-link customer-history-link" href={`/bookings/new?repeatBookingId=${item.booking_id}`}>
                        <span>สร้างคิวซ้ำ</span>
                        <span aria-hidden="true">›</span>
                      </PendingLink>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={<Users size={24} strokeWidth={2.1} />}
            title="ยังไม่มีประวัติการใช้บริการ"
            description="ลูกค้ารายนี้ยังไม่มี booking ในระบบ หรือยังไม่เคยเริ่มใช้งานจากหน้าร้าน"
          />
        )}
      </section>
    </main>
  );
}
