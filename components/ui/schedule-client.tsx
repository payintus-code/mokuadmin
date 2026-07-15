"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingQuickActions } from "@/components/ui/booking-quick-actions";
import { ScheduleCalendar, type ScheduleCalendarVariant } from "@/components/ui/schedule-calendar";
import { ScheduleListItem } from "@/components/ui/schedule-list-item";
import { formatDate } from "@/lib/format";
import { scheduleWorkFilterLabels, type ScheduleWorkFilter } from "@/lib/frontdesk-work";
import type { BookingType } from "@/types/database";
import type { ScheduleViewModel } from "@/lib/schedule-view";

const bookingTypeLabel = {
  grooming: "อาบน้ำ / ตัดขน",
  hotel: "โรงแรม"
} as const;

function buildScheduleHref(
  query: {
    month?: string;
    date?: string;
    filters?: string;
    grooming?: string;
    hotel?: string;
    work?: string;
  } = {},
  pathname = "/schedule"
) {
  return {
    pathname,
    query
  };
}

function buildSharedQuery(data: ScheduleViewModel) {
  return {
    filters: data.useCustomFilters ? "custom" : undefined,
    grooming: data.groomingEnabled ? "1" : undefined,
    hotel: data.hotelEnabled ? "1" : undefined,
    work: data.workFilter !== "all" ? data.workFilter : undefined
  };
}

function ScheduleDataLoading() {
  return (
    <div className="stack schedule-data-loading" aria-busy="true">
      <section className="panel stack schedule-month-overview-panel">
        <div className="loading-line loading-line-title" />
        <div className="loading-line loading-line-copy" />
        <div className="loading-line loading-line-copy" />
      </section>

      <section className="panel stack">
        <div className="loading-line loading-line-title" />
        <div className="loading-card" />
      </section>

      <section className="stack schedule-selected-day-list">
        <div className="loading-row" />
        <div className="loading-row" />
        <div className="loading-row" />
      </section>
    </div>
  );
}

