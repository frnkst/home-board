# Home Board

Next.js-App für ein gemeinsames Home-Dashboard. Zeitzone und Locale sind
`Europe/Zurich` beziehungsweise `de-CH`.

## Einrichtung

1. `.env.example` nach `.env.local` kopieren und die Supabase-Werte eintragen.
   `ADMIN_GITHUB_USER_ID` muss die unveränderliche numerische GitHub-ID sein,
   nicht der Benutzername.
2. Die Migrationen in `supabase/migrations` anwenden.
3. Dieselbe GitHub-ID einmalig mit einer `service_role`-Verbindung hinterlegen:

   ```sql
   select private.set_admin_github_user_id(12345678);
   ```

4. In Supabase Auth GitHub als Provider sowie
   `http://localhost:3000/auth/callback` als erlaubte Redirect-URL konfigurieren.

## Entwicklung

```bash
npm run dev
```

Die Wandanzeige liegt unter `/display` und ist wie die Verwaltung mit dem
einzigen Admin-Konto geschützt. Wetterort, Prognoseumfang und ÖV-Haltestelle
werden unter `/admin/settings` gesucht, ausgewählt und gespeichert.

## Prüfung

```bash
npm test
npm run typecheck
npm run lint
```
