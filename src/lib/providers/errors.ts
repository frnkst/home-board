import "server-only";

export type ProviderErrorCode =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "UPSTREAM_UNAVAILABLE"
  | "INVALID_RESPONSE";

const DEFAULT_MESSAGES: Record<ProviderErrorCode, string> = {
  INVALID_REQUEST: "Die Anfrage enthält ungültige Angaben.",
  NOT_FOUND: "Für diese Anfrage wurden keine Daten gefunden.",
  RATE_LIMITED: "Der Datendienst ist momentan ausgelastet. Bitte später erneut versuchen.",
  TIMEOUT: "Der Datendienst hat nicht rechtzeitig geantwortet.",
  UPSTREAM_UNAVAILABLE: "Der Datendienst ist momentan nicht erreichbar.",
  INVALID_RESPONSE: "Der Datendienst hat unerwartete Daten geliefert.",
};

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    code: ProviderErrorCode,
    options?: { message?: string; status?: number; cause?: unknown },
  ) {
    super(options?.message ?? DEFAULT_MESSAGES[code], { cause: options?.cause });
    this.name = "ProviderError";
    this.code = code;
    this.status =
      options?.status ??
      (code === "INVALID_REQUEST" ? 400 : code === "NOT_FOUND" ? 404 : 502);
    this.retryable = ["RATE_LIMITED", "TIMEOUT", "UPSTREAM_UNAVAILABLE"].includes(
      code,
    );
  }
}

export function normalizeProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  if (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return new ProviderError("TIMEOUT", { cause: error });
  }
  return new ProviderError("UPSTREAM_UNAVAILABLE", { cause: error });
}

