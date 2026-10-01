import Link from "next/link";

import { requireAdmin } from "@/lib/auth";

import "./admin.css";

const navigation = [
  ["/admin", "Übersicht", "⌂"],
  ["/admin/events", "Termine", "◷"],
  ["/admin/countdowns", "Countdowns", "⌛"],
  ["/admin/ticker", "Ticker", "↗"],
  ["/admin/photos", "Fotos", "▧"],
  ["/admin/webpages", "Webseiten", "◎"],
  ["/admin/texts", "Texte", "¶"],
  ["/admin/playlist", "Playlist", "≡"],
  ["/admin/settings", "Einstellungen", "⚙"],
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <Link href="/admin" className="admin-brand">
          <span className="admin-brand-mark">HB</span>
          <span>
            <strong>Home Board</strong>
            <small>Kontrollraum</small>
          </span>
        </Link>
        <div className="admin-account">
          <span>{user.user_metadata.user_name ?? user.email ?? "Admin"}</span>
          <form action="/auth/logout" method="post">
            <button type="submit">Abmelden</button>
          </form>
        </div>
      </header>
      <div className="admin-frame">
        <nav className="admin-nav" aria-label="Administration">
          {navigation.map(([href, label, icon]) => (
            <Link href={href} key={href}>
              <span aria-hidden>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <main className="admin-main">{children}</main>
      </div>
      <nav className="admin-tabbar" aria-label="Schnellnavigation">
        {navigation.slice(0, 5).map(([href, label, icon]) => (
          <Link href={href} key={href}>
            <span aria-hidden>{icon}</span>
            <small>{label}</small>
          </Link>
        ))}
      </nav>
    </div>
  );
}
