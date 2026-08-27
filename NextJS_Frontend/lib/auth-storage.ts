/**
 * Token & session persistence backed by localStorage.
 *
 * Kept intentionally tiny and framework-free so both the fetch wrapper
 * (`lib/api.ts`) and the React auth context (`lib/auth-context.tsx`) can
 * read/write the same source of truth without a circular dependency.
 */
import type { AuthUser } from "./types";

const ACCESS_KEY = "pbx.access";
const REFRESH_KEY = "pbx.refresh";
const USER_KEY = "pbx.user";

const isBrowser = (): boolean => typeof window !== "undefined";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_KEY, token);
}

export function setSession(session: StoredSession): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_KEY, session.accessToken);
  window.localStorage.setItem(REFRESH_KEY, session.refreshToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function updateTokens(accessToken: string, refreshToken: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACCESS_KEY, accessToken);
  window.localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearSession(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.localStorage.removeItem(USER_KEY);
}
