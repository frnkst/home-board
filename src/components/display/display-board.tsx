"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  Departure,
  DisplayData,
  MarketQuote,
  WeatherData,
  WeatherPoint,
} from "@/components/display/types";
import { expandEvents } from "@/lib/domain/recurrence";
import { getPlaylistFrame } from "@/lib/domain/playlist";
import type { PlaylistEntry } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/client";

const ZONE = "Europe/Zurich";
const ACTIVE_TABLES = [
  "app_settings",
  "events",
  "countdowns",
  "live_countdowns",
  "market_symbols",
  "photos",
  "webpages",
  "custom_texts",
  "playlist_entries",
  "display_state",
] as const;

const dayFormatter = new Intl.DateTimeFormat("de-CH", {
  timeZone: ZONE,
  weekday: "long",
  day: "2-digit",
  month: "long",
});
const shortDayFormatter = new Intl.DateTimeFormat("de-CH", {
  timeZone: ZONE,
  weekday: "short",
});
const timeFormatter = new Intl.DateTimeFormat("de-CH", {
  timeZone: ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const dateTimeFormatter = new Intl.DateTimeFormat("de-CH", {
  timeZone: ZONE,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function parseWeather(payload: unknown): WeatherData | null {
  const root = object(payload);
  if (!root) return null;
  const current = object(root.current) ?? root;
  const temperature =
    number(current.temperatureCelsius) ??
    number(current.temperature_2m) ??
    number(current.temperature) ??
    number(current.temp);
  if (temperature === null) return null;
  const directForecast = Array.isArray(root.forecast) ? root.forecast : [];
  const forecast: WeatherPoint[] = directForecast
    .map((item) => {
      const point = object(item);
      if (!point) return null;
      const date = point.date;
      const maximum = number(point.temperatureMaxCelsius);
      const minimum = number(point.temperatureMinCelsius);
      return typeof date === "string" && maximum !== null && minimum !== null
        ? {
            date,
            temperatureMaxCelsius: maximum,
            temperatureMinCelsius: minimum,
            precipitationMm: number(point.precipitationMm) ?? 0,
            precipitationProbabilityPercent: number(
              point.precipitationProbabilityPercent,
            ),
            windSpeedMaxKmh: number(point.windSpeedMaxKmh) ?? 0,
            weatherCode: number(point.weatherCode ?? point.weather_code),
          }
        : null;
    })
    .filter((item): item is WeatherPoint => item !== null);
  return {
    temperature,
    apparentTemperatureCelsius: number(
      current.apparentTemperatureCelsius ?? current.apparent_temperature,
    ),
    precipitationMm: number(current.precipitationMm ?? current.precipitation),
    windSpeedKmh: number(current.windSpeedKmh ?? current.wind_speed_10m),
    windDirectionDegrees: number(
      current.windDirectionDegrees ?? current.wind_direction_10m,
    ),
    weatherCode: number(
      current.weather_code ?? current.weathercode ?? current.weatherCode,
    ),
    updatedAt:
      typeof (root.fetchedAt ?? root.updatedAt) === "string"
        ? String(root.fetchedAt ?? root.updatedAt)
        : new Date().toISOString(),
    forecast,
  };
}

function parseDepartures(payload: unknown): Departure[] {
  const root = object(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.departures)
      ? root.departures
      : [];
  return list.flatMap((value, index) => {
    const item = object(value);
    if (!item) return [];
    const departureAt =
      item.departureAt ?? item.departure_at ?? item.departure ?? item.time;
    const line = item.line ?? item.number ?? item.name;
    const destination = item.destination ?? item.to;
    if (
      typeof departureAt !== "string" ||
      (typeof line !== "string" && typeof line !== "number") ||
      typeof destination !== "string"
    )
      return [];
    return [
      {
        id: String(item.id ?? `${line}-${departureAt}-${index}`),
        line: String(line),
        category: typeof item.category === "string" ? item.category : null,
        destination,
        departureAt,
        delayMinutes: number(item.delayMinutes ?? item.delay),
        platform:
          typeof (item.platform ?? item.track) === "string"
            ? String(item.platform ?? item.track)
            : null,
      },
    ];
  });
}

function parseQuotes(payload: unknown): MarketQuote[] {
  const root = object(payload);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.quotes)
      ? root.quotes
      : Array.isArray(root?.data)
        ? root.data
        : [];
  return list.flatMap((value) => {
    const item = object(value);
    if (!item || typeof item.symbol !== "string") return [];
    const price = number(item.price ?? item.value ?? item.regularMarketPrice);
    if (price === null) return [];
    const rawHistory = Array.isArray(item.history) ? item.history : [];
    return [
      {
        symbol: item.symbol,
        price,
        changePercent: number(
          item.changePercent ?? item.change_percent ?? item.regularMarketChangePercent,
        ),
        currency: typeof item.currency === "string" ? item.currency : "CHF",
        updatedAt:
          typeof item.updatedAt === "string"
            ? item.updatedAt
            : new Date().toISOString(),
        history: rawHistory.flatMap((point) => {
          const value = object(point);
          const at = value?.at ?? value?.time ?? value?.date;
          const amount = number(value?.value ?? value?.price ?? value?.close);
          return typeof at === "string" && amount !== null
            ? [{ at, value: amount }]
            : [];
        }),
      },
    ];
  });
}

function weatherLabel(code: number | null) {
  if (code === null) return "Wetter";
  if (code === 0) return "Klar";
  if (code <= 3) return "Bewölkt";
  if (code <= 48) return "Nebel";
  if (code <= 67) return "Regen";
  if (code <= 77) return "Schnee";
  if (code <= 82) return "Schauer";
  return "Gewitter";
}

function weatherKind(code: number | null) {
  if (code === 0) return "sun";
  if (code !== null && code <= 3) return "cloud";
  if (code !== null && code <= 48) return "fog";
  if (code !== null && code <= 67) return "rain";
  if (code !== null && code <= 77) return "snow";
  if (code !== null && code <= 82) return "showers";
  if (code !== null) return "storm";
  return "cloud";
}

function WeatherIcon({
  code,
  compact = false,
}: {
  code: number | null;
  compact?: boolean;
}) {
  const kind = weatherKind(code);
  const cloud = (
    <path
      className="weather-icon__cloud"
      d="M31 67h46c10.5 0 19-7.7 19-17.2 0-8.6-7-15.8-16.2-17-2.9-11.2-13.9-19.5-27-19.5-14.4 0-26 10-27.2 22.7C16.2 38.2 9 45.9 9 55c0 6.6 3.8 12.4 9.6 15.3C22.2 68.2 26.4 67 31 67Z"
    />
  );
  return (
    <span
      className={`weather-icon${compact ? " weather-icon--compact" : ""}`}
      data-kind={kind}
      role="img"
      aria-label={weatherLabel(code)}
    >
      <svg viewBox="0 0 104 104" aria-hidden="true">
        <g className="weather-icon__sun">
          <circle cx="65" cy="35" r="19" />
          <path d="M65 7v10M65 53v10M37 35h10M83 35h10M45 15l7 7M78 48l7 7M45 55l7-7M78 22l7-7" />
        </g>
        {kind !== "sun" && cloud}
        {(kind === "rain" || kind === "showers") && (
          <g className="weather-icon__rain">
            <path d="M31 76l-5 11M52 76l-5 11M73 76l-5 11" />
          </g>
        )}
        {kind === "snow" && (
          <g className="weather-icon__snow">
            <path d="M28 78v13M21.5 84.5h13M23.5 80l9 9M32.5 80l-9 9M58 78v13M51.5 84.5h13M53.5 80l9 9M62.5 80l-9 9" />
          </g>
        )}
        {kind === "fog" && (
          <g className="weather-icon__fog">
            <path d="M17 78h68M27 88h62" />
          </g>
        )}
        {kind === "storm" && (
          <path className="weather-icon__bolt" d="M56 70H42L35 91l15-12-2 18 22-27H56Z" />
        )}
      </svg>
    </span>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="display-state">
      <span className="display-state__pulse" />
      <strong>{label}</strong>
      <small>Daten werden geladen</small>
    </div>
  );
}

function EmptyState({
  label,
  detail = "In der Verwaltung können Inhalte hinzugefügt werden.",
}: {
  label: string;
  detail?: string;
}) {
  return (
    <div className="display-state">
      <span className="display-state__rule" />
      <strong>{label}</strong>
      <small>{detail}</small>
    </div>
  );
}

function WeatherNow({ weather }: { weather: WeatherData }) {
  return (
    <>
      <div className="weather-reading">
        <WeatherIcon code={weather.weatherCode} />
        <strong>{Math.round(weather.temperature)}°</strong>
      </div>
      <p className="weather-caption">
        {weatherLabel(weather.weatherCode)}
        {weather.apparentTemperatureCelsius !== null &&
          ` · gefühlt ${Math.round(weather.apparentTemperatureCelsius)}°`}
      </p>
      <div className="weather-details">
        <span>
          <i className="weather-details__drop" aria-hidden />
          <small>Regen</small>
          <strong>{weather.precipitationMm?.toFixed(1) ?? "–"} mm</strong>
        </span>
        <span>
          <i
            className="weather-details__wind"
            style={{
              transform: `rotate(${weather.windDirectionDegrees ?? 0}deg)`,
            }}
            aria-hidden
          >
            ↑
          </i>
          <small>Wind</small>
          <strong>{Math.round(weather.windSpeedKmh ?? 0)} km/h</strong>
        </span>
      </div>
    </>
  );
}

function Sparkline({ quote }: { quote: MarketQuote }) {
  if (quote.history.length < 2)
    return <div className="sparkline sparkline--empty">Keine Kursreihe</div>;
  const values = quote.history.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map(
      (value, index) =>
        `${(index / (values.length - 1)) * 100},${95 - ((value - min) / span) * 90}`,
    )
    .join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline points={points} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function DisplayBoard({ initialData }: { initialData: DisplayData }) {
  const [data] = useState(initialData);
  const [now, setNow] = useState(() => new Date(initialData.loadedAt));
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [departures, setDepartures] = useState<Departure[] | null>(null);
  const [quotes, setQuotes] = useState<MarketQuote[] | null>(null);
  const [feedErrors, setFeedErrors] = useState<string[]>([]);
  const [manualIndex, setManualIndex] = useState<number | null>(null);
  const [manualStartedAt, setManualStartedAt] = useState<number | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const touchStart = useRef<number | null>(null);

  const activeEntries = useMemo(
    () =>
      data.playlist
        .filter((entry) => entry.enabled)
        .toSorted(
          (left, right) =>
            left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
        ),
    [data.playlist],
  );

  const reloadDatabase = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadFeeds() {
      const symbols = data.marketSymbols.map((item) => item.symbol).join(",");
      const requests = [
        fetch("/api/weather", { cache: "no-store" }).then(async (response) => {
          if (!response.ok) throw new Error("Wetter");
          const parsed = parseWeather(await response.json());
          if (!parsed) throw new Error("Wetter");
          if (!cancelled) setWeather(parsed);
        }),
        fetch("/api/departures", { cache: "no-store" }).then(
          async (response) => {
            if (!response.ok) throw new Error("Abfahrten");
            const parsed = parseDepartures(await response.json());
            if (!cancelled) setDepartures(parsed);
          },
        ),
      ];
      if (symbols) {
        requests.push(
          fetch(`/api/markets?symbols=${encodeURIComponent(symbols)}`, {
            cache: "no-store",
          }).then(async (response) => {
            if (!response.ok) throw new Error("Märkte");
            if (!cancelled) setQuotes(parseQuotes(await response.json()));
          }),
        );
      } else {
        setQuotes([]);
      }
      const results = await Promise.allSettled(requests);
      if (!cancelled) {
        setFeedErrors(
          results.flatMap((result) =>
            result.status === "rejected" && result.reason instanceof Error
              ? [result.reason.message]
              : [],
          ),
        );
      }
    }
    void loadFeeds();
    const timer = window.setInterval(loadFeeds, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [data.marketSymbols]);

  useEffect(() => {
    if (data.error) return;
    const supabase = createClient();
    let debounce: number | undefined;
    const channel = supabase.channel("wall-display");
    for (const table of ACTIVE_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          window.clearTimeout(debounce);
          debounce = window.setTimeout(reloadDatabase, 350);
        },
      );
    }
    channel.subscribe();
    return () => {
      window.clearTimeout(debounce);
      void supabase.removeChannel(channel);
    };
  }, [data.error, reloadDatabase]);

  useEffect(() => {
    const timer = window.setInterval(reloadDatabase, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [reloadDatabase]);

  const stateTime = data.displayState?.pausedAt
    ? new Date(data.displayState.pausedAt)
    : now;
  const cycleFrame =
    data.displayState && activeEntries.length
      ? getPlaylistFrame(
          activeEntries,
          new Date(data.displayState.playlistStartedAt),
          stateTime,
        )
      : null;
  const legacyForcedIndex = data.displayState?.forcedEntryId
    ? activeEntries.findIndex(
        (entry) => entry.id === data.displayState?.forcedEntryId,
      )
    : -1;
  const forcedEntry: PlaylistEntry | null = data.displayState?.forcedKind
    ? {
        id: "fixed-view",
        kind: data.displayState.forcedKind,
        referenceId: data.displayState.forcedReferenceId,
        durationSeconds: 30,
        sortOrder: 0,
        enabled: true,
      }
    : legacyForcedIndex >= 0
      ? activeEntries[legacyForcedIndex] ?? null
      : null;
  const cycleIndex =
    legacyForcedIndex >= 0 ? legacyForcedIndex : (cycleFrame?.index ?? 0);
  const selectedIndex =
    manualIndex === null || !activeEntries.length
      ? cycleIndex
      : manualIndex % activeEntries.length;
  const activeEntry =
    manualIndex === null && forcedEntry
      ? forcedEntry
      : activeEntries[selectedIndex] ?? null;
  const entryProgress =
    manualStartedAt !== null && activeEntry
      ? Math.min(
          1,
          (now.getTime() - manualStartedAt) /
            (activeEntry.durationSeconds * 1000),
        )
      : forcedEntry || data.displayState?.pausedAt
        ? 0
        : (cycleFrame?.progress ?? 0);

  const navigate = useCallback(
    (direction: -1 | 1) => {
      if (!activeEntries.length) return;
      const base = manualIndex ?? cycleIndex;
      setManualIndex(
        (base + direction + activeEntries.length) % activeEntries.length,
      );
      setManualStartedAt(Date.now());
      setPhotoIndex(0);
    },
    [activeEntries.length, cycleIndex, manualIndex],
  );

  useEffect(() => {
    if (manualStartedAt === null || !activeEntry) return;
    const remaining =
      activeEntry.durationSeconds * 1000 -
      (Date.now() - manualStartedAt);
    const timer = window.setTimeout(() => {
      setManualIndex(
        (index) => ((index ?? selectedIndex) + 1) % activeEntries.length,
      );
      setManualStartedAt(Date.now());
      setPhotoIndex(0);
    }, Math.max(0, remaining));
    return () => window.clearTimeout(timer);
  }, [
    activeEntries.length,
    activeEntry,
    manualStartedAt,
    selectedIndex,
  ]);

  const selectedPhotos = useMemo(() => {
    if (!activeEntry || activeEntry.kind !== "photos") return [];
    return data.photos
      .filter(
        (photo) =>
          photo.enabled &&
          (!activeEntry.referenceId || photo.id === activeEntry.referenceId),
      )
      .toSorted(
        (left, right) =>
          left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
      );
  }, [activeEntry, data.photos]);

  useEffect(() => {
    if (selectedPhotos.length < 2) return;
    const nestedDuration = Math.max(
      3500,
      ((activeEntry?.durationSeconds ?? 15) * 1000) / selectedPhotos.length,
    );
    const timer = window.setInterval(
      () => setPhotoIndex((index) => (index + 1) % selectedPhotos.length),
      nestedDuration,
    );
    return () => window.clearInterval(timer);
  }, [activeEntry?.durationSeconds, selectedPhotos.length]);

  const upcomingEvents = useMemo(() => {
    const start = new Date(now);
    const end = new Date(start.getTime() + 14 * 86_400_000);
    try {
      return expandEvents(data.events, start, end).slice(0, 10);
    } catch {
      return [];
    }
  }, [data.events, now]);

  const stale =
    now.getTime() - new Date(data.loadedAt).getTime() > 15 * 60 * 1000;
  const mode =
    manualIndex !== null
      ? "LOKAL"
      : forcedEntry
        ? "MANUELL"
        : data.displayState?.pausedAt
          ? "PAUSE"
          : "ZYKLUS";

  function renderOverview() {
    return (
      <main className="overview">
        <section className="weather-hero" data-weather={weatherKind(weather?.weatherCode ?? null)}>
          <div>
            <p className="eyebrow">Wetter · {data.settings?.weatherPlaceName ?? "Zürich"}</p>
            {weather ? (
              <WeatherNow weather={weather} />
            ) : feedErrors.includes("Wetter") ? (
              <EmptyState
                label="Wetter nicht verfügbar"
                detail="Der Wetterdienst antwortet momentan nicht."
              />
            ) : (
              <LoadingState label="Wetter" />
            )}
          </div>
          <Forecast weather={weather} />
        </section>
        <section className="overview-events">
          <SectionHeading index="02" title="Als Nächstes" />
          <EventList events={upcomingEvents.slice(0, 4)} />
        </section>
        <section className="overview-departures">
          <SectionHeading index="03" title="Abfahrten" />
          <DepartureList departures={departures} error={feedErrors.includes("Abfahrten")} />
        </section>
      </main>
    );
  }

  function renderEntry(entry: PlaylistEntry) {
    switch (entry.kind) {
      case "events":
        return (
          <main className="full-view">
            <SectionHeading index="Kalender" title="Die nächsten Termine" />
            <EventList
              events={
                entry.referenceId
                  ? upcomingEvents.filter(
                      (event) => event.sourceEventId === entry.referenceId,
                    )
                  : upcomingEvents
              }
              large
            />
          </main>
        );
      case "overview":
        return renderOverview();
      case "weather":
        return (
          <main className="full-view weather-view">
            <section className="weather-hero" data-weather={weatherKind(weather?.weatherCode ?? null)}>
              <div>
                <p className="eyebrow">
                  Wetter · {data.settings?.weatherPlaceName ?? "Zürich"}
                </p>
                {weather ? (
                  <WeatherNow weather={weather} />
                ) : (
                  <LoadingState label="Wetter" />
                )}
              </div>
              <Forecast weather={weather} />
            </section>
          </main>
        );
      case "departures":
        return (
          <main className="full-view">
            <SectionHeading
              index="ÖV"
              title={data.settings?.transportStopName ?? "Abfahrten"}
            />
            <DepartureList
              departures={departures}
              error={feedErrors.includes("Abfahrten")}
            />
          </main>
        );
      case "countdowns": {
        const items = data.countdowns
          .filter((item) => !entry.referenceId || item.id === entry.referenceId)
          .toSorted((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
        return (
          <main className="full-view countdown-view">
            <SectionHeading index="Countdown" title="Vorfreude in Zahlen" />
            {items.length ? (
              <div className="countdown-grid">
                {items.map((item) => {
                  const difference = new Date(item.targetAt).getTime() - now.getTime();
                  const days = Math.ceil(difference / 86_400_000);
                  return (
                    <article className="countdown" key={item.id}>
                      <div
                        className="countdown__accent"
                        style={{ background: item.color ?? undefined }}
                      />
                      <span>{days >= 0 ? "noch" : "seit"}</span>
                      <strong>{Math.abs(days)}</strong>
                      <span>{Math.abs(days) === 1 ? "Tag" : "Tage"}</span>
                      <h2>{item.title}</h2>
                      <time>{dateTimeFormatter.format(new Date(item.targetAt))}</time>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState label="Keine Countdowns" />
            )}
          </main>
        );
      }
      case "live_countdown": {
        const item = data.liveCountdowns
          .filter(
            (countdown) =>
              !entry.referenceId || countdown.id === entry.referenceId,
          )
          .toSorted(
            (left, right) =>
              left.sortOrder - right.sortOrder ||
              left.id.localeCompare(right.id),
          )[0];
        if (!item) {
          return (
            <main className="full-view">
              <EmptyState label="Kein Live Countdown" />
            </main>
          );
        }
        const remaining = Math.max(
          0,
          new Date(item.targetAt).getTime() - now.getTime(),
        );
        const totalSeconds = Math.ceil(remaining / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const complete = remaining <= 0;
        return (
          <main className={`live-countdown${complete ? " live-countdown--complete" : ""}`}>
            <div className="live-countdown__orb" aria-hidden />
            <p className="eyebrow">{complete ? "Zeit ist um" : "Live Countdown"}</p>
            {complete ? (
              <>
                <h1>{item.completionText}</h1>
                <p className="live-countdown__title">{item.title}</p>
              </>
            ) : (
              <>
                <h1>{item.title}</h1>
                <div className="live-countdown__time" aria-label={`${hours} Stunden, ${minutes} Minuten, ${seconds} Sekunden`}>
                  <span><strong>{String(hours).padStart(2, "0")}</strong><small>Stunden</small></span>
                  <i>:</i>
                  <span><strong>{String(minutes).padStart(2, "0")}</strong><small>Minuten</small></span>
                  <i>:</i>
                  <span><strong>{String(seconds).padStart(2, "0")}</strong><small>Sekunden</small></span>
                </div>
                <time>Ziel · {timeFormatter.format(new Date(item.targetAt))} Uhr</time>
              </>
            )}
          </main>
        );
      }
      case "markets": {
        const symbols = data.marketSymbols.filter(
          (item) => !entry.referenceId || item.id === entry.referenceId,
        );
        return (
          <main className="full-view markets-view">
            <SectionHeading index="15 Min. verzögert" title="Märkte" />
            {quotes === null ? (
              <LoadingState label="Kurse" />
            ) : quotes.length && symbols.length ? (
              <div className="market-grid">
                {symbols.map((symbol) => {
                  const quote = quotes.find((item) => item.symbol === symbol.symbol);
                  if (!quote)
                    return (
                      <article className="market" key={symbol.id}>
                        <p>{symbol.label}</p>
                        <EmptyState label="Kein Kurs" detail={symbol.symbol} />
                      </article>
                    );
                  const positive = (quote.changePercent ?? 0) >= 0;
                  return (
                    <article className="market" key={symbol.id}>
                      <header>
                        <p>{symbol.label}</p>
                        <span>{symbol.symbol}</span>
                      </header>
                      <Sparkline quote={quote} />
                      <footer>
                        <strong>
                          {quote.price.toLocaleString("de-CH", {
                            maximumFractionDigits: 2,
                          })}
                          <small>{quote.currency}</small>
                        </strong>
                        <b className={positive ? "up" : "down"}>
                          {positive ? "▲" : "▼"}{" "}
                          {Math.abs(quote.changePercent ?? 0).toFixed(2)} %
                        </b>
                      </footer>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                label={feedErrors.includes("Märkte") ? "Kurse nicht verfügbar" : "Keine Märkte"}
              />
            )}
          </main>
        );
      }
      case "photos": {
        const photo = selectedPhotos[photoIndex % Math.max(1, selectedPhotos.length)];
        return photo?.signedUrl ? (
          <main className="photo-view">
            {/* Signed storage URLs cannot be known to Next Image at build time. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.signedUrl} alt={photo.caption ?? ""} />
            <div className="photo-shade" />
            <p className="photo-counter">
              {String(photoIndex + 1).padStart(2, "0")} /{" "}
              {String(selectedPhotos.length).padStart(2, "0")}
            </p>
            {photo.caption && <h2>{photo.caption}</h2>}
          </main>
        ) : (
          <main className="full-view">
            <EmptyState
              label={selectedPhotos.length ? "Bild nicht verfügbar" : "Keine Fotos"}
              detail={
                selectedPhotos.length
                  ? "Der sichere Bildlink konnte nicht geladen werden."
                  : undefined
              }
            />
          </main>
        );
      }
      case "webpage": {
        const page = data.webpages.find(
          (item) => !entry.referenceId || item.id === entry.referenceId,
        );
        return page ? (
          <main className="web-view">
            <div className="web-view__bar">
              <span>EXTERN</span>
              <strong>{page.title}</strong>
              <small>{new URL(page.url).hostname}</small>
            </div>
            <iframe
              key={`${page.id}-${Math.floor(now.getTime() / (page.refreshSeconds * 1000))}`}
              src={page.url}
              title={page.title}
              sandbox="allow-scripts allow-forms allow-popups"
              referrerPolicy="no-referrer"
            />
            <div className="web-fallback">
              <strong>{page.title}</strong>
              <p>
                Falls die externe Seite Einbettungen blockiert, bleibt diese
                sichere Vorschau leer.
              </p>
              <code>{page.url}</code>
            </div>
          </main>
        ) : (
          <main className="full-view">
            <EmptyState label="Keine Webseite ausgewählt" />
          </main>
        );
      }
      case "custom_text": {
        const text = data.customTexts.find(
          (item) => !entry.referenceId || item.id === entry.referenceId,
        );
        return (
          <main className="text-view">
            {text ? (
              <>
                <p className="eyebrow">Notiz an alle</p>
                {text.title && <h1>{text.title}</h1>}
                <div className="text-view__body">{text.body}</div>
              </>
            ) : (
              <EmptyState label="Keine Mitteilung" />
            )}
          </main>
        );
      }
    }
  }

  return (
    <div
      className="display-board"
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const distance = (event.changedTouches[0]?.clientX ?? 0) - touchStart.current;
        if (Math.abs(distance) > 60) navigate(distance < 0 ? 1 : -1);
        touchStart.current = null;
      }}
    >
      <header className="display-header">
        <div className="date-lockup">
          <span>Heute</span>
          <strong>{dayFormatter.format(now)}</strong>
        </div>
        <time className="clock">{timeFormatter.format(now)}</time>
      </header>

      <div className="display-stage">
        {data.error ? (
          <main className="fatal-state">
            <span>!</span>
            <div>
              <p className="eyebrow">Anzeige nicht bereit</p>
              <h1>{data.error}</h1>
              <p>Konfiguration und Verbindung prüfen; die Anzeige versucht es beim nächsten Laden erneut.</p>
            </div>
          </main>
        ) : activeEntry ? (
          renderEntry(activeEntry)
        ) : (
          renderOverview()
        )}
      </div>

      <footer className="display-footer">
        <div className="status">
          <span className={stale || data.error ? "status__dot status__dot--warn" : "status__dot"} />
          {data.error ? "OFFLINE" : stale ? "DATEN VERALTET" : mode}
          {feedErrors.length > 0 && (
            <small>· {feedErrors.join(", ")} eingeschränkt</small>
          )}
        </div>
        <div className="playlist-nav" aria-label="Playlist-Navigation">
          <button type="button" onClick={() => navigate(-1)} aria-label="Vorherige Ansicht">
            ←
          </button>
          <span>
            {activeEntries.length
              ? `${String(selectedIndex + 1).padStart(2, "0")} / ${String(activeEntries.length).padStart(2, "0")}`
              : "ÜBERSICHT"}
          </span>
          <button type="button" onClick={() => navigate(1)} aria-label="Nächste Ansicht">
            →
          </button>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ transform: `scaleX(${entryProgress})` }} />
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ index, title }: { index: string; title: string }) {
  return (
    <header className="section-heading">
      <span>{index}</span>
      <h1>{title}</h1>
    </header>
  );
}

function Forecast({ weather }: { weather: WeatherData | null }) {
  if (!weather) return <div className="forecast-placeholder" />;
  const future = weather.forecast
    .filter((point) => point.date >= new Date().toLocaleDateString("sv-SE", { timeZone: ZONE }))
    .slice(0, 6);
  if (!future.length)
    return (
      <EmptyState
        label="Keine Prognose"
        detail="Aktuelles Wetter ist verfügbar."
      />
    );
  return (
    <div className="forecast">
      {future.map((point) => (
        <div key={point.date}>
          <time>
            {shortDayFormatter.format(new Date(`${point.date}T12:00:00Z`))}
          </time>
          <WeatherIcon code={point.weatherCode} compact />
          <strong>
            {Math.round(point.temperatureMaxCelsius)}° /{" "}
            {Math.round(point.temperatureMinCelsius)}°
          </strong>
          <small>
            {point.precipitationProbabilityPercent === null
              ? "—"
              : `${Math.round(point.precipitationProbabilityPercent)} %`}
          </small>
        </div>
      ))}
    </div>
  );
}

function EventList({
  events,
  large = false,
}: {
  events: ReturnType<typeof expandEvents>;
  large?: boolean;
}) {
  if (!events.length)
    return (
      <EmptyState
        label="Keine Termine"
        detail="Für die nächsten zwei Wochen ist nichts eingetragen."
      />
    );
  return (
    <div className={large ? "event-list event-list--large" : "event-list"}>
      {events.map((event) => (
        <article key={`${event.sourceEventId}-${event.startsAt}`}>
          <span
            className="event-color"
            style={{ backgroundColor: event.color ?? "#f0ff36" }}
          />
          <time>
            {event.allDay
              ? new Intl.DateTimeFormat("de-CH", {
                  timeZone: ZONE,
                  weekday: "short",
                  day: "2-digit",
                  month: "2-digit",
                }).format(new Date(event.startsAt))
              : dateTimeFormatter.format(new Date(event.startsAt))}
          </time>
          <h2>{event.title}</h2>
          <small>{event.allDay ? "ganztägig" : `bis ${timeFormatter.format(new Date(event.endsAt))}`}</small>
        </article>
      ))}
    </div>
  );
}

function DepartureList({
  departures,
  error,
}: {
  departures: Departure[] | null;
  error: boolean;
}) {
  if (departures === null)
    return error ? (
      <EmptyState
        label="Abfahrten nicht verfügbar"
        detail="Der Verkehrsdienst antwortet momentan nicht."
      />
    ) : (
      <LoadingState label="Fahrplan" />
    );
  if (!departures.length)
    return (
      <EmptyState
        label="Keine Abfahrten"
        detail="Zurzeit wurden keine Verbindungen gefunden."
      />
    );
  return (
    <div className="departure-list">
      {departures.slice(0, 5).map((departure) => {
        const isBus =
          departure.category?.toLowerCase() === "bus" ||
          departure.category?.toLowerCase() === "b" ||
          /^0{2,}\d+$/.test(departure.line.replace(/\s/g, ""));
        return (
          <article key={departure.id}>
            <strong>
              {isBus ? (
                <svg className="bus-icon" viewBox="0 0 32 32" aria-label="Bus">
                  <rect x="6" y="4" width="20" height="22" rx="5" />
                  <path d="M9 8h14v8H9zM10 20h3M19 20h3" />
                  <circle cx="11" cy="27" r="2" />
                  <circle cx="21" cy="27" r="2" />
                </svg>
              ) : (
                departure.line
              )}
            </strong>
            <div>
              <h2>{departure.destination}</h2>
              {departure.platform ? <small>Gleis {departure.platform}</small> : null}
            </div>
            <time>
              {timeFormatter.format(new Date(departure.departureAt))}
              {(departure.delayMinutes ?? 0) > 0 && (
                <em>+{departure.delayMinutes}</em>
              )}
            </time>
          </article>
        );
      })}
    </div>
  );
}
