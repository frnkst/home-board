import "server-only";

import { NextResponse } from "next/server";

import { getRequestUser, isAdmin } from "@/lib/auth";
import { ProviderError, normalizeProviderError } from "@/lib/providers/errors";

export async function authorizeAdminApi(): Promise<NextResponse | null> {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Anmeldung erforderlich." } },
        { status: 401 },
      );
    }
    if (!isAdmin(user)) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Für diese Anfrage fehlt die Berechtigung.",
          },
        },
        { status: 403 },
      );
    }
    return null;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "AUTH_UNAVAILABLE",
          message: "Die Anmeldung konnte nicht geprüft werden.",
        },
      },
      { status: 503 },
    );
  }
}

export function providerErrorResponse(error: unknown): NextResponse {
  const normalized = normalizeProviderError(error);
  const status =
    normalized.code === "RATE_LIMITED"
      ? 503
      : normalized.code === "TIMEOUT"
        ? 504
        : normalized.code === "UPSTREAM_UNAVAILABLE" ||
            normalized.code === "INVALID_RESPONSE"
          ? 502
          : normalized.status;
  return NextResponse.json(
    {
      error: {
        code: normalized.code,
        message: normalized.message,
        retryable: normalized.retryable,
      },
    },
    { status },
  );
}

export function numberParam(value: string | null): number | undefined {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new ProviderError("INVALID_REQUEST");
  return parsed;
}

export function requiredNumberParam(value: string | null): number {
  const parsed = numberParam(value);
  if (parsed === undefined) throw new ProviderError("INVALID_REQUEST");
  return parsed;
}
