"use client";

import { useTelephonyEvents } from "@/lib/ws";
import { cn } from "@/lib/utils";
import type { TelephonyConnectionState } from "@/lib/types";

const meta: Record<
  TelephonyConnectionState,
  { label: string; dot: string; text: string; pulse: boolean }
> = {
  connected: {
    label: "Live",
    dot: "bg-success",
    text: "text-success",
    pulse: true,
  },
  connecting: {
    label: "Connecting",
    dot: "bg-warn",
    text: "text-warn",
    pulse: true,
  },
  reconnecting: {
    label: "Reconnecting",
    dot: "bg-warn",
    text: "text-warn",
    pulse: true,
  },
  disconnected: {
    label: "Offline",
    dot: "bg-danger",
    text: "text-danger",
    pulse: false,
  },
};

/** Live telephony connection indicator driven by the realtime socket. */
export function ConnectionIndicator({ className }: { className?: string }) {
  const { connectionState } = useTelephonyEvents();
  const m = meta[connectionState];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-2.5 py-1",
        className,
      )}
      title={`Telephony: ${m.label}`}
    >
      <span className="relative flex h-2 w-2">
        {m.pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-60",
              m.dot,
              "animate-[pulse_1.6s_ease-in-out_infinite]",
            )}
          />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", m.dot)} />
      </span>
      <span className={cn("text-xs font-medium", m.text)}>{m.label}</span>
    </div>
  );
}
