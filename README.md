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

Optional kann `OPENROUTER_API_KEY` lokal und in Vercel gesetzt werden. Dann
erstellt `openai/gpt-4o-mini` höchstens einmal pro Stunde drei kurze
Kleidungstipps aus den aktuellen Wetter- und Prognosedaten. Der Schlüssel
bleibt ausschliesslich auf dem Server; ohne Schlüssel funktioniert die
Wetteranzeige weiterhin ohne Kleidungstipps.

## Entwicklung

```bash
npm run dev
```

Die Wandanzeige liegt unter `/display` und ist wie die Verwaltung mit dem
einzigen Admin-Konto geschützt. Wetterort, Prognoseumfang und ÖV-Haltestelle
werden unter `/admin/settings` gesucht, ausgewählt und gespeichert.

## Raspberry Pi Kiosk

Auf Raspberry Pi OS zuerst Chromium und die HDMI-Steuerung installieren und
die lokale Zeitzone setzen:

```bash
sudo apt update
sudo apt install chromium wlr-randr
sudo timedatectl set-timezone Europe/Zurich
```

Danach startet das Skript die Anzeige im Chromium-Kioskmodus:

```bash
./scripts/start-raspberry-pi-kiosk.sh
```

Beim ersten Start einmal mit dem autorisierten GitHub-Konto anmelden. Das
separate Chromium-Profil unter `~/.config/home-board-kiosk` behält die Sitzung.
Das Skript schaltet HDMI täglich um 23:30 Uhr aus und um 05:00 Uhr wieder ein
und startet Chromium nach einem Absturz automatisch neu.

Für den automatischen Start nach der Desktop-Anmeldung das Skript in
`~/.config/labwc/autostart` eintragen:

```text
/ABSOLUTER/PFAD/home-board/scripts/start-raspberry-pi-kiosk.sh &
```

Bei einem abweichenden Wayland-Ausgang kann er beim Start angegeben werden:

```bash
HDMI_OUTPUT=HDMI-A-2 ./scripts/start-raspberry-pi-kiosk.sh
```

## Prüfung

```bash
npm test
npm run typecheck
npm run lint
```
