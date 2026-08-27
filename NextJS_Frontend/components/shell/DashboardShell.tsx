"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth, useRequireAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui";
import type { NavItem } from "./nav-config";
import type { UserRole } from "@/lib/types";
import { NavRail } from "./NavRail";
import { Topbar } from "./Topbar";

export interface DashboardShellProps {
  /** Role required to view this section; guards + redirects if mismatched. */
  role: UserRole;
  /** Optional nav override (kept for API compatibility). */
  nav?: NavItem[];
  /** Home href (dashboard root) for this role. */
  homeHref: string;
  children: React.ReactNode;
}

const STORAGE_KEY = "pbx-nav-collapsed";

/** Per-role destinations for the topbar's settings + history icons. */
const SHORTCUTS: Record<UserRole, { settings: string; history: string }> = {
  admin: { settings: "/admin/system", history: "/admin/cdr" },
  // Supervisors satisfy admin views (see `roleSatisfies`), so they share them.
  supervisor: { settings: "/admin/system", history: "/admin/cdr" },
  agent: { settings: "/agent/forwarding", history: "/agent/calls" },
};

/**
 * Authenticated chrome: white sidebar + sticky top navbar over a soft gray
 * canvas. Enforces auth and role via `useRequireAuth`.
 */
export function DashboardShell({ role, homeHref, children }: DashboardShellProps) {
  const { user, loading } = useRequireAuth(role);
  const { logout } = useAuth();

  // Desktop: icon-only rail. Mobile: off-canvas drawer.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  // One hamburger drives both behaviours depending on viewport width.
  const toggleSidebar = useCallback(() => {
    const desktop =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches;
    if (desktop) {
      setCollapsed((c) => {
        const next = !c;
        try {
          localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
        } catch {
          /* ignore */
        }
        return next;
      });
    } else {
      setMobileOpen((o) => !o);
    }
  }, []);

  // While rehydrating the session or redirecting, show a neutral loader so we
  // never flash protected content to unauthenticated users.
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner size={28} />
      </div>
    );
  }

  const displayName = user.fullName || user.username;
  const subtitle = [
    user.role.charAt(0).toUpperCase() + user.role.slice(1),
    user.extension ? `Ext ${user.extension}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const shortcuts = SHORTCUTS[role];

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <NavRail role={role} homeHref={homeHref} collapsed={collapsed} />
      </div>

      {/* Mobile off-canvas sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 shadow-pop">
            <NavRail
              role={role}
              homeHref={homeHref}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          role={role}
          homeHref={homeHref}
          settingsHref={shortcuts.settings}
          historyHref={shortcuts.history}
          name={displayName}
          subtitle={subtitle}
          onToggleSidebar={toggleSidebar}
          onLogout={logout}
        />

        <main className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-6 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
