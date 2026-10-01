export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Common = {
  id: string;
  created_at: string;
  updated_at: string;
  enabled: boolean;
  sort_order: number;
};

export type Database = {
  public: {
    Tables: {
      app_settings: Table<{
        id: boolean;
        household_name: string;
        timezone: string;
        locale: string;
        weather_place_name: string;
        weather_latitude: number;
        weather_longitude: number;
        weather_forecast_days: number;
        transport_stop_name: string;
        transport_stop_id: string;
        transport_departure_count: number;
        created_at: string;
        updated_at: string;
      }>;
      events: Table<
        Omit<Common, "sort_order"> & {
          title: string;
          description: string | null;
          starts_at: string;
          ends_at: string;
          all_day: boolean;
          color: string | null;
          recurrence: Json | null;
        }
      >;
      countdowns: Table<
        Common & { title: string; target_at: string; color: string | null }
      >;
      live_countdowns: Table<
        Common & {
          title: string;
          target_at: string;
          completion_text: string;
        }
      >;
      market_symbols: Table<
        Common & { symbol: string; label: string; currency: string }
      >;
      photos: Table<
        Common & { storage_path: string; caption: string | null }
      >;
      webpages: Table<
        Common & { title: string; url: string; refresh_seconds: number }
      >;
      custom_texts: Table<
        Common & { title: string | null; body: string }
      >;
      playlist_entries: Table<
        Common & {
          kind:
            | "overview"
            | "weather"
            | "departures"
            | "events"
            | "countdowns"
            | "live_countdown"
            | "markets"
            | "photos"
            | "webpage"
            | "custom_text";
          reference_id: string | null;
          duration_seconds: number;
        }
      >;
      display_state: Table<{
        id: boolean;
        playlist_started_at: string;
        paused_at: string | null;
        forced_entry_id: string | null;
        created_at: string;
        updated_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      playlist_kind:
        | "overview"
        | "weather"
        | "departures"
        | "events"
        | "countdowns"
        | "live_countdown"
        | "markets"
        | "photos"
        | "webpage"
        | "custom_text";
    };
    CompositeTypes: Record<string, never>;
  };
};
