"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";

export interface TopProfileChipProps {
  name: string;
  subtitle?: string;
  src?: string | null;
  /** When provided, a dropdown with a Sign-out action is shown. */
  onLogout?: () => void;
}

/** Page-level top-right profile chip (rounded pill: avatar + name + menu). */
export function TopProfileChip({ name, subtitle, src, onLogout }: TopProfileChipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => onLogout && setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-pill border border-line bg-surface py-1.5 pl-1.5 pr-3 shadow-xs transition-colors hover:bg-surface-muted"
      >
        <Avatar name={name} src={src ?? undefined} size="sm" />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold text-ink">{name}</span>
          {subtitle && <span className="block text-xs text-ink-muted">{subtitle}</span>}
        </span>
        {onLogout && (
          <ChevronDown size={15} className={cn("text-ink-subtle transition-transform", open && "rotate-180")} />
        )}
      </button>

      {open && onLogout && (
        <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-card border border-line bg-surface shadow-pop animate-scale-in">
          <button
            type="button"
            onClick={() => { setOpen(false); onLogout(); }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
