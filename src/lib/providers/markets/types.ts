import "server-only";

export interface MarketQuote {
  symbol: string;
  name: string | null;
  currency: string | null;
  price: number;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  volume: number | null;
  observedAt: string;
  fetchedAt: string;
  delayed: true;
  stale: boolean;
}

export interface MarketHistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface MarketHistory {
  symbol: string;
  currency: string | null;
  points: MarketHistoryPoint[];
  observedAt: string | null;
  fetchedAt: string;
  delayed: true;
  stale: boolean;
}

export interface MarketDataProvider {
  getQuotes(symbols: string[]): Promise<MarketQuote[]>;
  getHistory(
    symbol: string,
    options: { from: string; to: string },
  ): Promise<MarketHistory>;
}

