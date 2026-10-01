import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900">
          Zugriff verweigert
        </h1>
        <p className="mt-3 text-sm text-gray-600">
          Dieses GitHub-Konto ist nicht für die Verwaltung autorisiert.
        </p>
        <div className="mt-6 flex justify-center gap-4 text-sm">
          <Link href="/display" className="font-medium text-gray-700">
            Zur Anzeige
          </Link>
          <form action="/auth/logout" method="post">
            <button className="font-semibold text-gray-900" type="submit">
              Abmelden
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
