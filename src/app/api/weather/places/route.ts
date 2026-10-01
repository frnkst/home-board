import { NextResponse, type NextRequest } from "next/server";

import {
  authorizeAdminApi,
  numberParam,
  providerErrorResponse,
} from "@/app/api/_lib/response";
import { searchPlaces } from "@/lib/providers/open-meteo";

export async function GET(request: NextRequest) {
  const authError = await authorizeAdminApi();
  if (authError) return authError;
  try {
    const query = request.nextUrl.searchParams;
    const result = await searchPlaces({
      query: query.get("q") ?? "",
      limit: numberParam(query.get("limit")),
      language: query.get("language") ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return providerErrorResponse(error);
  }
}

