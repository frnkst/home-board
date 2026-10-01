import { NextResponse } from "next/server";

import {
  authorizeAdminApi,
  providerErrorResponse,
} from "@/app/api/_lib/response";
import { getDailyFact } from "@/lib/providers/daily-fact";

export async function GET() {
  const authError = await authorizeAdminApi();
  if (authError) return authError;
  try {
    return NextResponse.json(await getDailyFact());
  } catch (error) {
    return providerErrorResponse(error);
  }
}
