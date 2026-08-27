/**
 * Typed fetch wrapper around the PBX REST API.
 *
 * Features:
 *  - Prefixes every request with NEXT_PUBLIC_API_BASE_URL.
 *  - Attaches `Authorization: Bearer <access>` from auth-storage.
 *  - On 401, performs a single POST /auth/refresh using the stored refresh
 *    token, then retries the original request once. If refresh fails, it
 *    clears the session and redirects to /login.
 *  - Concurrent 401s share a single in-flight refresh (no thundering herd).
 *  - Exposes get / post / patch / del helpers and a PaginatedResult<T> type.
 */
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  updateTokens,
} from "./auth-storage";
import type { RefreshResponse } from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://10.23.88.125:3001/api";

/**
 * Standard envelope for list endpoints — matches the backend `paginate()`
 * helper exactly (src/common/dto/pagination.dto.ts): { data, total, page,
 * limit, totalPages }.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Query params accepted by backend list endpoints (PaginationDto). */
export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface RequestOptions {
  /** Query string params (arrays/objects are JSON-stringified). */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Extra headers merged over defaults. */
  headers?: Record<string, string>;
  /** Skip attaching the Authorization header (e.g. /auth/login). */
  skipAuth?: boolean;
  /** Skip the 401 -> refresh -> retry flow. */
  skipRefresh?: boolean;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

/** Error thrown for any non-2xx response. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/* ------------------------------------------------------------------ */
/* Internals                                                          */
/* ------------------------------------------------------------------ */

function buildUrl(
  path: string,
  params?: RequestOptions["params"],
): string {
  const base = API_BASE_URL.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${suffix}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

// Shared in-flight refresh promise so simultaneous 401s only refresh once.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as RefreshResponse;
      updateTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      // Cleared after the promise resolves; callers already captured it.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
}

async function parseBody(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") ?? "";
  if (res.status === 204) return null;
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const doFetch = async (accessToken: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...options.headers,
    };
    const isFormData =
      typeof FormData !== "undefined" && body instanceof FormData;
    if (body !== undefined && !isFormData) {
      headers["Content-Type"] = "application/json";
    }
    if (!options.skipAuth && accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    return fetch(buildUrl(path, options.params), {
      method,
      headers,
      signal: options.signal,
      body:
        body === undefined
          ? undefined
          : isFormData
            ? (body as FormData)
            : JSON.stringify(body),
    });
  };

  let res = await doFetch(getAccessToken());

  // 401 -> try to refresh once, then retry the original request.
  if (
    res.status === 401 &&
    !options.skipAuth &&
    !options.skipRefresh &&
    path !== "/auth/refresh" &&
    path !== "/auth/login"
  ) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
    } else {
      clearSession();
      redirectToLogin();
      throw new ApiError(401, "Session expired", null);
    }
    if (res.status === 401) {
      clearSession();
      redirectToLogin();
      throw new ApiError(401, "Session expired", null);
    }
  }

  if (!res.ok) {
    const errBody = await parseBody(res).catch(() => null);
    let message = `Request failed with status ${res.status}`;
    if (errBody && typeof errBody === "object" && "message" in errBody) {
      const m = (errBody as { message: unknown }).message;
      message = Array.isArray(m) ? m.join(", ") : String(m);
    }
    throw new ApiError(res.status, message, errBody);
  }

  return (await parseBody(res)) as T;
}

/* ------------------------------------------------------------------ */
/* Public helpers                                                     */
/* ------------------------------------------------------------------ */

export function get<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>("GET", path, undefined, options);
}

export function post<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request<T>("POST", path, body, options);
}

export function put<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request<T>("PUT", path, body, options);
}

export function patch<T>(
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return request<T>("PATCH", path, body, options);
}

export function del<T>(
  path: string,
  options?: RequestOptions,
): Promise<T> {
  return request<T>("DELETE", path, undefined, options);
}

export const api = { get, post, put, patch, del };

export { API_BASE_URL };
