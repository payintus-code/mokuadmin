import { AlertCircle, CalendarDays, Coins, Home, Hotel, PawPrint, PlusSquare, Users } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAppUser } from "@/lib/auth";
import { StatusBadge } from "@/components/ui/status-badge";
import { hasSupabaseEnv } from "@/lib/env";
import { getDailySchedule } from "@/lib/bookings";
import { formatBaht, formatDateInput, formatTime } from "@/lib/format";
import { getFinanceSummary } from "@/lib/finance";
import { createClient } from "@/lib/supabase/server";
import type { DailyScheduleItem } from "@/types/database";

export const dynamic = "force-dynamic";

const quickLinks = [
  {
    href: "/customers",
    title: "ข้อมูลลูกค้า",
    copy: "ค้นหาประวัติ เบอร์โทร และข้อมูลติดต่อได้เร็ว",
    icon: Users
  },
  {
    href: "/pets",
    title: "ข้อมูลสัตว์เลี้ยง",
    copy: "ดูข้อมูลสัตว์เลี้ยงและเพิ่มตัวใหม่ได้ทันที",
    icon: PawPrint
  },
  {
    href: "/rooms",
    title: "ห้องพัก",
    copy: "เช็กห้องว่างและความจุแบบสแกนง่าย",
    icon: Hotel
  },
  {
    href: "/finance",
    title: "การเงิน",
    copy: "เช็กรายรับวันนี้และไปหน้าบันทึกเงินต่อได้",
    icon: Coins
  }
];

const bookingTypeLabel = {
  grooming: "อาบน้ำ / ตัดขน",
  hotel: "โรงแรม"
} as const;

function isOperationalBooking(item: DailyScheduleItem) {
  return item.status !== "done" && item.status !== "cancelled";
}

function getNextBookings(schedule: DailyScheduleItem[]) {
  const now = Date.now();
  const activeOrUpcoming = schedule
    .filter((item) => isOperationalBooking(item) && new Date(item.end_at).getTime() >= now)
    .sort((left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime());

  return (activeOrUpcoming.length ? activeOrUpcoming : schedule.filter(isOperationalBooking)).slice(0, 5);
}

function getUrgentWorkItems(schedule: DailyScheduleItem[]) {
  return schedule
    .filter((item) => isOperationalBooking(item) || item.payment_status === "pending")
    .sort((left, right) => {
      const leftPriority = (left.payment_status === "pending" ? 2 : 0) + (isOperationalBooking(left) ? 1 : 0);
      const rightPriority = (right.payment_status === "pending" ? 2 : 0) + (isOperationalBooking(right) ? 1 : 0);

      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }

      return new Date(left.start_at).getTime() - new Date(right.start_at).getTime();
    })
    .slice(0, 4)
    .map((item) => ({
      item,
      reason:
        item.payment_status === "pending" && isOperationalBooking(item)
          ? "ยังไม่ปิดคิวและยังไม่ชำระ"
          : item.payment_status === "pending"
            ? "ยังไม่ชำระ"
            : "คิวยังไม่เสร็จ"
    }));
}

