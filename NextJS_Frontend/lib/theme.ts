"use client";

/**
 * Light/dark theme control. The active theme is a `dark` class on <html>
 * (Tailwind darkMode: "class"), persisted in localStorage under `pbx-theme`.
 * A blocking script in the root layout applies it before paint (no flash);
 * this hook only reads/mutates the same source of truth.
 */
import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "pbx-theme";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  // Sync from the DOM after mount (the pre-hydration script already set it).
  useEffect(() => {
    setThemeState(currentTheme());
  }, []);

  const setTheme = useCallback((t: Theme) => {
    const el = document.documentElement;
    el.classList.toggle("dark", t === "dark");
    el.style.colorScheme = t;
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  }, [setTheme]);

  return { theme, setTheme, toggle };
}
