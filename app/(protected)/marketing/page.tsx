import type { ReactNode } from "react";
import { format, parse } from "date-fns";
import { th } from "date-fns/locale";
import { BarChart3, CalendarDays, Clock3, Coins, CreditCard, Hotel, Megaphone, Repeat2, Scissors, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { PendingLink } from "@/components/ui/pending-link";
import { SetupNotice } from "@/components/ui/setup-notice";
import { requireAdmin } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/env";
import { formatBaht } from "@/lib/format";
import { getDefaultMarketingDateRange, getMarketingDashboard } from "@/lib/marketing";
import type {
  MarketingBookingTypeFilter,
  MarketingCustomerRow,
  MarketingDashboardFilters,
  MarketingDemandBucket,
  MarketingKpiSummary,
  MarketingMixRow,
  MarketingPaymentMethodRow,
  MarketingRoomRow,
  MarketingServiceRow
} from "@/types/database";

export const dynamic = "force-dynamic";

const paymentMethodLabels: Record<string, string> = {
  cash: "เงินสด",
  promptpay_qr: "PromptPay QR",
  transfer: "โอนเงิน",
  card: "บัตร",
  other: "อื่น ๆ"
};

const bookingTypeLabels: Record<MarketingBookingTypeFilter, string> = {
  all: "ทั้งหมด",
  grooming: "อาบน้ำ / ตัดขน",
  hotel: "โรงแรม / ฝากเลี้ยง"
};

const bookingMixLabels: Record<string, string> = {
  grooming: "อาบน้ำ / ตัดขน",
  hotel: "โรงแรม / ฝากเลี้ยง"
};

const weekdayLabels: Record<string, string> = {
  Sun: "วันอาทิตย์",
  Mon: "วันจันทร์",
  Tue: "วันอังคาร",
  Wed: "วันพุธ",
  Thu: "วันพฤหัสบดี",
  Fri: "วันศุกร์",
  Sat: "วันเสาร์"
};

const winBackSegmentLabels: Record<NonNullable<MarketingCustomerRow["win_back_segment"]>, string> = {
  "30d": "หายไป 30+ วัน",
  "60d": "หายไป 60+ วัน",
  "90d": "หายไป 90+ วัน"
};

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDayOfMonth = new Date(year, monthNumber, 0).getDate();
  const paddedMonth = String(monthNumber).padStart(2, "0");

  return {
    startDate: `${year}-${paddedMonth}-01`,
    endDate: `${year}-${paddedMonth}-${String(lastDayOfMonth).padStart(2, "0")}`
  };
}

function normalizeBookingType(value: string | undefined): MarketingBookingTypeFilter {
  if (value === "grooming" || value === "hotel") {
    return value;
  }

  return "all";
}

