import { ActionForm, SearchForm } from "@/components/admin/ActionForm";
import { Fields, PageHeader } from "@/components/admin/AdminUI";
import {
  saveSettings,
  selectTransportStop,
  selectWeatherPlace,
  searchTransportStops,
  searchWeatherPlaces,
} from "@/lib/actions/admin";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Einstellungen"
        description="Grunddaten sowie Kennungen für Wetter und öffentlichen Verkehr finden."
      />
      <section className="admin-card">
        <h2>Board</h2>
        <ActionForm action={saveSettings}>
          <Fields>
            <label>
              <span>Name des Haushalts</span>
              <input
                name="household_name"
                required
                maxLength={80}
                defaultValue={data?.household_name ?? "Zuhause"}
              />
            </label>
            <label>
              <span>Zeitzone</span>
              <input value="Europe/Zurich" readOnly />
            </label>
            <label>
              <span>Sprache</span>
              <input value="Deutsch (Schweiz)" readOnly />
            </label>
            <label>
              <span>Wetterort</span>
              <input name="weather_place_name" required maxLength={120} defaultValue={data?.weather_place_name ?? "Zürich"} />
            </label>
            <label>
              <span>Breitengrad</span>
              <input name="weather_latitude" type="number" step="any" min={-90} max={90} required defaultValue={data?.weather_latitude ?? 47.3769} />
            </label>
            <label>
              <span>Längengrad</span>
              <input name="weather_longitude" type="number" step="any" min={-180} max={180} required defaultValue={data?.weather_longitude ?? 8.5417} />
            </label>
            <label>
              <span>Prognosetage</span>
              <input name="weather_forecast_days" type="number" min={1} max={16} required defaultValue={data?.weather_forecast_days ?? 7} />
            </label>
            <label>
              <span>Haltestelle</span>
              <input name="transport_stop_name" required maxLength={120} defaultValue={data?.transport_stop_name ?? "Zürich HB"} />
            </label>
            <label>
              <span>Haltestellen-ID</span>
              <input name="transport_stop_id" required maxLength={80} defaultValue={data?.transport_stop_id ?? "8503000"} />
            </label>
            <label>
              <span>Anzahl Abfahrten</span>
              <input name="transport_departure_count" type="number" min={1} max={20} required defaultValue={data?.transport_departure_count ?? 10} />
            </label>
          </Fields>
        </ActionForm>
      </section>
      <div className="admin-two-column">
        <section className="admin-card">
          <h2>Wetterort finden</h2>
          <p className="admin-hint">
            Suche nach Ort oder Postleitzahl und übernimm die kanonischen
            Koordinaten direkt in die Felder oben.
          </p>
          <SearchForm action={searchWeatherPlaces} selectionAction={selectWeatherPlace} selectionLabel="Ort übernehmen" label="Ort" placeholder="z. B. Winterthur" />
        </section>
        <section className="admin-card">
          <h2>Haltestelle finden</h2>
          <p className="admin-hint">
            Suche die eindeutige Haltestellen-ID und trage Name und ID danach
            oben ein.
          </p>
          <SearchForm action={searchTransportStops} selectionAction={selectTransportStop} selectionLabel="Stopp übernehmen" label="Haltestelle" placeholder="z. B. Bern, Bahnhof" />
        </section>
      </div>
    </>
  );
}
