"use client";

import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { dateKey, eventDateKey, zoomScheduleLevel, type ScheduleZoomLevel, type TimedEventLayout } from "@/lib/zoomable-schedule-core";
import { formatBaht, formatDate, formatTime } from "@/lib/format";
import type { ZoomableScheduleViewModel } from "@/lib/zoomable-schedule";
import type { DailyScheduleItem } from "@/types/database";

const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const hours = Array.from({ length: 24 }, (_, index) => index);
const minuteHeight = 0.9;
const timelineHeight = 24 * 60 * minuteHeight;
const viewLabels: Record<ScheduleZoomLevel, string> = { month: "เดือน", week: "สัปดาห์", day: "วัน" };

function eventStyle(event: TimedEventLayout): CSSProperties {
  const width = 100 / event.columns;
  return { top: event.startMinute * minuteHeight + 2, height: Math.max(44, (event.endMinute - event.startMinute) * minuteHeight - 4), left: `calc(${event.column * width}% + 3px)`, width: `calc(${width}% - 6px)` };
}

function MonthView({ data, onOpenDate }: { data: ZoomableScheduleViewModel; onOpenDate: (date: string) => void }) {
  return <section className="zoom-month-card" aria-label={data.title}><div className="zoom-month-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div><div className="zoom-month-grid">{data.monthCells.map((cell) => <button key={cell.date} type="button" data-schedule-date={cell.date} className={`zoom-month-day${cell.inCurrentMonth ? "" : " is-outside"}${cell.isToday ? " is-today" : ""}`} onClick={() => onOpenDate(cell.date)} aria-label={`${formatDate(cell.date)} ${cell.totalCount} คิว`}><span className="zoom-month-number">{Number(cell.date.slice(-2))}</span><span className="zoom-month-count">{cell.totalCount || ""}</span><span className="zoom-month-dots">{cell.groomingCount ? <i className="is-grooming" /> : null}{cell.hotelCount ? <i className="is-hotel" /> : null}</span>{cell.totalCount ? <small>{cell.totalCount} คิว</small> : null}</button>)}</div></section>;
}

function HotelLane({ data, onSelect }: { data: ZoomableScheduleViewModel; onSelect: (event: DailyScheduleItem) => void }) {
  if (!data.hotelEvents.length) return null;
  const first = data.dayKeys[0];
  const last = data.dayKeys.at(-1) ?? first;
  return <section className="zoom-hotel-lane"><div className="zoom-time-gutter-label">พัก</div><div className="zoom-hotel-grid" style={{ gridTemplateColumns: `repeat(${data.dayKeys.length}, minmax(0, 1fr))` }}>{data.hotelEvents.map((event) => { const start = eventDateKey(event.start_at) < first ? first : eventDateKey(event.start_at); const endRaw = eventDateKey(new Date(new Date(event.end_at).getTime() - 1).toISOString()); const end = endRaw > last ? last : endRaw; const startColumn = Math.max(1, data.dayKeys.indexOf(start) + 1); const endColumn = Math.max(startColumn + 1, data.dayKeys.indexOf(end) + 2); return <button key={event.booking_id} type="button" className="zoom-hotel-event" style={{ gridColumn: `${startColumn} / ${endColumn}` }} onClick={() => onSelect(event)}><strong>{event.pet_name}</strong><span>{event.room_name || "โรงแรม"}</span></button>; })}</div></section>;
}

