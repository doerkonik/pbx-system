"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Search, LayoutGrid, Settings, History, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import { NotificationsBell } from "./NotificationsBell";
import { ThemeToggle } from "./ThemeToggle";
import {
  ADMIN_NAV_GROUPS,
  AGENT_NAV_GROUPS,
  type NavItem,
} from "./nav-config";
import type { UserRole } from "@/lib/types";

export interface TopbarProps {
  role: UserRole;
  /** Dashboard root for this role — the apps/grid icon links here. */
  homeHref: string;
  /** Settings destination for the gear icon. */
  settingsHref: string;
  /** Call-history destination for the clock icon. */
  historyHref: string;
  name: string;
  subtitle?: string;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

const iconButton =
  "flex h-9 w-9 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink-muted";

/**
 * Sticky 64px top navbar: sidebar toggle + nav search on the left, an icon
 * cluster (theme, apps, notifications, settings, history) and the user avatar
 * menu on the right.
 */
export function Topbar({
  role,
  homeHref,
  settingsHref,
  historyHref,
  name,
  subtitle,
  onToggleSidebar,
  onLogout,
}: TopbarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openResults, setOpenResults] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Flatten the role's nav so the search box can jump straight to a page.
  const allItems: NavItem[] = useMemo(() => {
    const groups = role === "admin" ? ADMIN_NAV_GROUPS : AGENT_NAV_GROUPS;
    return groups.flatMap((g) => g.items);
  }, [role]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allItems.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 7);
  }, [query, allItems]);

  // Close the popovers on any outside click.
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpenResults(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const go = (href: string) => {
    setQuery("");
    setOpenResults(false);
    router.push(href);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        className={iconButton}
      >
        <Menu size={20} strokeWidth={1.8} />
      </button>

      {/* Nav quick-search */}
      <div ref={searchRef} className="relative w-full max-w-xs">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
        />
        <input
          type="search"
          value={query}
          placeholder="Search..."
          onChange={(e) => {
            setQuery(e.target.value);
            setOpenResults(true);
          }}
          onFocus={() => setOpenResults(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) go(matches[0].href);
            if (e.key === "Escape") setOpenResults(false);
          }}
          className="h-9 w-full rounded-lg bg-surface-sunken pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        {openResults && matches.length > 0 && (
          <div className="absolute left-0 top-full z-40 mt-2 w-full overflow-hidden rounded-card border border-line bg-surface shadow-pop animate-scale-in">
            {matches.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.href}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(m.href)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-surface-muted"
                >
                  <Icon size={16} strokeWidth={1.8} className="shrink-0 text-ink-subtle" />
                  <span className="truncate">{m.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right icon cluster */}
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <Link href={homeHref} aria-label="Dashboard" title="Dashboard" className={cn(iconButton, "hidden sm:flex")}>
          <LayoutGrid size={20} strokeWidth={1.8} />
        </Link>
        <NotificationsBell />
        <Link
          href={settingsHref}
          aria-label="Settings"
          title="Settings"
          className={cn(iconButton, "hidden sm:flex")}
        >
          <Settings size={20} strokeWidth={1.8} />
        </Link>
        <Link
          href={historyHref}
          aria-label="Call history"
          title="Call history"
          className={cn(iconButton, "hidden sm:flex")}
        >
          <History size={20} strokeWidth={1.8} />
        </Link>

        {/* User avatar + menu */}
        <div ref={menuRef} className="relative ml-1">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Account menu"
            className="flex items-center rounded-full transition-opacity hover:opacity-85"
          >
            <Avatar name={name} size="md" className="h-9 w-9" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-card border border-line bg-surface shadow-pop animate-scale-in">
              <div className="border-b border-line-soft px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-ink">{name}</p>
                {subtitle && (
                  <p className="truncate text-xs text-ink-subtle">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
