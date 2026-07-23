"use client";

import { CalendarDays, CheckCircle2, Clock3, LoaderCircle, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PaymentStatusBadge } from "@/components/ui/payment-status-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { canReceiveBookingPayment } from "@/lib/dashboard";
import { formatBaht, formatDate, formatTime } from "@/lib/format";
import type { DashboardQueueCounts } from "@/lib/bookings";
import type { DailyScheduleItem } from "@/types/database";

type QueueGroup = "todayAll" | "pending" | "done" | "unpaid";
const labels: Record<QueueGroup, string> = { todayAll: "คิวทั้งหมดวันนี้", pending: "รอดำเนินการ", done: "เรียบร้อยแล้ว", unpaid: "ยังไม่ชำระเงินทั้งหมด" };
const bookingTypeLabel: Record<DailyScheduleItem["booking_type"], string> = { grooming: "อาบน้ำตัดขน", hotel: "ฝากเลี้ยง" };

function QueueRow({ item, unpaid }: { item: DailyScheduleItem; unpaid: boolean }) {
  const showPaymentAction = canReceiveBookingPayment(item);
  return <article className="dashboard-queue-row"><div className="dashboard-queue-row-main"><div className="dashboard-queue-row-time">{unpaid ? <span>{formatDate(item.start_at)}</span> : null}<strong>{formatTime(item.start_at)}–{formatTime(item.end_at)}</strong></div><div className="dashboard-queue-row-copy"><strong>{item.booking_no}</strong><span>{item.customer_name} · {item.pet_name}</span><small>{bookingTypeLabel[item.booking_type]}{item.services_summary ? ` · ${item.services_summary}` : ""}{item.room_name ? ` · ${item.room_name}` : ""}</small></div><div className="dashboard-queue-row-status"><StatusBadge status={item.status} /><PaymentStatusBadge status={item.payment_status} /><strong>{formatBaht(item.total_amount)}</strong></div></div>{showPaymentAction ? <div className="dashboard-queue-row-actions"><Link className="btn btn-primary btn-small" href={`/payments/${item.booking_id}`}>รับเงิน</Link></div> : null}</article>;
}

function QueueDialogContent({
  group,
  count,
  items,
  loading,
  error,
  onRetry,
  onClose,
  closeButtonRef
}: {
  group: QueueGroup;
  count: number;
  items: DailyScheduleItem[] | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  return <div className="dashboard-queue-dialog-inner">
    <div className="dashboard-queue-dialog-head">
      <div>
        <span className="section-kicker"><CalendarDays size={14} /> คิวงาน</span>
        <h2 className="section-title" id="dashboard-queue-dialog-title">{labels[group]}</h2>
      </div>
      <div className="dashboard-queue-dialog-head-actions">
        <span className="section-count">{count}</span>
        <button ref={closeButtonRef} className="zoom-icon-button" type="button" onClick={onClose} aria-label="ปิดรายการคิว"><X size={22} /></button>
      </div>
    </div>
    <div className="dashboard-queue-dialog-body">
      {loading ? <div className="dashboard-queue-loading"><LoaderCircle className="spin" size={20} /> กำลังโหลดข้อมูล...</div> : error ? <EmptyState title={error} description="ลองโหลดข้อมูลอีกครั้ง" action={<button className="btn btn-secondary" type="button" onClick={onRetry}>ลองอีกครั้ง</button>} /> : items?.length ? <div className="dashboard-queue-scroll">{items.map((item) => <QueueRow key={item.booking_id} item={item} unpaid={group === "unpaid"} />)}</div> : <EmptyState title="ไม่มีรายการ" description="ยังไม่มีรายการในกลุ่มนี้" />}
    </div>
  </div>;
}

export function DashboardQueueAccordion({ counts, day, initialOpen = null }: { counts: DashboardQueueCounts; day: string; initialOpen?: QueueGroup | null }) {
  const [open, setOpen] = useState<QueueGroup | null>(initialOpen);
  const [cache, setCache] = useState<Partial<Record<QueueGroup, DailyScheduleItem[]>>>({});
  const [loading, setLoading] = useState<QueueGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requested = useRef(new Set<QueueGroup>());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef<Partial<Record<QueueGroup, HTMLButtonElement | null>>>({});
  const cards = [
    { key: "todayAll" as const, value: counts.todayAll, tone: "default" as const, icon: <CalendarDays size={18} /> },
    { key: "pending" as const, value: counts.todayPending, tone: "warning" as const, icon: <Clock3 size={18} /> },
    { key: "done" as const, value: counts.todayDone, tone: "success" as const, icon: <CheckCircle2 size={18} /> },
    { key: "unpaid" as const, value: counts.unpaid, tone: "danger" as const, icon: <WalletCards size={18} /> }
  ];

  const loadGroup = useCallback(async (group: QueueGroup) => {
    if (requested.current.has(group)) return;
    requested.current.add(group);
    setLoading(group);
    try {
      const response = await fetch(`/api/dashboard/queues?group=${group}&day=${encodeURIComponent(day)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("โหลดข้อมูลคิวไม่สำเร็จ");
      const data = await response.json() as { items?: DailyScheduleItem[] };
      setCache((current) => ({ ...current, [group]: data.items ?? [] }));
    } catch (cause) {
      requested.current.delete(group);
      setError(cause instanceof Error ? cause.message : "โหลดข้อมูลคิวไม่สำเร็จ");
    } finally { setLoading(null); }
  }, [day]);

  useEffect(() => { if (initialOpen) void loadGroup(initialOpen); }, [initialOpen, loadGroup]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    if (!dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
      closeButtonRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function closeDialog() {
    const activeTrigger = open ? triggerRefs.current[open] : null;
    setOpen(null);
    dialogRef.current?.close();
    document.body.style.overflow = "";
    activeTrigger?.focus();
  }

  function selectGroup(group: QueueGroup) {
    setOpen(group); setError(null);
    if (!cache[group]) void loadGroup(group);
  }

  return <><section className="metric-grid dashboard-summary-buttons">{cards.map((card) => <button key={card.key} ref={(element) => { triggerRefs.current[card.key] = element; }} type="button" className={`metric-card metric-card-${card.tone} dashboard-summary-button ${open === card.key ? "is-open" : ""}`} onClick={() => selectGroup(card.key)} aria-expanded={open === card.key} aria-controls="dashboard-queue-dialog"><span className="metric-card-top"><span className="metric-card-label">{labels[card.key]}</span><span className="metric-card-icon">{card.icon}</span></span><strong className="metric-card-value">{card.value}</strong><span className="metric-card-detail">กดเพื่อดูรายละเอียด</span></button>)}</section>{open ? <dialog ref={dialogRef} id="dashboard-queue-dialog" className="dashboard-queue-dialog" aria-labelledby="dashboard-queue-dialog-title" onCancel={(event) => { event.preventDefault(); closeDialog(); }} onClose={closeDialog}><QueueDialogContent group={open} count={cards.find((card) => card.key === open)?.value ?? 0} items={cache[open]} loading={loading === open} error={error} onRetry={() => { requested.current.delete(open); void loadGroup(open); }} onClose={closeDialog} closeButtonRef={closeButtonRef} /></dialog> : null}</>;
}
