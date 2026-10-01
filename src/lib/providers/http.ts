import "server-only";

import { ProviderError, normalizeProviderError } from "@/lib/providers/errors";

const DEFAULT_TIMEOUT_MS = 8_000;

type NextFetchInit = RequestInit & {
  next?: { revalidate?: number; tags?: string[] };
};

export async function fetchProviderJson(
  url: URL,
  init: NextFetchInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  const response = await fetchProvider(url, init, timeoutMs);
  try {
    return await response.json();
  } catch (error) {
    throw new ProviderError("INVALID_RESPONSE", { cause: error });
  }
}

export async function fetchProviderText(
  url: URL,
  init: NextFetchInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const response = await fetchProvider(url, init, timeoutMs);
  try {
    return await response.text();
  } catch (error) {
    throw new ProviderError("INVALID_RESPONSE", { cause: error });
  }
}

async function fetchProvider(
  url: URL,
  init: NextFetchInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const code =
        response.status === 404
          ? "NOT_FOUND"
          : response.status === 429
            ? "RATE_LIMITED"
            : "UPSTREAM_UNAVAILABLE";
      throw new ProviderError(code, { status: response.status });
    }
    return response;
  } catch (error) {
    throw normalizeProviderError(error);
  }
}

