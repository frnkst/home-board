import { NextResponse, type NextRequest } from "next/server";

import {
  authorizeAdminApi,
  numberParam,
  providerErrorResponse,
} from "@/app/api/_lib/response";
import { getDepartures } from "@/lib/providers/transport";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const authError = await authorizeAdminApi();
  if (authError) return authError;
  try {
    const query = request.nextUrl.searchParams;
    const supabase = await createClient();
    const { data: settings, error } = await supabase
      .from("app_settings")
      .select("transport_stop_id,transport_departure_count")
      .eq("id", true)
      .single();
    if (error) throw error;
    const result = await getDepartures({
      stationId: query.get("stationId") ?? settings.transport_stop_id,
      limit: numberParam(query.get("limit")) ?? settings.transport_departure_count,
    });
    return NextResponse.json({
      ...result,
      departures: result.departures.map((departure) => ({
        ...departure,
        departureAt: departure.expectedAt,
      })),
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
