import { NextResponse, type NextRequest } from "next/server";

import {
  authorizeAdminApi,
  numberParam,
  providerErrorResponse,
  requiredNumberParam,
} from "@/app/api/_lib/response";
import { getWeatherForecast } from "@/lib/providers/open-meteo";

export async function GET(request: NextRequest) {
  const authError = await authorizeAdminApi();
  if (authError) return authError;
  try {
    const query = request.nextUrl.searchParams;
    const result = await getWeatherForecast({
      latitude: requiredNumberParam(query.get("latitude")),
      longitude: requiredNumberParam(query.get("longitude")),
      timezone: query.get("timezone") ?? undefined,
      days: numberParam(query.get("days")),
    });
    return NextResponse.json(result);
  } catch (error) {
    return providerErrorResponse(error);
  }
}
