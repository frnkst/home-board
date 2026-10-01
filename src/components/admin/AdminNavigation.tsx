"use client";

import {
  BarLineChart,
  CalendarHeart01,
  ClockStopwatch,
  Globe03,
  HomeSmile,
  Hourglass03,
  Image03,
  List,
  Menu03,
  Settings03,
  Type02,
  XClose,
} from "@untitledui/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navigation = [
  { href: "/admin", label: "Übersicht", icon: HomeSmile },
  { href: "/admin/events", label: "Termine", icon: CalendarHeart01 },
  { href: "/admin/countdowns", label: "Countdowns", icon: Hourglass03 },
  { href: "/admin/live-countdowns", label: "Live Timer", icon: ClockStopwatch },
  { href: "/admin/ticker", label: "Ticker", icon: BarLineChart },
  { href: "/admin/photos", label: "Fotos", icon: Image03 },
  { href: "/admin/webpages", label: "Webseiten", icon: Globe03 },
  { href: "/admin/texts", label: "Texte", icon: Type02 },
  { href: "/admin/playlist", label: "Playlist", icon: List },
  { href: "/admin/settings", label: "Einstellungen", icon: Settings03 },
] as const;

function NavigationLinks({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return navigation.map(({ href, label, icon: Icon }) => {
    const active =
      href === "/admin" ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        href={href}
        key={href}
        aria-current={active ? "page" : undefined}
        className={active ? "is-current" : undefined}
        onClick={onNavigate}
      >
        <Icon aria-hidden />
        <span>{label}</span>
      </Link>
    );
  });
}

export function DesktopNavigation() {
  return (
    <nav className="admin-nav" aria-label="Administration">
      <NavigationLinks />
    </nav>
  );
}

export function MobileNavigation() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className={`mobile-menu${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="mobile-menu__scrim"
        onClick={() => setOpen(false)}
        aria-label="Menü schließen"
        tabIndex={open ? 0 : -1}
      />
      <nav
        className="mobile-menu__sheet"
        aria-label="Mobile Navigation"
        aria-hidden={!open}
      >
        <header>
          <span>Home Board</span>
          <strong>Wohin möchtest du?</strong>
        </header>
        <div className="mobile-menu__grid">
          <NavigationLinks onNavigate={() => setOpen(false)} />
        </div>
      </nav>
      <button
        type="button"
        className="mobile-menu__trigger"
        aria-expanded={open}
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <XClose aria-hidden /> : <Menu03 aria-hidden />}
        <span>{open ? "Schließen" : "Menü"}</span>
      </button>
    </div>
  );
}
