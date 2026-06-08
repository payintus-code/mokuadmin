import { format, parse } from "date-fns";
import { th } from "date-fns/locale";
import { BarChart3, Clock3, Coins, CreditCard, Hotel, Megaphone, Repeat2, Scissors, TriangleAlert, Users } from "lucide-react";
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
import type { MarketingBookingTypeFilter, MarketingCustomerRow, MarketingDashboardFilters, MarketingDemandBucket, MarketingMixRow, MarketingPaymentMethodRow, MarketingRoomRow, MarketingServiceRow } from "@/types/database";

export const dynamic = "force-dynamic";

const paymentMethodLabels: Record<string, string> = {
  cash: "Cash",
  promptpay_qr: "PromptPay QR",
  transfer: "Transfer",
  card: "Card",
  other: "Other"
};

const bookingTypeLabels: Record<MarketingBookingTypeFilter, string> = {
  all: "ทุกประเภท",
  grooming: "Grooming",
  hotel: "Hotel"
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

function formatFilterLabel(filters: MarketingDashboardFilters & { monthValue: string }) {
  if (filters.mode === "month") {
    const parsed = parse(`${filters.monthValue}-01`, "yyyy-MM-dd", new Date());
    return format(parsed, "MMMM yyyy", { locale: th });
  }

  return `${filters.startDate} - ${filters.endDate}`;
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

function InsightBars({ title, subtitle, items }: { title: string; subtitle: string; items: MarketingDemandBucket[] }) {
  return (
    <section className="panel stack marketing-panel">
      <div className="frontdesk-section-heading">
        <div>
          <div className="section-kicker">{title}</div>
          <h2 className="section-title">{subtitle}</h2>
        </div>
      </div>

      <div className="marketing-bar-list">
        {items.map((item) => (
          <div key={item.key} className="marketing-bar-row">
            <div className="marketing-bar-labels">
              <strong>{item.label}</strong>
              <span>{formatCount(item.booking_count)} bookings</span>
            </div>
            <div className="marketing-bar-track" aria-hidden="true">
              <div className="marketing-bar-fill" style={{ width: `${Math.max(item.share_of_bookings * 100, item.booking_count ? 6 : 0)}%` }} />
            </div>
            <div className="marketing-bar-meta">
              <span>{formatPercent(item.share_of_bookings)}</span>
              <span>{formatBaht(item.revenue)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MixChips({ title, items }: { title: string; items: MarketingMixRow[] }) {
  return (
    <section className="panel stack marketing-panel">
      <div className="frontdesk-section-heading">
        <div>
          <div className="section-kicker">Segments</div>
          <h2 className="section-title">{title}</h2>
        </div>
      </div>

      <div className="marketing-chip-grid">
        {items.length ? (
          items.map((item) => (
            <div key={item.key} className="marketing-chip-card">
              <strong>{item.label}</strong>
              <span>{formatCount(item.count)} records</span>
              <small>{formatPercent(item.share)}</small>
            </div>
          ))
        ) : (
          <div className="soft-note">ยังไม่มีข้อมูลในช่วงที่เลือก</div>
        )}
      </div>
    </section>
  );
}

function CustomerActionTable({
  title,
  subtitle,
  rows,
  showWinBack = false
}: {
  title: string;
  subtitle: string;
  rows: MarketingCustomerRow[];
  showWinBack?: boolean;
}) {
  return (
    <section className="panel stack marketing-panel">
      <div className="frontdesk-section-heading">
        <div>
          <div className="section-kicker">{title}</div>
          <h2 className="section-title">{subtitle}</h2>
        </div>
      </div>

      {rows.length ? (
        <div className="marketing-table">
          <div className="marketing-table-head marketing-customer-grid">
            <span>Customer</span>
            <span>Visits</span>
            <span>Spend</span>
            <span>Last seen</span>
          </div>

          {rows.map((row) => (
            <PendingLink key={row.customer_id} href={`/customers/${row.customer_id}`} className="marketing-table-row marketing-customer-grid">
              <div className="marketing-table-primary">
                <strong>{row.customer_name}</strong>
                <span>{row.pet_summary}</span>
                {showWinBack && row.win_back_segment ? (
                  <div className="marketing-badge-row">
                    <span className={`marketing-badge marketing-badge-${row.win_back_segment}`}>{row.win_back_segment}</span>
                    {row.is_at_risk ? <span className="marketing-badge marketing-badge-risk">at risk</span> : null}
                  </div>
                ) : null}
              </div>
              <span>{formatCount(row.booking_count)}</span>
              <span>{formatBaht(row.total_spend)}</span>
              <span>
                {row.last_booking_at ? row.last_booking_at.slice(0, 10) : "-"}
                {showWinBack && row.days_since_last_booking !== null ? <small>{row.days_since_last_booking} days</small> : null}
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
    <section className="panel stack marketing-panel">
      <div className="frontdesk-section-heading">
        <div>
          <div className="section-kicker">Top performers</div>
          <h2 className="section-title">Top services / rooms</h2>
        </div>
      </div>

      <div className="marketing-subsection">
        <div className="marketing-subsection-head">
          <Scissors size={16} strokeWidth={2.1} />
          <strong>Services</strong>
        </div>
        {services.length ? (
          <div className="marketing-table">
            <div className="marketing-table-head marketing-service-grid">
              <span>Service</span>
              <span>Qty</span>
              <span>Revenue</span>
              <span>Share</span>
            </div>
            {services.slice(0, 6).map((service) => (
              <div key={service.service_name} className="marketing-table-row marketing-service-grid">
                <div className="marketing-table-primary">
                  <strong>{service.service_name}</strong>
                  <span>{formatCount(service.booking_count)} bookings</span>
                </div>
                <span>{formatCount(service.quantity)}</span>
                <span>{formatBaht(service.revenue)}</span>
                <span>{formatPercent(service.revenue_share)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="soft-note">ยังไม่มี service mix สำหรับช่วงนี้</div>
        )}
      </div>

      <div className="marketing-subsection">
        <div className="marketing-subsection-head">
          <Hotel size={16} strokeWidth={2.1} />
          <strong>Rooms</strong>
          <PendingLink className="tap-row-link" href="/rooms">
            <span>ดูห้องทั้งหมด</span>
            <span aria-hidden="true">›</span>
          </PendingLink>
        </div>
        {rooms.length ? (
          <div className="marketing-table">
            <div className="marketing-table-head marketing-room-grid">
              <span>Room</span>
              <span>Bookings</span>
              <span>Nights</span>
              <span>Revenue</span>
            </div>
            {rooms.slice(0, 6).map((room) => (
              <div key={room.room_name} className="marketing-table-row marketing-room-grid">
                <div className="marketing-table-primary">
                  <strong>{room.room_name}</strong>
                  <span>{formatPercent(room.revenue_share)} of hotel revenue</span>
                </div>
                <span>{formatCount(room.booking_count)}</span>
                <span>{formatCount(room.nights)}</span>
                <span>{formatBaht(room.revenue)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="soft-note">ยังไม่มี room mix สำหรับช่วงนี้</div>
        )}
      </div>
    </section>
  );
}

function PaymentSignals({ items }: { items: MarketingPaymentMethodRow[] }) {
  return (
    <section className="panel stack marketing-panel">
      <div className="frontdesk-section-heading">
        <div>
          <div className="section-kicker">Payments</div>
          <h2 className="section-title">Payment method mix</h2>
        </div>
      </div>

      <div className="marketing-table">
        <div className="marketing-table-head marketing-payment-grid">
          <span>Method</span>
          <span>Amount</span>
          <span>Share</span>
        </div>
        {items.map((item) => (
          <div key={item.payment_method} className="marketing-table-row marketing-payment-grid">
            <div className="marketing-table-primary">
              <strong>{paymentMethodLabels[item.payment_method] ?? item.payment_method}</strong>
            </div>
            <span>{formatBaht(item.amount)}</span>
            <span>{formatPercent(item.share)}</span>
          </div>
        ))}
      </div>
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
      <main className="stack">
        <PageHeader title="Marketing Insights" subtitle="ดูสัญญาณลูกค้า การกลับมาใช้ซ้ำ demand และ payment mix จากข้อมูลที่มีอยู่แล้ว" />
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
    <main className="stack">
      <PageHeader
        title="Marketing Insights"
        subtitle="ภาพรวมเชิงการตลาดสำหรับผู้บริหาร: ลูกค้าใหม่-เก่า รีเทนชัน demand บริการเด่น และสัญญาณการติดตามต่อ"
        actionLabel="ดูรายงานการเงิน"
        actionHref="/finance/report"
      />

      <section className="panel stack marketing-toolbar">
        <div className="marketing-toolbar-top">
          <div>
            <div className="section-kicker">
              <Megaphone size={14} strokeWidth={2.2} />
              <span>Filter</span>
            </div>
            <h2 className="section-title" style={{ marginTop: 8 }}>
              {formatFilterLabel(filters)}
            </h2>
            <p className="marketing-toolbar-copy">กำลังดู {bookingTypeLabels[filters.bookingType]} เพื่ออ่านภาพรวม demand, repeat behavior และ action list ที่ควรทำต่อ</p>
          </div>

          <div className="btn-grid">
            <Link className="btn btn-secondary" href="/customers">
              รายชื่อลูกค้า
            </Link>
            <Link className="btn btn-secondary" href="/finance">
              การเงิน
            </Link>
          </div>
        </div>

        <form className="stack" method="get">
          <div className="finance-report-mode-tabs">
            <Link className={`finance-report-mode-tab ${filters.mode === "range" ? "finance-report-mode-tab-active" : ""}`} href={buildSearchHref(filters, "range")}>
              ช่วงวันที่
            </Link>
            <Link className={`finance-report-mode-tab ${filters.mode === "month" ? "finance-report-mode-tab-active" : ""}`} href={buildSearchHref(filters, "month")}>
              รายเดือน
            </Link>
          </div>

          <input type="hidden" name="mode" value={filters.mode} />

          <label className="label">
            ประเภท booking
            <select className="select" name="bookingType" defaultValue={filters.bookingType}>
              <option value="all">ทุกประเภท</option>
              <option value="grooming">Grooming</option>
              <option value="hotel">Hotel</option>
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
            อัปเดต dashboard
          </button>
        </form>
      </section>

      <section className="marketing-kpi-grid">
        <MetricCard
          label="ลูกค้าใหม่"
          value={formatCount(dashboard.summary.new_customers)}
          detail="ลูกค้าที่ถูกสร้างในช่วงนี้และมี completed booking ตาม filter"
          icon={<Users size={18} strokeWidth={2.1} />}
        />
        <MetricCard
          label="ลูกค้าที่ใช้งาน"
          value={formatCount(dashboard.summary.active_customers)}
          detail="จำนวนลูกค้าที่มี completed booking ในช่วงนี้"
          icon={<BarChart3 size={18} strokeWidth={2.1} />}
        />
        <MetricCard
          label="Repeat customers"
          value={formatCount(dashboard.summary.repeat_customers)}
          tone="success"
          detail={`คิดเป็น ${formatPercent(dashboard.summary.repeat_rate)} ของลูกค้าที่ใช้งาน`}
          icon={<Repeat2 size={18} strokeWidth={2.1} />}
        />
        <MetricCard
          label="Completed bookings"
          value={formatCount(dashboard.summary.completed_bookings)}
          detail="ฐานหลักสำหรับการอ่าน demand และ performance"
          icon={<Clock3 size={18} strokeWidth={2.1} />}
        />
        <MetricCard
          label="Revenue from bookings"
          value={formatBaht(dashboard.summary.revenue)}
          tone="success"
          detail="ใช้ยอด booking total_amount สำหรับมุมมอง marketing"
          icon={<Coins size={18} strokeWidth={2.1} />}
        />
        <MetricCard
          label="Average order value"
          value={formatBaht(dashboard.summary.average_order_value)}
          detail="รายได้เฉลี่ยต่อ completed booking"
          icon={<BarChart3 size={18} strokeWidth={2.1} />}
        />
        <MetricCard
          label="Cancellation rate"
          value={formatPercent(dashboard.summary.cancellation_rate)}
          tone={dashboard.summary.cancellation_rate >= 0.15 ? "danger" : "warning"}
          detail="เทียบ booking cancelled กับ booking ทั้งหมดในช่วง"
          icon={<TriangleAlert size={18} strokeWidth={2.1} />}
        />
        <MetricCard
          label="Pending payment"
          value={formatCount(dashboard.summary.pending_payment_count)}
          tone={dashboard.summary.pending_payment_count > 0 ? "warning" : "success"}
          detail={`${formatBaht(dashboard.summary.pending_payment_amount)} ที่ยังเก็บไม่ครบ`}
          icon={<CreditCard size={18} strokeWidth={2.1} />}
        />
      </section>

      {!hasCompletedBookings ? (
        <EmptyState
          icon={<Megaphone size={24} strokeWidth={2.1} />}
          title="ยังไม่มี completed booking ในช่วงที่เลือก"
          description="ลองขยายช่วงวันที่หรือเปลี่ยน filter ประเภท booking เพื่อดู insight เพิ่มเติม"
          action={
            <PendingLink className="btn btn-secondary" href="/marketing">
              กลับค่าเริ่มต้น 90 วัน
            </PendingLink>
          }
        />
      ) : (
        <>
          <section className="marketing-grid">
            <section className="panel stack marketing-panel">
              <div className="frontdesk-section-heading">
                <div>
                  <div className="section-kicker">Demand & mix</div>
                  <h2 className="section-title">Booking mix</h2>
                </div>
              </div>

              <div className="marketing-chip-grid">
                {dashboard.booking_mix.map((item) => (
                  <div key={item.key} className="marketing-chip-card">
                    <strong>{item.label}</strong>
                    <span>{formatCount(item.count)} bookings</span>
                    <small>{formatPercent(item.share)}</small>
                  </div>
                ))}
              </div>

              <div className="soft-note">
                Grooming {formatCount(dashboard.summary.grooming_bookings)} รายการ และ Hotel {formatCount(dashboard.summary.hotel_bookings)} รายการในช่วงนี้
              </div>
            </section>

            <InsightBars title="Demand" subtitle="Weekday demand" items={dashboard.weekday_demand} />
            <InsightBars title="Demand" subtitle="Hour demand" items={dashboard.hour_demand} />
          </section>

          <section className="marketing-grid">
            <MixChips title="Species mix" items={dashboard.species_mix} />
            <MixChips title="Breed mix" items={dashboard.breed_mix} />
            <PaymentSignals items={dashboard.payment_methods} />
          </section>

          <section className="marketing-kpi-grid">
            <MetricCard
              label="Returning customers"
              value={formatCount(dashboard.summary.returning_customers)}
              detail="ลูกค้าที่กลับมาใช้บริการและไม่ได้ถูกสร้างใหม่ในช่วงนี้"
              icon={<Users size={18} strokeWidth={2.1} />}
            />
            <MetricCard
              label="Income collected"
              value={formatBaht(dashboard.summary.income_collected)}
              tone="success"
              detail="อิง cash_transactions ฝั่ง income เพื่อดูเงินที่รับจริง"
              icon={<Coins size={18} strokeWidth={2.1} />}
            />
            <MetricCard
              label="Win-back candidates"
              value={formatCount(dashboard.win_back_customers.length)}
              tone={dashboard.win_back_customers.length > 0 ? "warning" : "success"}
              detail="รายชื่อลูกค้าที่หายไปเกิน 30 วันและควรติดตาม"
              icon={<Megaphone size={18} strokeWidth={2.1} />}
            />
          </section>

          <section className="marketing-action-grid">
            <CustomerActionTable title="Action list" subtitle="Win-back customers" rows={dashboard.win_back_customers} showWinBack />
            <CustomerActionTable title="Top customers" subtitle="Highest spend this period" rows={dashboard.top_customers_by_spend} />
            <ServiceRoomPanel services={dashboard.top_services} rooms={dashboard.top_rooms} />
          </section>

          <section className="marketing-grid">
            <CustomerActionTable title="Frequent" subtitle="Most frequent customers this period" rows={dashboard.top_customers_by_frequency} />
            <CustomerActionTable title="At risk" subtitle="High-usage customers who have gone quiet" rows={dashboard.at_risk_customers} showWinBack />
          </section>
        </>
      )}
    </main>
  );
}
