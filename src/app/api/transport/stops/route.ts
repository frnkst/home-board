import { NextResponse, type NextRequest } from "next/server";

import {
  authorizeAdminApi,
  numberParam,
  providerErrorResponse,
} from "@/app/api/_lib/response";
import { searchStops } from "@/lib/providers/transport";

export async function GET(request: NextRequest) {
  const authError = await authorizeAdminApi();
  if (authError) return authError;
  try {
    const query = request.nextUrl.searchParams;
    const result = await searchStops({
      query: query.get("q") ?? "",
      limit: numberParam(query.get("limit")),
    });
    return NextResponse.json(result);
  } catch (error) {
    return providerErrorResponse(error);
  }
}

