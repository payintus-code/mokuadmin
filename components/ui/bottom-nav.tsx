"use client";

import clsx from "clsx";
import { CalendarDays, Coins, Home, Hotel, Menu, PawPrint, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type KeyboardEvent } from "react";

const items = [
  { href: "/", label: "หน้าหลัก", icon: Home },
  { href: "/schedule", label: "ตารางคิว", icon: CalendarDays },
  { href: "/customers", label: "ข้อมูลลูกค้า", icon: Users },
  { href: "/pets", label: "ข้อมูลสัตว์เลี้ยง", icon: PawPrint },
  { href: "/rooms", label: "ห้องพัก", icon: Hotel },
  { href: "/finance", label: "การเงิน", icon: Coins }
];

export function BottomNav({ canViewFinance }: { canViewFinance: boolean }) {
  const pathname = usePathname();
  const checkboxRef = useRef<HTMLInputElement>(null);
  const visibleItems = canViewFinance ? items : items.filter((item) => item.href !== "/finance");
  const primaryItems = visibleItems.slice(0, 4);

  function isActivePath(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  function toggleMenuFromKeyboard(event: KeyboardEvent<HTMLLabelElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    if (checkboxRef.current) {
      checkboxRef.current.checked = !checkboxRef.current.checked;
    }
  }

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.checked = false;
    }
  }, [pathname]);

  return (
    <>
      <input
        ref={checkboxRef}
        id="app-menu-toggle"
        className="menu-checkbox"
        type="checkbox"
        tabIndex={-1}
        aria-hidden="true"
      />

      <label
        htmlFor="app-menu-toggle"
        className="menu-toggle desktop-menu-toggle"
        aria-label="เปิดหรือปิดเมนูหลัก"
        aria-controls="primary-navigation"
        role="button"
        tabIndex={0}
        onKeyDown={toggleMenuFromKeyboard}
      >
        <Menu className="menu-icon menu-icon-open" size={20} strokeWidth={2.4} />
        <X className="menu-icon menu-icon-close" size={20} strokeWidth={2.4} />
      </label>

      <label htmlFor="app-menu-toggle" className="menu-backdrop" aria-label="ปิดเมนู" />

      <nav className="mobile-tabbar" aria-label="เมนูหลักบนมือถือ">
        {primaryItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx("mobile-tabbar-link", {
              "mobile-tabbar-link-active": isActivePath(item.href)
            })}
            aria-current={isActivePath(item.href) ? "page" : undefined}
          >
            <item.icon size={20} strokeWidth={2.25} />
            <span>{item.label}</span>
          </Link>
        ))}
        <label
          htmlFor="app-menu-toggle"
          className="mobile-tabbar-link mobile-tabbar-button"
          aria-label="เปิดหรือปิดเมนูเพิ่มเติม"
          aria-controls="primary-navigation"
          role="button"
          tabIndex={0}
          onKeyDown={toggleMenuFromKeyboard}
        >
          <Menu className="menu-icon menu-icon-open" size={20} strokeWidth={2.25} />
          <X className="menu-icon menu-icon-close" size={20} strokeWidth={2.25} />
          <span>เมนู</span>
        </label>
      </nav>

      <nav id="primary-navigation" className="menu-panel">
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
              className={clsx("menu-link", {
                "menu-link-active": isActivePath(item.href)
              })}
              aria-current={isActivePath(item.href) ? "page" : undefined}
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