function normalizeFilters(params: { mode?: string; month?: string; start?: string; end?: string; bookingType?: string }): MarketingDashboardFilters & { monthValue: string } {
  const defaults = getDefaultMarketingDateRange();
  const mode = params.mode === "month" ? "month" : "range";
  const bookingType = normalizeBookingType(params.bookingType);

  if (mode === "month") {
    const monthValue = /^\d{4}-\d{2}$/.test(params.month ?? "") ? (params.month as string) : defaults.endDate.slice(0, 7);
    const range = getMonthRange(monthValue);

    return {
      mode,
      monthValue,
      startDate: range.startDate,
      endDate: range.endDate,
      bookingType
    };
  }

  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(params.start ?? "") ? (params.start as string) : defaults.startDate;
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(params.end ?? "") ? (params.end as string) : defaults.endDate;

  return {
    mode,
    monthValue: endDate.slice(0, 7),
    startDate: startDate <= endDate ? startDate : endDate,
    endDate: endDate >= startDate ? endDate : startDate,
    bookingType
  };
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(value >= 0.1 ? 0 : 1)}%`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("th-TH").format(value);
}

function formatDateKey(dateKey: string) {
  const parsed = parse(dateKey, "yyyy-MM-dd", new Date());
  return format(parsed, "d MMM yyyy", { locale: th });
}

function formatFilterLabel(filters: MarketingDashboardFilters & { monthValue: string }) {
  if (filters.mode === "month") {
    const parsed = parse(`${filters.monthValue}-01`, "yyyy-MM-dd", new Date());
    return format(parsed, "MMMM yyyy", { locale: th });
  }

  return `${formatDateKey(filters.startDate)} - ${formatDateKey(filters.endDate)}`;
}

function formatDemandLabel(label: string) {
  return weekdayLabels[label] ?? label;
}

function formatBookingMixLabel(item: MarketingMixRow) {
  return bookingMixLabels[item.key] ?? item.label;
}

function formatLastSeen(value: string | null) {
  return value ? formatDateKey(value.slice(0, 10)) : "-";
}

function buildSearchHref(filters: MarketingDashboardFilters & { monthValue: string }, nextMode?: "month" | "range") {
  const mode = nextMode ?? filters.mode;
  const query = new URLSearchParams();
  query.set("mode", mode);
  query.set("bookingType", filters.bookingType);

  if (mode === "month") {
    query.set("month", filters.monthValue);
  } else {
    query.set("start", filters.startDate);
    query.set("end", filters.endDate);
  }

  return `/marketing?${query.toString()}`;
}

function SectionIntro({ eyebrow, title, copy, icon }: { eyebrow: string; title: string; copy?: string; icon?: ReactNode }) {
  return (
    <div className="marketing-section-intro">
      <div className="section-kicker">
        {icon}
        <span>{eyebrow}</span>
      </div>
      <div>
        <h2 className="section-title">{title}</h2>
        {copy ? <p className="marketing-section-copy">{copy}</p> : null}
      </div>
    </div>
  );
}

function SnapshotCard({
  label,
  value,
  detail,
  icon,
  tone = "default",
  primary = false
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  primary?: boolean;
}) {
  const className = ["marketing-snapshot-card", `marketing-snapshot-card-${tone}`, primary ? "marketing-snapshot-card-primary" : ""].filter(Boolean).join(" ");

  return (
    <article className={className}>
      <div className="marketing-snapshot-top">
        <span>{label}</span>
        <span className="marketing-snapshot-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function BusinessSnapshot({ summary }: { summary: MarketingKpiSummary }) {
  return (
    <section className="marketing-snapshot" aria-label="ตัวเลขภาพรวมธุรกิจ">
      <SnapshotCard
        primary
        tone="success"
        label="รายได้"
        value={formatBaht(summary.revenue)}
        detail={`จากคิวที่เสร็จแล้ว ${formatCount(summary.completed_bookings)} คิว`}
        icon={<Coins size={18} strokeWidth={2.1} />}
      />
      <SnapshotCard
        label="จำนวนคิว"
        value={`${formatCount(summary.completed_bookings)} คิว`}
        detail="คิวที่ปิดงานแล้วในช่วงที่เลือก"
        icon={<Clock3 size={18} strokeWidth={2.1} />}
      />
      <SnapshotCard
        tone="success"
        label="ลูกค้ากลับมาซ้ำ"
        value={`${formatCount(summary.repeat_customers)} คน`}
        detail={`คิดเป็น ${formatPercent(summary.repeat_rate)} ของลูกค้าที่มาใช้บริการ`}
        icon={<Repeat2 size={18} strokeWidth={2.1} />}
      />
      <SnapshotCard
        label="ลูกค้าใหม่"
        value={`${formatCount(summary.new_customers)} คน`}
        detail="ลูกค้าที่เริ่มใช้บริการในช่วงนี้"
        icon={<Users size={18} strokeWidth={2.1} />}
      />
    </section>
  );
}

function InsightBars({ title, subtitle, description, items }: { title: string; subtitle: string; description: string; items: MarketingDemandBucket[] }) {
  return (
    <section className="panel stack marketing-panel">
      <SectionIntro eyebrow={title} title={subtitle} copy={description} />

      <div className="marketing-bar-list">
        {items.map((item) => (
          <div key={item.key} className="marketing-bar-row">
            <div className="marketing-bar-labels">
              <strong>{formatDemandLabel(item.label)}</strong>
              <span>{formatCount(item.booking_count)} คิว</span>
            </div>
            <div className="marketing-bar-track" aria-hidden="true">
              <div className="marketing-bar-fill" style={{ width: `${Math.max(item.share_of_bookings * 100, item.booking_count ? 6 : 0)}%` }} />
            </div>
            <div className="marketing-bar-meta">
              <span>{formatPercent(item.share_of_bookings)} ของคิว</span>
              <span>{formatBaht(item.revenue)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MixChips({
  eyebrow,
  title,
  description,
  items,
  valueLabel,
  emptyText
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: MarketingMixRow[];
  valueLabel: string;
  emptyText: string;
}) {
  return (
    <section className="panel stack marketing-panel">
      <SectionIntro eyebrow={eyebrow} title={title} copy={description} />

      <div className="marketing-chip-grid">
        {items.length ? (
          items.map((item) => (
            <div key={item.key} className="marketing-chip-card">
              <strong>{formatBookingMixLabel(item)}</strong>
              <span>
                {formatCount(item.count)} {valueLabel}
              </span>
              <small>{formatPercent(item.share)}</small>
            </div>
          ))
        ) : (
          <div className="soft-note">{emptyText}</div>
        )}
      </div>
    </section>
  );
}

function BookingMixPanel({ items, groomingBookings, hotelBookings }: { items: MarketingMixRow[]; groomingBookings: number; hotelBookings: number }) {
  return (
    <section className="panel stack marketing-panel">
      <SectionIntro eyebrow="ประเภทบริการ" title="คิวมาจากบริการไหน" copy="ดูว่างานหลักช่วงนี้มาจากอาบน้ำ/ตัดขน หรือโรงแรมมากกว่ากัน" />

      <div className="marketing-chip-grid">
        {items.map((item) => (
          <div key={item.key} className="marketing-chip-card">
            <strong>{formatBookingMixLabel(item)}</strong>
            <span>{formatCount(item.count)} คิว</span>
            <small>{formatPercent(item.share)}</small>
          </div>
        ))}
      </div>

      <div className="soft-note">
        อาบน้ำ / ตัดขน {formatCount(groomingBookings)} คิว และโรงแรม / ฝากเลี้ยง {formatCount(hotelBookings)} คิวในช่วงนี้
      </div>
    </section>
  );
}

function CustomerActionTable({
  title,
  subtitle,
  description,
  rows,
  showWinBack = false
}: {
  title: string;
  subtitle: string;
  description: string;
  rows: MarketingCustomerRow[];
  showWinBack?: boolean;
}) {
  return (
    <section className="panel stack marketing-panel">
      <SectionIntro eyebrow={title} title={subtitle} copy={description} />

      {rows.length ? (
        <div className="marketing-table">
          <div className="marketing-table-head marketing-customer-grid">
            <span>ลูกค้า</span>
            <span>จำนวนคิว</span>
            <span>ยอดใช้บริการ</span>
            <span>ล่าสุด</span>
          </div>

          {rows.map((row) => (
            <PendingLink key={row.customer_id} href={`/customers/${row.customer_id}`} className="marketing-table-row marketing-customer-grid">
              <div className="marketing-table-primary">
                <strong>{row.customer_name}</strong>
                <span>{row.pet_summary}</span>
                {showWinBack && row.win_back_segment ? (
                  <div className="marketing-badge-row">
                    <span className={`marketing-badge marketing-badge-${row.win_back_segment}`}>{winBackSegmentLabels[row.win_back_segment]}</span>
                    {row.is_at_risk ? <span className="marketing-badge marketing-badge-risk">ควรรีบตาม</span> : null}
                  </div>
                ) : null}
              </div>
              <span className="marketing-table-cell" data-label="จำนวนคิว">
                {formatCount(row.booking_count)}
              </span>
              <span className="marketing-table-cell" data-label="ยอดใช้บริการ">
                {formatBaht(row.total_spend)}
              </span>
              <span className="marketing-table-cell marketing-table-date" data-label="ล่าสุด">
                {formatLastSeen(row.last_booking_at)}
                {showWinBack && row.days_since_last_booking !== null ? <small>ห่าง {formatCount(row.days_since_last_booking)} วัน</small> : null}
              </span>
            </PendingLink>
          ))}
        </div>
      ) : (
        <div className="soft-note">ยังไม่มีรายการในช่วงนี้</div>
      )}
    </section>
  );
}

function ServiceRoomPanel({ services, rooms }: { services: MarketingServiceRow[]; rooms: MarketingRoomRow[] }) {
  return (
    <section className="panel stack marketing-panel marketing-wide-panel">
      <SectionIntro eyebrow="บริการและห้อง" title="บริการ / ห้องที่ทำรายได้ดี" copy="ดูรายการที่สร้างรายได้สูง เพื่อช่วยวางแผนราคาและโปรโมชันต่อ" />

      <div className="marketing-subsection">
        <div className="marketing-subsection-head">
          <div className="marketing-subsection-title">
            <Scissors size={16} strokeWidth={2.1} />
            <strong>บริการยอดนิยม</strong>
          </div>
        </div>
        {services.length ? (
          <div className="marketing-table">
            <div className="marketing-table-head marketing-service-grid">
              <span>บริการ</span>
              <span>จำนวน</span>
              <span>รายได้</span>
              <span>สัดส่วน</span>
            </div>
            {services.slice(0, 6).map((service) => (
              <div key={service.service_name} className="marketing-table-row marketing-service-grid">
                <div className="marketing-table-primary">
                  <strong>{service.service_name}</strong>
                  <span>{formatCount(service.booking_count)} คิว</span>
                </div>
                <span className="marketing-table-cell" data-label="จำนวน">
                  {formatCount(service.quantity)}
                </span>
                <span className="marketing-table-cell" data-label="รายได้">
                  {formatBaht(service.revenue)}
                </span>
                <span className="marketing-table-cell" data-label="สัดส่วน">
                  {formatPercent(service.revenue_share)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="soft-note">ยังไม่มีข้อมูลบริการในช่วงนี้</div>
        )}
      </div>

      <div className="marketing-subsection">
        <div className="marketing-subsection-head">
          <div className="marketing-subsection-title">
            <Hotel size={16} strokeWidth={2.1} />
            <strong>ห้องพักยอดนิยม</strong>
          </div>
          <PendingLink className="tap-row-link" href="/rooms">
            <span>ดูห้องทั้งหมด</span>
            <span aria-hidden="true">›</span>
          </PendingLink>
        </div>
        {rooms.length ? (
          <div className="marketing-table">
            <div className="marketing-table-head marketing-room-grid">
              <span>ห้องพัก</span>
              <span>คิว</span>
              <span>คืน</span>
              <span>รายได้</span>
            </div>
            {rooms.slice(0, 6).map((room) => (
              <div key={room.room_name} className="marketing-table-row marketing-room-grid">
                <div className="marketing-table-primary">
                  <strong>{room.room_name}</strong>
                  <span>{formatPercent(room.revenue_share)} ของรายได้โรงแรม</span>
                </div>
                <span className="marketing-table-cell" data-label="คิว">
                  {formatCount(room.booking_count)}
                </span>
                <span className="marketing-table-cell" data-label="คืน">
                  {formatCount(room.nights)}
                </span>
                <span className="marketing-table-cell" data-label="รายได้">
                  {formatBaht(room.revenue)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="soft-note">ยังไม่มีข้อมูลห้องพักในช่วงนี้</div>
        )}
      </div>
    </section>
  );
}

function PaymentSignals({ items }: { items: MarketingPaymentMethodRow[] }) {
  const visibleItems = items.filter((item) => item.amount > 0);

  return (
    <section className="panel stack marketing-panel">
      <SectionIntro eyebrow="การรับเงิน" title="ช่องทางรับเงิน" copy="ดูว่าเงินเข้าช่องทางไหนมากที่สุดในช่วงที่เลือก" />

      {visibleItems.length ? (
        <div className="marketing-table">
          <div className="marketing-table-head marketing-payment-grid">
            <span>ช่องทาง</span>
            <span>ยอดเงิน</span>
            <span>สัดส่วน</span>
          </div>
          {visibleItems.map((item) => (
            <div key={item.payment_method} className="marketing-table-row marketing-payment-grid">
              <div className="marketing-table-primary">
                <strong>{paymentMethodLabels[item.payment_method] ?? item.payment_method}</strong>
              </div>
              <span className="marketing-table-cell" data-label="ยอดเงิน">
                {formatBaht(item.amount)}
              </span>
              <span className="marketing-table-cell" data-label="สัดส่วน">
                {formatPercent(item.share)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="soft-note">ยังไม่มีรายการรับเงินในช่วงนี้</div>
      )}
    </section>
  );
}

export default async function MarketingPage({
  searchParams
}: {
  searchParams?: Promise<{ mode?: string; month?: string; start?: string; end?: string; bookingType?: string }>;
}) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="stack marketing-page">
        <PageHeader title="ภาพรวมธุรกิจ" subtitle="สรุปยอดขาย คิว ลูกค้า และช่วงที่คนใช้บริการจากข้อมูลที่มีอยู่แล้ว" />
        <SetupNotice />
      </main>
    );
  }

  await requireAdmin();

  const params = (await searchParams) ?? {};
  const filters = normalizeFilters(params);
  const dashboard = await getMarketingDashboard(filters);
  const hasCompletedBookings = dashboard.summary.completed_bookings > 0;

  return (
    <main className="stack marketing-page">
      <PageHeader
        title="ภาพรวมธุรกิจ"
        subtitle="ดูยอดขาย จำนวนคิว ลูกค้าใหม่ ลูกค้ากลับมาซ้ำ และสัญญาณที่ควรดูต่อในหน้าจอเดียว"
        actionLabel="ดูรายงานการเงิน"
        actionHref="/finance/report"
      />

      <section className="panel stack marketing-toolbar" aria-labelledby="marketing-filter-title">
        <div className="marketing-toolbar-top">
          <div>
            <div className="section-kicker">
              <CalendarDays size={14} strokeWidth={2.2} />
              <span>ช่วงที่กำลังดู</span>
            </div>
            <h2 id="marketing-filter-title" className="section-title">
              {formatFilterLabel(filters)}
            </h2>
            <p className="marketing-toolbar-copy">กำลังดูบริการ: {bookingTypeLabels[filters.bookingType]}</p>
          </div>

          <div className="btn-grid marketing-toolbar-actions">
            <Link className="btn btn-secondary" href="/customers">
              รายชื่อลูกค้า
            </Link>
            <Link className="btn btn-secondary" href="/finance">
              การเงิน
            </Link>
          </div>
        </div>

        <details className="marketing-filter-details">
          <summary className="marketing-filter-summary">
            <span>ปรับช่วง / ประเภทบริการ</span>
            <span aria-hidden="true">›</span>
          </summary>

          <form className="stack marketing-filter-form" method="get">
            <div className="finance-report-mode-tabs marketing-mode-tabs">
              <Link className={`finance-report-mode-tab ${filters.mode === "range" ? "finance-report-mode-tab-active" : ""}`} href={buildSearchHref(filters, "range")}>
                ช่วงวันที่
              </Link>
              <Link className={`finance-report-mode-tab ${filters.mode === "month" ? "finance-report-mode-tab-active" : ""}`} href={buildSearchHref(filters, "month")}>
                รายเดือน
              </Link>
            </div>

            <input type="hidden" name="mode" value={filters.mode} />

            <label className="label">
              ประเภทบริการ
              <select className="select" name="bookingType" defaultValue={filters.bookingType}>
                <option value="all">ทั้งหมด</option>
                <option value="grooming">อาบน้ำ / ตัดขน</option>
                <option value="hotel">โรงแรม / ฝากเลี้ยง</option>
              </select>
            </label>

            {filters.mode === "month" ? (
              <label className="label">
                เดือน
                <input className="input" type="month" name="month" defaultValue={filters.monthValue} />
              </label>
            ) : (
              <div className="grid-2">
                <label className="label">
                  วันที่เริ่ม
                  <input className="input" type="date" name="start" defaultValue={filters.startDate} />
                </label>
                <label className="label">
                  วันที่สิ้นสุด
                  <input className="input" type="date" name="end" defaultValue={filters.endDate} />
                </label>
              </div>
            )}

            <button className="btn btn-primary" type="submit">
              ดูข้อมูลช่วงนี้
            </button>
          </form>
        </details>
      </section>

      <BusinessSnapshot summary={dashboard.summary} />

      {!hasCompletedBookings ? (
        <EmptyState
          icon={<Megaphone size={24} strokeWidth={2.1} />}
          title="ยังไม่มีคิวที่เสร็จแล้วในช่วงที่เลือก"
          description="ลองขยายช่วงวันที่ หรือเปลี่ยนประเภทบริการ เพื่อให้ระบบมีข้อมูลพอสำหรับสรุปภาพรวมธุรกิจ"
          action={
            <PendingLink className="btn btn-secondary" href="/marketing">
              กลับไปดู 90 วันล่าสุด
            </PendingLink>
          }
        />
      ) : (
        <>
          <section className="marketing-section-stack">
            <SectionIntro
              eyebrow="สุขภาพรายได้"
              title="เงินเข้าและคุณภาพคิว"
              copy="ดูยอดรับเงินจริง ค่าเฉลี่ยต่อคิว ยอดที่ยังค้าง และอัตรายกเลิกในช่วงเดียวกัน"
              icon={<Coins size={16} strokeWidth={2.1} />}
            />
            <section className="marketing-kpi-grid marketing-secondary-kpi-grid">
              <MetricCard
                label="รับเงินแล้ว"
                value={formatBaht(dashboard.summary.income_collected)}
                tone="success"
                detail="อิงจากรายการรับเงินที่บันทึกไว้จริง"
                icon={<Coins size={18} strokeWidth={2.1} />}
              />
              <MetricCard
                label="เฉลี่ยต่อคิว"
                value={formatBaht(dashboard.summary.average_order_value)}
                detail="รายได้เฉลี่ยของคิวที่เสร็จแล้ว"
                icon={<BarChart3 size={18} strokeWidth={2.1} />}
              />
              <MetricCard
                label="รอเก็บเงิน"
                value={`${formatCount(dashboard.summary.pending_payment_count)} คิว`}
                tone={dashboard.summary.pending_payment_count > 0 ? "warning" : "success"}
                detail={`${formatBaht(dashboard.summary.pending_payment_amount)} ที่ยังเก็บไม่ครบ`}
                icon={<CreditCard size={18} strokeWidth={2.1} />}
              />
              <MetricCard
                label="คิวยกเลิก"
                value={formatPercent(dashboard.summary.cancellation_rate)}
                tone={dashboard.summary.cancellation_rate >= 0.15 ? "danger" : "warning"}
                detail="เทียบคิวที่ยกเลิกกับคิวทั้งหมดในช่วงนี้"
                icon={<TriangleAlert size={18} strokeWidth={2.1} />}
              />
            </section>
            <PaymentSignals items={dashboard.payment_methods} />
          </section>

          <section className="marketing-section-stack">
            <SectionIntro
              eyebrow="ความต้องการ"
              title="ลูกค้ามาใช้บริการช่วงไหน"
              copy="ดูประเภทบริการ วันที่ขายดี และช่วงเวลาที่มีคิวมาก เพื่อช่วยจัดคนและโปรโมชัน"
              icon={<Clock3 size={16} strokeWidth={2.1} />}
            />
            <section className="marketing-grid marketing-demand-grid">
              <BookingMixPanel items={dashboard.booking_mix} groomingBookings={dashboard.summary.grooming_bookings} hotelBookings={dashboard.summary.hotel_bookings} />
              <InsightBars title="วันที่ขายดี" subtitle="คิวตามวันในสัปดาห์" description="ดูว่าวันไหนมีคิวและรายได้มากกว่ากัน" items={dashboard.weekday_demand} />
              <InsightBars title="เวลาขายดี" subtitle="คิวตามช่วงเวลา" description="ดูช่วงเวลาที่ลูกค้ามาใช้บริการมากที่สุด" items={dashboard.hour_demand} />
            </section>
          </section>

          <section className="marketing-section-stack">
            <SectionIntro
              eyebrow="ลูกค้า"
              title="ลูกค้าและการกลับมาใช้บริการ"
              copy="ดูจำนวนลูกค้าเก่า ลูกค้าที่มาซ้ำ และรายชื่อที่ควรดูแลต่อ"
              icon={<Users size={16} strokeWidth={2.1} />}
            />
            <section className="marketing-kpi-grid marketing-secondary-kpi-grid">
              <MetricCard
                label="ลูกค้าเก่า"
                value={`${formatCount(dashboard.summary.returning_customers)} คน`}
                detail="ลูกค้าที่กลับมาใช้บริการและไม่ได้ถูกสร้างใหม่ในช่วงนี้"
                icon={<Users size={18} strokeWidth={2.1} />}
              />
              <MetricCard
                label="ลูกค้าที่มาซ้ำ"
                value={`${formatCount(dashboard.summary.repeat_customers)} คน`}
                tone="success"
                detail={`คิดเป็น ${formatPercent(dashboard.summary.repeat_rate)} ของลูกค้าที่มาใช้บริการ`}
                icon={<Repeat2 size={18} strokeWidth={2.1} />}
              />
              <MetricCard
                label="ควรตามกลับ"
                value={`${formatCount(dashboard.win_back_customers.length)} คน`}
                tone={dashboard.win_back_customers.length > 0 ? "warning" : "success"}
                detail="ลูกค้าที่หายไปเกิน 30 วันและน่าติดต่อดูแลต่อ"
                icon={<Megaphone size={18} strokeWidth={2.1} />}
              />
            </section>

            <section className="marketing-action-grid">
              <CustomerActionTable
                title="ลูกค้าควรดูแลต่อ"
                subtitle="ลูกค้าที่หายไปนาน"
                description="เริ่มจากกลุ่มนี้ถ้าต้องการโทรหรือทักกลับ"
                rows={dashboard.win_back_customers}
                showWinBack
              />
              <CustomerActionTable
                title="ลูกค้ามูลค่าสูง"
                subtitle="ใช้บริการมากสุดตามยอดเงิน"
                description="ลูกค้าที่สร้างรายได้สูงในช่วงที่เลือก"
                rows={dashboard.top_customers_by_spend}
              />
              <CustomerActionTable
                title="ลูกค้าที่มาบ่อย"
                subtitle="ใช้บริการถี่ที่สุด"
                description="ลูกค้าที่กลับมาใช้บริการหลายครั้งในช่วงนี้"
                rows={dashboard.top_customers_by_frequency}
              />
            </section>

            <section className="marketing-single-panel-grid">
              <CustomerActionTable
                title="ลูกค้าเสี่ยงหาย"
                subtitle="เคยใช้บ่อยแต่เงียบไป"
                description="ลูกค้าที่เคยใช้บริการหลายครั้งและห่างไปนาน ควรดูแลก่อนหลุดไป"
                rows={dashboard.at_risk_customers}
                showWinBack
              />
            </section>
          </section>

          <section className="marketing-section-stack">
            <SectionIntro
              eyebrow="บริการและห้อง"
              title="อะไรขายดีในช่วงนี้"
              copy="ดูประเภทสัตว์ สายพันธุ์ บริการ และห้องพักที่พบมาก เพื่อช่วยวางแผนร้าน"
              icon={<Scissors size={16} strokeWidth={2.1} />}
            />
            <section className="marketing-grid">
              <MixChips
                eyebrow="ประเภทสัตว์"
                title="สัตว์ที่มาใช้บริการ"
                description="ดูว่าสัตว์ประเภทไหนเข้าร้านมากที่สุด"
                items={dashboard.species_mix}
                valueLabel="ตัว"
                emptyText="ยังไม่มีข้อมูลประเภทสัตว์ในช่วงนี้"
              />
              <MixChips
                eyebrow="สายพันธุ์"
                title="สายพันธุ์ที่พบบ่อย"
                description="ช่วยดูแนวโน้มลูกค้าและบริการที่อาจต้องเตรียมเพิ่ม"
                items={dashboard.breed_mix}
                valueLabel="ตัว"
                emptyText="ยังไม่มีข้อมูลสายพันธุ์ในช่วงนี้"
              />
              <ServiceRoomPanel services={dashboard.top_services} rooms={dashboard.top_rooms} />
            </section>
          </section>
        </>
      )}
    </main>
  );
}
