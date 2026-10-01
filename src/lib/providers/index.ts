import "server-only";

export { ProviderError, normalizeProviderError } from "@/lib/providers/errors";
export {
  getCurrentWeather,
  getWeatherForecast,
  searchPlaces,
} from "@/lib/providers/open-meteo";
export { getDepartures, searchStops } from "@/lib/providers/transport";
export { marketDataProvider } from "@/lib/providers/markets/stooq";
export type {
  MarketDataProvider,
  MarketHistory,
  MarketQuote,
} from "@/lib/providers/markets/types";
