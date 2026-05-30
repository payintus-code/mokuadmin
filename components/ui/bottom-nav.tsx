"use client";

import clsx from "clsx";
import { CalendarDays, Coins, Home, Menu, PawPrint, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  { href: "/", label: "หน้าหลัก", icon: Home },
  { href: "/schedule", label: "ตารางคิว", icon: CalendarDays },
  { href: "/customers", label: "ข้อมูลลูกค้า", icon: Users },
  { href: "/pets", label: "ข้อมูลสัตว์เลี้ยง", icon: PawPrint },
  { href: "/rooms", label: "ห้องพัก", icon: PawPrint },
  { href: "/finance", label: "การเงิน", icon: Coins }
];

export function BottomNav({ canViewFinance }: { canViewFinance: boolean }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const visibleItems = canViewFinance ? items : items.filter((item) => item.href !== "/finance");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className="menu-toggle"
        aria-label={isOpen ? "ปิดเมนู" : "เปิดเมนู"}
        aria-expanded={isOpen}
        aria-controls="primary-navigation"
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? <X size={20} strokeWidth={2.4} /> : <Menu size={20} strokeWidth={2.4} />}
      </button>

      {isOpen ? <button type="button" className="menu-backdrop" aria-label="ปิดเมนู" onClick={() => setIsOpen(false)} /> : null}

      <nav id="primary-navigation" className={clsx("menu-panel", { "menu-panel-open": isOpen })} aria-hidden={!isOpen}>
        <div className="menu-panel-header">
          <div>
            <div className="menu-panel-kicker">Moku Pet Admin</div>
            <div className="menu-panel-title">เมนูหลัก</div>
          </div>
        </div>

        <div className="menu-panel-links">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={clsx("menu-link", {
                "menu-link-active": item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
              })}
            >
              <item.icon className="menu-link-icon" size={18} strokeWidth={2.2} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
