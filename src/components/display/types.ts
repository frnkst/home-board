import type {
  AppSettings,
  CalendarEvent,
  Countdown,
  CustomText,
  DisplayState,
  MarketSymbol,
  Photo,
  PlaylistEntry,
  Webpage,
} from "@/lib/domain/types";

export type DisplayPhoto = Photo & { signedUrl: string | null };

export type DisplayData = {
  settings: AppSettings | null;
  events: CalendarEvent[];
  countdowns: Countdown[];
  marketSymbols: MarketSymbol[];
  photos: DisplayPhoto[];
  webpages: Webpage[];
  customTexts: CustomText[];
  playlist: PlaylistEntry[];
  displayState: DisplayState | null;
  loadedAt: string;
  error: string | null;
};

export type WeatherPoint = {
  date: string;
  temperatureMaxCelsius: number;
  temperatureMinCelsius: number;
  precipitationMm: number;
  precipitationProbabilityPercent: number | null;
  windSpeedMaxKmh: number;
  weatherCode: number | null;
};

export type WeatherData = {
  temperature: number;
  apparentTemperatureCelsius: number | null;
  precipitationMm: number | null;
  windSpeedKmh: number | null;
  windDirectionDegrees: number | null;
  weatherCode: number | null;
  updatedAt: string;
  forecast: WeatherPoint[];
};

export type Departure = {
  id: string;
  line: string;
  destination: string;
  departureAt: string;
  delayMinutes: number | null;
  platform: string | null;
};

export type MarketQuote = {
  symbol: string;
  price: number;
  changePercent: number | null;
  currency: string;
  updatedAt: string;
  history: { at: string; value: number }[];
};
