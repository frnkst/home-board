import { NextResponse, type NextRequest } from "next/server";

import {
  authorizeAdminApi,
  providerErrorResponse,
  requiredNumberParam,
} from "@/app/api/_lib/response";
import { getCurrentWeather } from "@/lib/providers/open-meteo";

export async function GET(request: NextRequest) {
  const authError = await authorizeAdminApi();
  if (authError) return authError;
  try {
    const query = request.nextUrl.searchParams;
    const result = await getCurrentWeather({
      latitude: requiredNumberParam(query.get("latitude")),
      longitude: requiredNumberParam(query.get("longitude")),
      timezone: query.get("timezone") ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return providerErrorResponse(error);
  }
}
