import Link from "next/link";
import { redirect } from "next/navigation";

import { getRequestUser, isAdmin } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ error, next }, user] = await Promise.all([
    searchParams,
    getRequestUser(),
  ]);

  if (user) {
    redirect(isAdmin(user) ? "/admin" : "/auth/access-denied");
  }

  const destination =
    next?.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  const loginUrl = `/auth/login/github?next=${encodeURIComponent(destination)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900">Anmelden</h1>
        <p className="mt-2 text-sm text-gray-600">
          Die Verwaltung ist nur für das autorisierte GitHub-Konto verfügbar.
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            Die Anmeldung ist fehlgeschlagen. Bitte erneut versuchen.
          </p>
        ) : null}
        <Link
          href={loginUrl}
          className="mt-6 flex w-full justify-center rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Mit GitHub anmelden
        </Link>
        <Link
          href="/display"
          className="mt-4 block text-center text-sm text-gray-600 hover:text-gray-900"
        >
          Zur Anzeige
        </Link>
      </section>
    </main>
  );
}
