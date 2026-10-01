import { NextResponse, type NextRequest } from "next/server";

import {
  authorizeAdminApi,
  numberParam,
  providerErrorResponse,
} from "@/app/api/_lib/response";
import {
  getCurrentWeather,
  getWeatherForecast,
} from "@/lib/providers/open-meteo";
import { getClothingAdvice } from "@/lib/providers/openrouter";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const authError = await authorizeAdminApi();
  if (authError) return authError;
  try {
    const query = request.nextUrl.searchParams;
    const supabase = await createClient();
    const { data: settings, error } = await supabase
      .from("app_settings")
      .select("weather_place_name,weather_latitude,weather_longitude,weather_forecast_days")
      .eq("id", true)
      .single();
    if (error) throw error;
    const location = {
      latitude: numberParam(query.get("latitude")) ?? settings.weather_latitude,
      longitude: numberParam(query.get("longitude")) ?? settings.weather_longitude,
      timezone: query.get("timezone") ?? undefined,
    };
    const [current, forecast] = await Promise.all([
      getCurrentWeather(location),
      getWeatherForecast({
        ...location,
        days: numberParam(query.get("days")) ?? settings.weather_forecast_days,
      }),
    ]);
    let clothingAdvice = null;
    try {
      clothingAdvice = await getClothingAdvice(
        { current, forecast: forecast.days },
        {
          latitude: location.latitude,
          longitude: location.longitude,
          name: settings.weather_place_name,
        },
      );
    } catch (adviceError) {
      console.error("OpenRouter clothing advice failed", adviceError);
    }
    return NextResponse.json({
      current: {
        ...current,
        apparentTemperatureCelsius: current.apparentTemperatureCelsius,
      },
      forecast: forecast.days,
      clothingAdvice,
      fetchedAt:
        current.fetchedAt > forecast.fetchedAt
          ? current.fetchedAt
          : forecast.fetchedAt,
      stale: current.stale || forecast.stale,
      timezone: current.timezone,
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
