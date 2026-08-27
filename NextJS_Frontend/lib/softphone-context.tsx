"use client";

/**
 * App-wide softphone provider.
 *
 * Hosts a single `useSoftphone()` instance for the whole agent panel so the SIP
 * registration survives client-side navigation (one persistent registration
 * instead of one-per-page), the remote-audio <audio> element is always mounted,
 * and incoming calls can pop up on ANY page via <IncomingCallOverlay>.
 *
 * Registration is gated on auth: we register once the agent is logged in and
 * unregister on logout.
 */
import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { useSoftphone, type SoftphoneApi } from "./softphone";
import { useAuth } from "./auth-context";

/** A dialable directory entry (colleague extension). */
export interface DirectoryEntry {
  extension: string;
  name: string;
  department: string | null;
}

/** One row of the agent's personal call history. */
export interface CallLogEntry {
  id: number;
  direction: "inbound" | "outbound";
  party: string;
  name: string;
  at: string | null;
  durationSec: number;
  disposition: string;
  missed: boolean;
}

const SoftphoneContext = createContext<SoftphoneApi | null>(null);

export function SoftphoneProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const phone = useSoftphone(false); // registration controlled here, not on mount
  const { register, unregister } = phone;

  useEffect(() => {
    if (user) void register();
    else void unregister();
  }, [user, register, unregister]);

  return (
    <SoftphoneContext.Provider value={phone}>
      {children}
      {/* Global remote-audio sink — always mounted so audio works app-wide.
          <IncomingCallOverlay> is rendered by the agent layout as a child. */}
      <audio ref={phone.audioRef} autoPlay className="hidden" />
    </SoftphoneContext.Provider>
  );
}

/** Access the shared softphone. Must be used within <SoftphoneProvider>. */
export function useSoftphoneApi(): SoftphoneApi {
  const ctx = useContext(SoftphoneContext);
  if (!ctx) {
    throw new Error("useSoftphoneApi must be used within a <SoftphoneProvider>");
  }
  return ctx;
}