function TimelineView({ data, onSelect, onOpenDay }: { data: ZoomableScheduleViewModel; onSelect: (event: DailyScheduleItem) => void; onOpenDay: (date: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const nowKey = dateKey(now);
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  useLayoutEffect(() => {
    const first = data.timedEvents.reduce((minute, event) => Math.min(minute, event.startMinute), Number.POSITIVE_INFINITY);
    const target = Number.isFinite(first) ? first : data.dayKeys.includes(nowKey) ? nowMinute : 8 * 60;
    scrollRef.current?.scrollTo({ top: Math.max(0, target * minuteHeight - 120), behavior: "smooth" });
  }, [data.anchorDate, data.timedEvents, data.dayKeys, nowKey, nowMinute]);
  return <section className={`zoom-timeline-card is-${data.view}`}><div className="zoom-day-header"><span /><div className="zoom-day-header-grid" style={{ gridTemplateColumns: `repeat(${data.dayKeys.length}, minmax(0, 1fr))` }}>{data.dayKeys.map((day) => <button key={day} data-schedule-date={day} type="button" className={day === data.today ? "is-today" : ""} onClick={() => data.view === "week" && onOpenDay(day)}><span>{weekdays[new Date(`${day}T00:00:00Z`).getUTCDay()]}</span><strong>{Number(day.slice(-2))}</strong></button>)}</div></div><HotelLane data={data} onSelect={onSelect} /><div className="zoom-timeline-scroll" ref={scrollRef}><div className="zoom-timeline" style={{ height: timelineHeight }}><div className="zoom-hour-labels">{hours.map((hour) => <span key={hour} style={{ top: hour * 60 * minuteHeight }}>{String(hour).padStart(2, "0")}.00</span>)}</div><div className="zoom-time-days" style={{ gridTemplateColumns: `repeat(${data.dayKeys.length}, minmax(${data.view === "week" ? 110 : 220}px, 1fr))` }}>{data.dayKeys.map((day) => <div key={day} className="zoom-time-day" data-schedule-date={day}>{hours.map((hour) => <i key={hour} style={{ top: hour * 60 * minuteHeight }} />)}{day === nowKey ? <span className="zoom-now-line" style={{ top: nowMinute * minuteHeight }} /> : null}{data.timedEvents.filter((event) => event.dayKey === day).map((event) => <button key={event.booking_id} type="button" className="zoom-timed-event" style={eventStyle(event)} onClick={() => onSelect(event)}><time>{formatTime(event.start_at)}</time><strong>{event.pet_name}</strong><span>{data.view === "day" ? `${event.customer_name} · ${event.services_summary || "อาบน้ำตัดขน"}` : event.services_summary || "อาบน้ำตัดขน"}</span></button>)}</div>)}</div></div></div></section>;
}

function EventDialog({ event, onClose }: { event: DailyScheduleItem | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; if (event && dialog && !dialog.open) dialog.showModal(); if (!event && dialog?.open) dialog.close(); }, [event]);
  if (!event) return null;
  return <dialog ref={ref} className="zoom-event-dialog" onClose={onClose}><div className="zoom-event-sheet"><div className="zoom-event-sheet-head"><div><span className="section-kicker">{event.booking_type === "hotel" ? "โรงแรม" : "อาบน้ำตัดขน"}</span><h2>{event.pet_name}</h2></div><button className="zoom-icon-button" type="button" onClick={() => ref.current?.close()} aria-label="ปิด"><X size={20} /></button></div><div className="zoom-event-status"><StatusBadge status={event.status} /><PaymentStatusBadge status={event.payment_status} /></div><dl><div><dt>คิว</dt><dd>{event.booking_no}</dd></div><div><dt>เวลา</dt><dd>{formatDate(event.start_at)} · {formatTime(event.start_at)}–{formatTime(event.end_at)}</dd></div><div><dt>ลูกค้า</dt><dd>{event.customer_name}</dd></div><div><dt>บริการ / ห้อง</dt><dd>{event.services_summary || event.room_name || "-"}</dd></div><div><dt>ยอดรวม</dt><dd>{formatBaht(event.total_amount)}</dd></div></dl><div className="zoom-event-actions"><Link className="btn btn-secondary" href={`/bookings/${event.booking_id}`}>เปิดรายละเอียด</Link>{event.payment_status !== "paid" && event.status !== "cancelled" ? <Link className="btn btn-primary" href={`/payments/${event.booking_id}`}>รับเงิน</Link> : null}{event.customer_phone ? <a className="btn btn-secondary" href={`tel:${event.customer_phone}`}>โทรหาลูกค้า</a> : null}</div></div></dialog>;
}

export function ZoomableSchedule({ initialData }: { initialData: ZoomableScheduleViewModel }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryTarget, setRetryTarget] = useState<{ view: ScheduleZoomLevel; date: string } | null>(null);
  const [selected, setSelected] = useState<DailyScheduleItem | null>(null);
  const cache = useRef(new Map([[`${initialData.view}:${initialData.anchorDate}`, initialData]]));
  const controller = useRef<AbortController | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; handled: boolean } | null>(null);

  async function navigate(view: ScheduleZoomLevel, anchorDate: string, force = false) {
    const key = `${view}:${anchorDate}`;
    const url = `/schedule?view=${view}&date=${anchorDate}`;
    window.history.replaceState({ ...window.history.state }, "", url);
    const cached = cache.current.get(key);
    if (cached && !force) { setData(cached); setError(""); setRetryTarget(null); return; }
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/schedule/data?view=${view}&date=${anchorDate}`, { signal: AbortSignal.any([nextController.signal, AbortSignal.timeout(8_000)]) });
      if (!response.ok) throw new Error(`โหลดตารางคิวไม่สำเร็จ (${response.status})`);
      const next = await response.json() as ZoomableScheduleViewModel;
      cache.current.set(key, next); setData(next); setRetryTarget(null);
    } catch (cause) {
      if (!nextController.signal.aborted) { setError(cause instanceof Error ? cause.message : "โหลดตารางคิวไม่สำเร็จ"); setRetryTarget({ view, date: anchorDate }); }
    } finally { if (!nextController.signal.aborted) setLoading(false); }
  }

  function zoom(direction: "in" | "out", anchor = data.anchorDate) { const next = zoomScheduleLevel(data.view, direction); if (next !== data.view) void navigate(next, anchor); }
  function pointerDistance() { const values = [...pointers.current.values()]; return values.length < 2 ? 0 : Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y); }
  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) { if (event.pointerType === "mouse") return; pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); event.currentTarget.setPointerCapture(event.pointerId); if (pointers.current.size === 2) pinch.current = { distance: pointerDistance(), handled: false }; }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) { if (!pointers.current.has(event.pointerId)) return; pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointers.current.size !== 2 || !pinch.current || pinch.current.handled) return; const ratio = pointerDistance() / pinch.current.distance; if (ratio > 1.18 || ratio < 0.82) { const points = [...pointers.current.values()]; const target = document.elementFromPoint((points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2)?.closest<HTMLElement>("[data-schedule-date]"); pinch.current.handled = true; zoom(ratio > 1 ? "in" : "out", target?.dataset.scheduleDate || data.anchorDate); } }
  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) { pointers.current.delete(event.pointerId); if (pointers.current.size < 2) pinch.current = null; }

  return <div className="zoom-schedule" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}><header className="zoom-toolbar"><div className="zoom-toolbar-title"><span>{viewLabels[data.view]}</span><h1>{data.title}</h1></div><div className="zoom-toolbar-actions"><button className="zoom-icon-button" type="button" onClick={() => void navigate(data.view, data.previousDate)} aria-label="ช่วงก่อนหน้า"><ChevronLeft /></button><button className="zoom-today-button" type="button" onClick={() => void navigate(data.view, data.today)}>วันนี้</button><button className="zoom-icon-button" type="button" onClick={() => void navigate(data.view, data.nextDate)} aria-label="ช่วงถัดไป"><ChevronRight /></button><span className="zoom-toolbar-divider" /><button className="zoom-icon-button" type="button" disabled={data.view === "month"} onClick={() => zoom("out")} aria-label="ซูมออก"><Minus /></button><button className="zoom-icon-button" type="button" disabled={data.view === "day"} onClick={() => zoom("in")} aria-label="ซูมเข้า"><Plus /></button></div></header>{loading ? <div className="zoom-loading" aria-live="polite">กำลังปรับมุมมอง...</div> : null}{error ? <div className="state-note state-note-warning" role="alert">{error} <button type="button" onClick={() => retryTarget && void navigate(retryTarget.view, retryTarget.date, true)}>ลองใหม่</button></div> : null}<div className="zoom-view-stage" key={`${data.view}:${data.anchorDate}`}>{data.view === "month" ? <MonthView data={data} onOpenDate={(date) => void navigate("day", date)} /> : <TimelineView data={data} onSelect={setSelected} onOpenDay={(date) => void navigate("day", date)} />}</div><EventDialog event={selected} onClose={() => setSelected(null)} /></div>;
}
