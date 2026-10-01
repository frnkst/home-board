import { NextResponse, type NextRequest } from "next/server";

import {
  authorizeAdminApi,
  providerErrorResponse,
} from "@/app/api/_lib/response";
import { marketDataProvider } from "@/lib/providers/markets/yahoo";

export async function GET(request: NextRequest) {
  const authError = await authorizeAdminApi();
  if (authError) return authError;
  try {
    const symbols = (request.nextUrl.searchParams.get("symbols") ?? "")
      .split(",")
      .map((symbol) => symbol.trim())
      .filter(Boolean);
    const quotes = await marketDataProvider.getQuotes(symbols);
    return NextResponse.json({
      quotes,
      fetchedAt: new Date().toISOString(),
      stale: quotes.some((quote) => quote.stale),
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