export function ScheduleClient({
  queryString,
  initialData,
  calendarVariant = "summary"
}: {
  queryString: string;
  initialData?: ScheduleViewModel;
  calendarVariant?: ScheduleCalendarVariant;
}) {
  const initialDataUrl = queryString ? `/schedule/data?${queryString}` : "/schedule/data";
  const [response, setResponse] = useState<{ data: ScheduleViewModel | null; error: string; url: string }>({
    data: initialData ?? null,
    error: "",
    url: initialData ? initialDataUrl : ""
  });
  const dataUrl = useMemo(() => (queryString ? `/schedule/data?${queryString}` : "/schedule/data"), [queryString]);
  const data = response.data;
  const isLoading = response.url !== dataUrl;
  const error = response.url === dataUrl ? response.error : "";

  useEffect(() => {
    if (response.url === dataUrl) {
      return;
    }

    const controller = new AbortController();

    fetch(dataUrl, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]),
      headers: {
        Accept: "application/json"
      }
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load schedule (${response.status})`);
        }

        return (await response.json()) as ScheduleViewModel;
      })
      .then((nextData) => {
        setResponse({
          data: nextData,
          error: "",
          url: dataUrl
        });
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setResponse((current) => ({
          data: current.data,
          error: fetchError instanceof Error ? fetchError.message : "Unable to load schedule",
          url: dataUrl
        }));
      });

    return () => controller.abort();
  }, [dataUrl, response.url]);

  if (!data && isLoading) {
    return <ScheduleDataLoading />;
  }

  if (!data && error) {
    return (
      <section className="panel stack">
        <div>
          <div className="section-kicker">Schedule</div>
          <h2 className="section-title">โหลดตารางคิวไม่สำเร็จ</h2>
        </div>
        <div className="soft-note">{error}</div>
        <button className="btn btn-secondary" type="button" onClick={() => window.location.reload()}>
          โหลดใหม่
        </button>
      </section>
    );
  }

  if (!data) {
    return null;
  }

  const sharedQuery = buildSharedQuery(data);
  const activeTypeText = data.activeTypes.length
    ? data.activeTypes.map((type: BookingType) => bookingTypeLabel[type]).join(" / ")
    : "ไม่มีประเภทที่เลือก";
  const isMonthCalendar = calendarVariant === "queue";
  const currentSchedulePath = isMonthCalendar ? "/schedule/month" : "/schedule";

  return (
    <div className={isLoading ? "stack schedule-data-refreshing" : "stack"}>
      {isLoading ? <div className="soft-note schedule-refresh-note">กำลังอัปเดตตารางคิว...</div> : null}

      <section className="panel stack schedule-month-overview-panel">
        <div className="schedule-month-nav">
          <Link
            className="btn btn-secondary"
            href={buildScheduleHref({
              month: data.prevMonth,
              ...sharedQuery
            }, currentSchedulePath)}
          >
            เดือนก่อน
          </Link>
          <div className="schedule-month-title">{data.monthTitle}</div>
          <Link
            className="btn btn-secondary"
            href={buildScheduleHref({
              month: data.nextMonth,
              ...sharedQuery
            }, currentSchedulePath)}
          >
            เดือนถัดไป
          </Link>
        </div>

        <form
          key={`${data.selectedMonthKey}-${data.selectedDateKey}-${data.groomingEnabled}-${data.hotelEnabled}`}
          className="stack schedule-mobile-hidden"
          method="get"
        >
          <input type="hidden" name="month" value={data.selectedMonthKey} />
          <input type="hidden" name="date" value={data.selectedDateKey} />
          <input type="hidden" name="filters" value="custom" />

          <div className="schedule-filter-row">
            <label className="schedule-toggle">
              <input type="checkbox" name="grooming" value="1" defaultChecked={data.groomingEnabled} />
              <span>อาบน้ำ / ตัดขน</span>
            </label>
            <label className="schedule-toggle">
              <input type="checkbox" name="hotel" value="1" defaultChecked={data.hotelEnabled} />
              <span>โรงแรม</span>
            </label>
          </div>

          <div className="schedule-filter-actions">
            <button className="btn btn-primary" type="submit">
              แสดงผล
            </button>
            <Link className="btn btn-secondary" href={currentSchedulePath}>
              รีเซ็ตตัวกรอง
            </Link>
          </div>
        </form>

        <div className="soft-note schedule-mobile-hidden">กำลังแสดง: {activeTypeText}</div>

        <div className="schedule-filter-actions schedule-view-switch-actions">
          <Link
            className="btn btn-secondary"
            href={buildScheduleHref({
              month: data.currentMonth,
              date: data.currentDate,
              ...sharedQuery
            }, currentSchedulePath)}
          >
            วันนี้
          </Link>
          <Link
            className="btn btn-secondary"
            href={buildScheduleHref({
              month: data.selectedMonthKey,
              date: data.selectedDateKey,
              ...sharedQuery
            }, isMonthCalendar ? "/schedule" : "/schedule/month")}
          >
            {isMonthCalendar ? "รายการรายวัน" : "ปฏิทินเดือน"}
          </Link>
        </div>
      </section>

      <ScheduleCalendar
        cells={data.cells}
        groomingEnabled={data.groomingEnabled}
        hotelEnabled={data.hotelEnabled}
        useCustomFilters={data.useCustomFilters}
        workFilter={data.workFilter}
        variant={calendarVariant}
      />

      {!isMonthCalendar ? (
        <>
      <section className="panel stack schedule-mobile-hidden">
        <div className="frontdesk-section-heading">
          <div>
            <div className="section-kicker">Daily filters</div>
            <h2 className="section-title">มุมมองงานของวันที่เลือก</h2>
          </div>
        </div>

        <div className="work-filter-tabs">
          {(Object.keys(scheduleWorkFilterLabels) as ScheduleWorkFilter[]).map((filter) => (
            <Link
              key={filter}
              className={filter === data.workFilter ? "work-filter-tab work-filter-tab-active" : "work-filter-tab"}
              href={buildScheduleHref({
                month: data.selectedMonthKey,
                date: data.selectedDateKey,
                filters: data.useCustomFilters ? "custom" : undefined,
                grooming: data.groomingEnabled ? "1" : undefined,
                hotel: data.hotelEnabled ? "1" : undefined,
                work: filter === "all" ? undefined : filter
              })}
            >
              {scheduleWorkFilterLabels[filter]}
            </Link>
          ))}
        </div>
      </section>

      {data.selectedRiskAlerts.length ? (
        <section className="panel stack schedule-mobile-hidden">
          <div>
            <div className="section-kicker">Risk Alerts</div>
            <h2 className="section-title">งานที่ควรเช็กในวันที่เลือก</h2>
          </div>
          <div className="work-alert-grid">
            {data.selectedRiskAlerts.map((alert) => (
              <article key={alert.key} className={`work-alert-card work-alert-card-${alert.tone}`}>
                <div>
                  <strong>{alert.title}</strong>
                  <div className="muted">{alert.description}</div>
                </div>
                <Link className="tap-row-link" href={`/bookings/${alert.item.booking_id}`}>
                  <span>เปิดคิว</span>
                  <span aria-hidden="true">›</span>
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel stack schedule-mobile-hidden">
        <div>
          <div className="section-kicker">Today Work Queue</div>
          <h2 className="section-title">กลุ่มงานของวันที่เลือก</h2>
        </div>
        <div className="work-queue-grid">
          {data.selectedWorkQueue.map((bucket) => (
            <section key={bucket.key} className="work-queue-column">
              <div className="work-queue-head">
                <div>
                  <strong>{bucket.title}</strong>
                  <p>{bucket.description}</p>
                </div>
                <span>{bucket.items.length}</span>
              </div>
              {bucket.items.length ? (
                <div className="stack">
                  {bucket.items.slice(0, 3).map((item) => (
                    <article key={`${bucket.key}-${item.booking_id}`} className="work-queue-item">
                      <div className="work-queue-item-top">
                        <div>
                          <strong>
                            {formatDate(item.start_at, "HH.mm")} {item.pet_name}
                          </strong>
                          <div className="muted">{item.customer_name}</div>
                        </div>
                      </div>
                      <BookingQuickActions
                        bookingId={item.booking_id}
                        status={item.status}
                        paymentStatus={item.payment_status}
                        customerPhone={item.customer_phone}
                        showStatusAction={false}
                        showCall={false}
                        showDetail={false}
                        showRepeat={false}
                        showReceipt={false}
                        compact
                      />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="soft-note">ไม่มีรายการ</div>
              )}
            </section>
          ))}
        </div>
      </section>

      <section className="panel stack schedule-mobile-day-summary">
        <div>
          <div className="section-kicker">Daily Summary</div>
          <h2 className="section-title">สรุปรายการวันที่เลือก</h2>
        </div>
        <div className="schedule-day-summary-grid">
          <div className="meta-block">
            <div className="meta-label">โรงแรม</div>
            <div className="meta-value">{data.selectedTypeSummary.hotel} คิว</div>
          </div>
          <div className="meta-block">
            <div className="meta-label">อาบน้ำ</div>
            <div className="meta-value">{data.selectedTypeSummary.grooming} คิว</div>
          </div>
        </div>
      </section>

      <section className="stack schedule-selected-day-list">
        {data.visibleSelectedItems.length ? (
          data.visibleSelectedItems.map((item) => (
            <div key={`${data.selectedDateKey}-${item.booking_id}`} className="schedule-work-item stack">
              <ScheduleListItem item={item} />
              <BookingQuickActions
                bookingId={item.booking_id}
                status={item.status}
                paymentStatus={item.payment_status}
                customerPhone={item.customer_phone}
                showStatusAction={false}
                showCall={false}
                showDetail={false}
                showRepeat={false}
                showReceipt={false}
                compact
              />
            </div>
          ))
        ) : (
          <EmptyState
            icon={<CalendarDays size={24} strokeWidth={2.1} />}
            title="ไม่มีคิวในวันที่เลือก"
            description="ลองเปลี่ยนวันหรือเปิดประเภทคิวเพิ่มเติมเพื่อดูรายการที่เกี่ยวข้อง"
            action={
              <Link className="btn btn-primary" href="/bookings/new">
                สร้างคิวใหม่
              </Link>
            }
          />
        )}
      </section>
        </>
      ) : null}
    </div>
  );
}
