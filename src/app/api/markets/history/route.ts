import { NextResponse, type NextRequest } from "next/server";

import {
  authorizeAdminApi,
  providerErrorResponse,
} from "@/app/api/_lib/response";
import { marketDataProvider } from "@/lib/providers/markets/stooq";

export async function GET(request: NextRequest) {
  const authError = await authorizeAdminApi();
  if (authError) return authError;
  try {
    const query = request.nextUrl.searchParams;
    const history = await marketDataProvider.getHistory(
      query.get("symbol") ?? "",
      {
        from: query.get("from") ?? "",
        to: query.get("to") ?? "",
      },
    );
    return NextResponse.json(history);
  } catch (error) {
    return providerErrorResponse(error);
  }
}