export default async function DashboardPage() {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack">
        <section className="card frontdesk-hero">
          <div className="frontdesk-hero-copy">
            <div className="section-kicker">Front Desk</div>
            <h1 className="frontdesk-hero-title">งานหน้าร้านวันนี้</h1>
            <p className="frontdesk-hero-subtitle">เปิดมาแล้วเห็นงานสำคัญและกดไปทำต่อได้ทันที</p>
          </div>

          <div className="frontdesk-hero-actions">
            <Link className="btn btn-primary" href="/bookings/new">
              สร้างคิวใหม่
            </Link>
            <Link className="btn btn-secondary" href="/schedule">
              ดูตารางคิววันนี้
            </Link>
          </div>
        </section>

        <SetupNotice />
      </main>
    );
  }

  const currentUser = await requireAppUser();

  const today = formatDateInput();
  const supabase = await createClient();
  const [schedule, roomsResult, financeSummary] = await Promise.all([
    getDailySchedule(today),
    supabase.from("rooms").select("id", { count: "exact", head: true }).eq("is_active", true),
    currentUser.role === "admin" ? getFinanceSummary(today) : Promise.resolve(null)
  ]);

  const totalCount = schedule.length;
  const operationalCount = schedule.filter(isOperationalBooking).length;
  const doneCount = schedule.filter((item) => item.status === "done").length;
  const unpaidCount = schedule.filter((item) => item.payment_status === "pending" && item.status !== "cancelled").length;

  const nextBookings = getNextBookings(schedule);
  const urgentItems = getUrgentWorkItems(schedule);

  const occupiedRoomCount = new Set(
    schedule
      .filter((item) => item.booking_type === "hotel" && isOperationalBooking(item) && item.room_name)
      .map((item) => item.room_name)
  ).size;
  const totalRooms = roomsResult.count ?? 0;
  const availableRoomCount = Math.max(totalRooms - occupiedRoomCount, 0);
  const visibleQuickLinks = currentUser.role === "admin" ? quickLinks : quickLinks.filter((item) => item.href !== "/finance");

  return (
    <main className="stack">
      <section className="card frontdesk-hero">
        <div className="frontdesk-hero-copy">
          <div className="section-kicker">Front Desk</div>
          <h1 className="frontdesk-hero-title">งานหน้าร้านวันนี้</h1>
          <p className="frontdesk-hero-subtitle">ดูคิวถัดไป งานค้าง และทางลัดหลักจากจุดเดียว</p>
        </div>

        <div className="frontdesk-hero-actions">
          <Link className="btn btn-primary" href="/bookings/new">
            <PlusSquare size={18} strokeWidth={2.2} />
            <span>สร้างคิวใหม่</span>
          </Link>
          <Link className="btn btn-secondary" href="/schedule">
            <CalendarDays size={18} strokeWidth={2.2} />
            <span>ดูตารางคิววันนี้</span>
          </Link>
        </div>
      </section>

      <section className={unpaidCount > 0 ? "grid-2 frontdesk-metrics frontdesk-metrics-with-alert" : "grid-3 frontdesk-metrics"}>
        <MetricCard
          label="คิวทั้งหมดวันนี้"
          value={`${totalCount} รายการ`}
          detail="คิวทั้งหมดที่อยู่ในภาพรวมของวันนี้"
          icon={<Home size={18} strokeWidth={2.1} />}
        />
        <MetricCard
          label="รอดำเนินการ"
          value={`${operationalCount} รายการ`}
          detail="คิวที่ยังต้องติดตามต่อ"
          tone="warning"
          icon={<CalendarDays size={18} strokeWidth={2.1} />}
        />
        <MetricCard
          label="เสร็จแล้ว"
          value={`${doneCount} รายการ`}
          detail="คิวที่ปิดงานเรียบร้อยแล้ว"
          tone="success"
          icon={<PawPrint size={18} strokeWidth={2.1} />}
        />
        {unpaidCount > 0 ? (
          <MetricCard
            label="ค้างชำระ"
            value={`${unpaidCount} รายการ`}
            detail="ควรรีบเช็กการรับชำระก่อนจบวัน"
            tone="danger"
            icon={<Coins size={18} strokeWidth={2.1} />}
          />
        ) : null}
      </section>

      <section className="frontdesk-main-grid">
        <section className="panel stack frontdesk-primary-panel">
          <div className="frontdesk-section-heading">
            <div>
              <div className="section-kicker">Next Up</div>
              <h2 className="section-title">คิวถัดไป</h2>
            </div>
            <Link className="frontdesk-inline-link" href="/schedule">
              ดูทั้งหมด
            </Link>
          </div>

          {nextBookings.length ? (
            <div className="stack">
              {nextBookings.map((item) => {
                const roomOrService = item.room_name || item.services_summary || "-";

                return (
                  <article key={item.booking_id} className="card frontdesk-booking-card">
                    <div className="frontdesk-booking-top">
                      <div>
                        <div className="frontdesk-booking-time">
                          {formatTime(item.start_at)} - {formatTime(item.end_at)}
                        </div>
                        <div className="muted">{item.booking_no}</div>
                      </div>

                      <div className="schedule-badge-stack">
                        <StatusBadge status={item.status} />
                        <PaymentStatusBadge status={item.payment_status} />
                      </div>
                    </div>

                    <div className="meta-grid">
                      <div className="meta-block">
                        <div className="meta-label">ลูกค้า</div>
                        <div className="meta-value">{item.customer_name}</div>
                      </div>
                      <div className="meta-block">
                        <div className="meta-label">สัตว์เลี้ยง</div>
                        <div className="meta-value">{item.pet_name}</div>
                      </div>
                    </div>

                    <div className="meta-grid">
                      <div className="meta-block">
                        <div className="meta-label">ประเภทงาน</div>
                        <div className="meta-value">{bookingTypeLabel[item.booking_type]}</div>
                      </div>
                      <div className="meta-block">
                        <div className="meta-label">บริการ / ห้อง</div>
                        <div className="meta-value">{roomOrService}</div>
                      </div>
                    </div>

                    <div className="frontdesk-booking-footer">
                      <span className="muted">รวม {formatBaht(item.total_amount)}</span>
                      <div className="frontdesk-booking-actions">
                        <Link className="btn btn-secondary" href={`/bookings/${item.booking_id}`}>
                          รายละเอียด
                        </Link>
                        <Link className="btn btn-secondary" href={`/payments/${item.booking_id}`}>
                          รับชำระเงิน
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<CalendarDays size={24} strokeWidth={2.1} />}
              title="ยังไม่มีคิวที่ต้องทำต่อวันนี้"
              description="ถ้ามีลูกค้า walk-in หรือจองเข้ามาใหม่ สามารถสร้างคิวได้จากปุ่มด้านบนทันที"
              action={
                <Link className="btn btn-primary" href="/bookings/new">
                  สร้างคิวใหม่
                </Link>
              }
            />
          )}
        </section>

        <section className="stack">
          <section className="panel stack">
            <div className="frontdesk-section-heading">
              <div>
                <div className="section-kicker">Watch List</div>
                <h2 className="section-title">งานที่ต้องรีบดู</h2>
              </div>
            </div>

            {urgentItems.length ? (
              <div className="stack">
                {urgentItems.map(({ item, reason }) => (
                  <article key={`urgent-${item.booking_id}`} className="frontdesk-alert-card">
                    <div className="frontdesk-alert-top">
                      <div className="frontdesk-alert-icon">
                        <AlertCircle size={16} strokeWidth={2.2} />
                      </div>
                      <div>
                        <strong>
                          {formatTime(item.start_at)} {item.pet_name}
                        </strong>
                        <div className="muted">{item.customer_name}</div>
                      </div>
                    </div>

                    <div className="frontdesk-alert-reason">{reason}</div>

                    <div className="frontdesk-alert-actions">
                      <Link className="frontdesk-inline-link" href={`/bookings/${item.booking_id}`}>
                        ดูรายละเอียด
                      </Link>
                      <Link className="frontdesk-inline-link" href={`/payments/${item.booking_id}`}>
                        ไปหน้าชำระเงิน
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="soft-note">วันนี้ยังไม่มีงานค้างหรือรายการที่ต้องเร่งติดตามเป็นพิเศษ</div>
            )}
          </section>

          <section className="panel stack">
            <div className="frontdesk-section-heading">
              <div>
                <div className="section-kicker">Shortcuts</div>
                <h2 className="section-title">ทางลัดหลัก</h2>
              </div>
            </div>

            <div className="quick-links">
              {visibleQuickLinks.map((item) => (
                <Link key={item.href} className="quick-link-card" href={item.href}>
                  <div className="quick-link-icon">
                    <item.icon size={20} strokeWidth={2.1} />
                  </div>
                  <div className="quick-link-title">{item.title}</div>
                  <div className="quick-link-copy">{item.copy}</div>
                </Link>
              ))}
            </div>
          </section>
        </section>
      </section>

      <section className="grid-2">
        <article className="panel stack">
          <div className="frontdesk-section-heading">
            <div>
              <div className="section-kicker">Rooms</div>
              <h2 className="section-title">ห้องพักวันนี้</h2>
            </div>
            <Link className="frontdesk-inline-link" href="/rooms">
              ไปหน้าห้องพัก
            </Link>
          </div>

          <div className="meta-grid">
            <div className="meta-block">
              <div className="meta-label">ใช้งานอยู่</div>
              <div className="meta-value">{occupiedRoomCount} ห้อง</div>
            </div>
            <div className="meta-block">
              <div className="meta-label">ว่างอยู่</div>
              <div className="meta-value">{availableRoomCount} ห้อง</div>
            </div>
          </div>

          <div className="soft-note">คำนวณจากห้อง active ทั้งหมดเทียบกับคิวโรงแรมที่ยังไม่ปิดงานในวันนี้</div>
        </article>

        {currentUser.role === "admin" && financeSummary ? (
        <article className="panel stack">
          <div className="frontdesk-section-heading">
            <div>
              <div className="section-kicker">Finance</div>
              <h2 className="section-title">รายรับวันนี้</h2>
            </div>
            <Link className="frontdesk-inline-link" href="/finance">
              ไปหน้าการเงิน
            </Link>
          </div>

          <MetricCard
            label="รายรับรวม"
            value={formatBaht(Number(financeSummary.income_total ?? 0))}
            tone="success"
            detail="สรุปจากรายการรายรับของวันนี้"
            icon={<Coins size={18} strokeWidth={2.1} />}
          />
        </article>) : null}
      </section>
    </main>
  );
}
