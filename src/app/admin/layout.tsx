import Link from "next/link";

import {
  DesktopNavigation,
  MobileNavigation,
} from "@/components/admin/AdminNavigation";
import { requireAdmin } from "@/lib/auth";

import "./admin.css";

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
        <DesktopNavigation />
        <main className="admin-main">{children}</main>
      </div>
      <MobileNavigation />
    </div>
  );
}
