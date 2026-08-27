"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PhoneCall, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";
import {
  ADMIN_NAV_GROUPS,
  AGENT_NAV_GROUPS,
  type NavGroup,
} from "./nav-config";

export interface NavRailProps {
  role: UserRole;
  /** Home href used to decide exact-match for the dashboard item. */
  homeHref: string;
  /** Collapses the rail to icons only (driven by the topbar hamburger). */
  collapsed?: boolean;
  /** Called when a nav item is picked — lets the mobile drawer close itself. */
  onNavigate?: () => void;
}

function isActive(pathname: string, href: string, homeHref: string): boolean {
  if (href === homeHref) return pathname === homeHref;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Left sidebar: white surface, brand block, uppercase section labels, and nav
 * items that take a blue-50 fill plus a blue left accent bar when active.
 * Groups with a section label are collapsible via a right-aligned chevron.
 */
export function NavRail({ role, homeHref, collapsed = false, onNavigate }: NavRailProps) {
  const pathname = usePathname() ?? "";
  const groups: NavGroup[] =
    role === "admin" ? ADMIN_NAV_GROUPS : AGENT_NAV_GROUPS;

  // Collapsed section labels, keyed by group label.
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  // Keep a group open whenever it contains the active route, so deep links
  // never land the user on a page whose nav section is folded away.
  useEffect(() => {
    const activeGroup = groups.find((g) =>
      g.items.some((i) => isActive(pathname, i.href, homeHref)),
    );
    if (activeGroup?.label) {
      setClosed((c) => (c[activeGroup.label!] ? { ...c, [activeGroup.label!]: false } : c));
    }
  }, [pathname, groups, homeHref]);

  const toggleGroup = (label: string) =>
    setClosed((c) => ({ ...c, [label]: !c[label] }));

  return (
    <nav
      className={cn(
        "scrollbar-thin flex h-full shrink-0 flex-col overflow-y-auto border-r border-line bg-rail transition-[width] duration-200",
        collapsed ? "w-[76px] items-center" : "w-[260px]",
      )}
    >
      {/* Brand block — ~64px tall with a bottom separator. */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-line",
          collapsed ? "justify-center px-0" : "px-4",
        )}
      >
        <Link
          href={homeHref}
          className="flex items-center gap-3"
          aria-label="Home"
          onClick={onNavigate}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-ink">
            <PhoneCall size={18} strokeWidth={2.2} />
          </span>
          {!collapsed && (
            <span className="flex flex-col leading-none">
              <span className="text-[15px] font-bold tracking-tight text-rail-ink">
                PBX Suite
              </span>
              <span className="mt-1 text-[11px] font-medium text-ink-subtle">
                Control Center
              </span>
            </span>
          )}
        </Link>
      </div>

      {/* Grouped nav */}
      <div
        className={cn(
          "flex flex-1 flex-col pb-6",
          collapsed ? "items-center px-2 pt-2" : "px-2",
        )}
      >
        {groups.map((group, gi) => {
          const isClosed = group.label ? closed[group.label] : false;
          return (
            <div key={gi} className={cn(collapsed && gi > 0 && "mt-2")}>
              {group.label &&
                (collapsed ? (
                  gi > 0 && <div className="mx-auto mb-2 h-px w-6 bg-line" />
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label!)}
                    aria-expanded={!isClosed}
                    className="flex w-full items-center justify-between px-4 pb-2 pt-4 text-xs font-medium uppercase tracking-wide text-ink-subtle transition-colors hover:text-ink-muted"
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      size={14}
                      className={cn(
                        "transition-transform duration-150",
                        isClosed && "-rotate-90",
                      )}
                    />
                  </button>
                ))}

              {!isClosed && (
                <div className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href, homeHref);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-label={item.label}
                        aria-current={active ? "page" : undefined}
                        onClick={onNavigate}
                        className={cn(
                          "group relative flex items-center rounded-lg text-sm transition-colors duration-150",
                          collapsed
                            ? "h-10 w-10 justify-center"
                            : "gap-3 border-l-2 px-4 py-2.5",
                          active
                            ? collapsed
                              ? "bg-accent-soft text-accent-ink"
                              : "border-accent-ink bg-accent-soft font-medium text-accent-ink"
                            : cn(
                                "text-rail-ink-muted hover:bg-rail-hover",
                                !collapsed && "border-transparent",
                              ),
                        )}
                      >
                        <Icon size={20} strokeWidth={1.8} className="shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {collapsed && (
                          <span className="pointer-events-none absolute left-full z-20 ml-3 hidden whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-ink-inverse shadow-pop group-hover:block">
                            {item.label}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
