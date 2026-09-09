/**
 * The one place every request to the Express API passes through.
 *
 * Server components (pages, layouts) call `apiFetch` directly with an
 * absolute base URL. Client components go through the same function — Next.js
 * resolves a relative `/api/v1/...` path against the browser's own origin, so
 * a client-side call needs the full `NEXT_PUBLIC_API_URL` too, which this
 * reads automatically.
 *
 * Every response is expected to carry either the payload or the error
 * envelope `{ error: { code, message, details } }` the server defines in
 * server/src/lib/errors.ts. Callers get a typed `ApiError` they can switch on
 * `.code`, never a raw fetch rejection.
 */

const BASE_URL =
  typeof window === "undefined"
    ? (process.env.API_URL ?? "http://localhost:4000/api/v1")
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1");

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Attaches `Authorization: Bearer <token>` for routes that require sign-in. */
  idToken?: string | null;
  /** Attaches Idempotency-Key for POST /checkout/orders. */
  idempotencyKey?: string;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, idToken, idempotencyKey, headers, ...rest } = options;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    method: options.method ?? (body !== undefined ? "POST" : "GET"),
    // The guest cart cookie is httpOnly and signed server-side; it only ever
    // travels if the browser is told to send credentials.
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // Server components fetching commerce data (stock, prices) must never
    // serve a cached response — Next.js defaults GET requests to "force-cache"
    // otherwise, which would show sold-out sizes as available.
    cache: options.cache ?? "no-store",
  });

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const envelope = data as { error?: { code?: string; message?: string; details?: Record<string, unknown> } };
    throw new ApiError(
      response.status,
      envelope?.error?.code ?? "UNKNOWN",
      envelope?.error?.message ?? "Something went wrong. Try again.",
      envelope?.error?.details ?? {},
    );
  }

  return data as T;
}

/**
 * A file upload, sent as multipart form data. Kept separate from `apiFetch`
 * because that function always sends JSON — a multipart body needs the
 * browser to generate its own boundary in the Content-Type header, which
 * setting one by hand would break.
 */
export async function uploadFile(
  path: string,
  file: File,
  idToken: string | null,
): Promise<{ url: string; width: number; height: number }> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
    body: form,
  });

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const envelope = data as { error?: { code?: string; message?: string; details?: Record<string, unknown> } };
    throw new ApiError(
      response.status,
      envelope?.error?.code ?? "UNKNOWN",
      envelope?.error?.message ?? "Could not upload that file.",
      envelope?.error?.details ?? {},
    );
  }

  return data as { url: string; width: number; height: number };
}

/** Builds a query string, dropping empty arrays and undefined values. */
export function toQuery(params: Record<string, string | number | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(","));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
