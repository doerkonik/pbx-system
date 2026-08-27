"use client";

/**
 * Data hooks for the softphone's Contacts and Recent tabs, backed by the
 * agent-scoped endpoints GET /softphone/directory and GET /softphone/call-logs.
 * Personal favorites are kept in localStorage (per browser) — the backend has
 * no per-agent favorites concept and they're purely a UI convenience.
 */
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { DirectoryEntry, CallLogEntry } from "./softphone-context";

const FAV_KEY = "pbx.softphone.favorites";

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAV_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function useDirectory() {
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setFavorites(readFavorites());
    api
      .get<DirectoryEntry[]>("/softphone/directory")
      .then((rows) => active && setEntries(Array.isArray(rows) ? rows : []))
      .catch(
        (e) => active && setError(e instanceof Error ? e.message : "Failed"),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const toggleFavorite = useCallback((extension: string) => {
    setFavorites((prev) => {
      const next = prev.includes(extension)
        ? prev.filter((x) => x !== extension)
        : [...prev, extension];
      try {
        window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        /* storage full/blocked — favorites just won't persist */
      }
      return next;
    });
  }, []);

  return { entries, favorites, toggleFavorite, loading, error };
}

export function useCallLogs(refreshKey: unknown) {
  const [logs, setLogs] = useState<CallLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    let active = true;
    setError(null);
    api
      .get<CallLogEntry[]>("/softphone/call-logs")
      .then((rows) => active && setLogs(Array.isArray(rows) ? rows : []))
      .catch(
        (e) => active && setError(e instanceof Error ? e.message : "Failed"),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Reload on mount and whenever refreshKey changes (e.g. a call just ended).
  useEffect(() => {
    const cancel = reload();
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, reload]);

  return { logs, loading, error, reload };
}
