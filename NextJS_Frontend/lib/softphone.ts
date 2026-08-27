"use client";

/**
 * Browser WebRTC softphone hook, built on SIP.js's officially-maintained
 * high-level `Web.SessionManager` API.
 *
 * The agent's browser registers as a SIP endpoint directly to Asterisk over WSS
 * (NEXT_PUBLIC_SIP_WSS_URL on VM1) using credentials fetched from the backend
 * (GET /softphone/credentials — scoped to the agent's own extension). All media
 * (RTP) flows browser <-> VM1 directly; the backend is never in the audio path.
 *
 * Why SessionManager instead of a hand-rolled UserAgent: it manages the things a
 * production softphone must get right and that are easy to get wrong by hand —
 *   - WebSocket transport auto-reconnect (reconnectionAttempts/Delay),
 *   - automatic re-REGISTER on failure/expiry (registrationRetry),
 *   - RFC-correct hold/unhold re-INVITE (no SDP string hacking),
 *   - sender-track mute, INFO/RFC2833 DTMF,
 *   - blind AND attended (REFER-with-Replaces) transfer,
 *   - automatic attach/detach of the remote MediaStream to an <audio> element,
 *   - clean multi-session handling (needed for attended transfer consult legs).
 *
 * We keep a thin React state projection on top of its delegate callbacks.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Inviter, SessionState, Web, type Session } from "sip.js";
import { api } from "./api";

export type CallState =
  | "idle"
  | "ringing_in"
  | "ringing_out"
  | "active"
  | "held";

/** Attended-transfer sub-state, orthogonal to the primary call state. */
export type TransferState = "idle" | "consulting" | "consult_active";

export interface SoftphoneState {
  /** SessionManager constructed and start requested. */
  ready: boolean;
  /** WebSocket transport currently connected to Asterisk. */
  connected: boolean;
  /** SIP REGISTER currently active. */
  registered: boolean;
  registrationState: string;
  callState: CallState;
  incoming: { number: string; name: string } | null;
  remoteIdentity: string | null;
  muted: boolean;
  /** Attended transfer progress + the party being consulted. */
  transferState: TransferState;
  consultIdentity: string | null;
  error: string | null;
}

export interface SoftphoneApi extends SoftphoneState {
  audioRef: React.RefObject<HTMLAudioElement>;
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  call: (target: string) => Promise<void>;
  answer: () => Promise<void>;
  decline: () => Promise<void>;
  hangup: () => Promise<void>;
  toggleHold: () => Promise<void>;
  toggleMute: () => void;
  sendDtmf: (digit: string) => void;
  /** Immediate REFER — hangs up locally, target rings the destination. */
  blindTransfer: (target: string) => Promise<void>;
  /** Hold the caller, ring a third party to consult before completing. */
  startAttendedTransfer: (target: string) => Promise<void>;
  /** Complete the attended transfer (REFER with Replaces), joining the two. */
  completeAttendedTransfer: () => Promise<void>;
  /** Abort the consult and return to the held caller. */
  cancelAttendedTransfer: () => Promise<void>;
}

interface Credentials {
  extension: string;
  username: string;
  password: string;
}

const SIP_WSS_URL = process.env.NEXT_PUBLIC_SIP_WSS_URL ?? "";
const SIP_DOMAIN = process.env.NEXT_PUBLIC_SIP_DOMAIN ?? "";
/** Optional comma-separated STUN/TURN URLs, e.g. "stun:stun.l.google.com:19302". */
const SIP_STUN = process.env.NEXT_PUBLIC_SIP_STUN ?? "";

function iceServers(): RTCIceServer[] {
  return SIP_STUN.split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .map((urls) => ({ urls }));
}

function sipUri(target: string): string {
  const clean = target.replace(/[^0-9*#+A-Za-z._-]/g, "");
  return `sip:${clean}@${SIP_DOMAIN}`;
}

function identityOf(session: Session): { number: string; name: string } {
  const id: any = (session as any).remoteIdentity;
  const number = id?.uri?.user ?? "";
  const name = id?.displayName || number;
  return { number, name };
}

/**
 * A synthesized US-cadence ring tone (440+480 Hz, 2s on / 4s off) via WebAudio,
 * so we don't have to ship or fetch an audio asset. Best-effort; guarded.
 */
function createRingtone() {
  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const burst = () => {
    if (!ctx) return;
    const gain = ctx.createGain();
    gain.gain.value = 0.12;
    gain.connect(ctx.destination);
    [440, 480].forEach((freq) => {
      const osc = ctx!.createOscillator();
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start();
      osc.stop(ctx!.currentTime + 2);
    });
  };

  return {
    start() {
      if (ctx) return;
      try {
        const Ctor =
          window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        ctx = new Ctor();
        void ctx.resume().catch(() => undefined);
        burst();
        timer = setInterval(burst, 6000);
      } catch {
        /* ringtone is a nicety, never fatal */
      }
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      if (ctx) void ctx.close().catch(() => undefined);
      ctx = null;
    },
  };
}

export function useSoftphone(autoRegister = true): SoftphoneApi {
  const audioRef = useRef<HTMLAudioElement>(null);
  const smRef = useRef<Web.SessionManager | null>(null);
  /** The primary (customer) call. */
  const sessionRef = useRef<Session | null>(null);
  /** The consult leg during an attended transfer. */
  const consultRef = useRef<Session | null>(null);
  /** When true, the next created outgoing session is a consult leg. */
  const consultPendingRef = useRef(false);
  /** True while an accept is negotiating media, to swallow repeat clicks. */
  const answeringRef = useRef(false);
  const ringtoneRef = useRef<ReturnType<typeof createRingtone> | null>(null);
  const startingRef = useRef(false);

  const [state, setState] = useState<SoftphoneState>({
    ready: false,
    connected: false,
    registered: false,
    registrationState: "unregistered",
    callState: "idle",
    incoming: null,
    remoteIdentity: null,
    muted: false,
    transferState: "idle",
    consultIdentity: null,
    error: null,
  });

  const patch = useCallback((p: Partial<SoftphoneState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const stopRing = useCallback(() => {
    ringtoneRef.current?.stop();
  }, []);

  const register = useCallback(async () => {
    if (smRef.current || startingRef.current) return;
    if (!SIP_WSS_URL || !SIP_DOMAIN) {
      patch({ error: "SIP WSS URL / domain not configured" });
      return;
    }
    startingRef.current = true;
    if (!ringtoneRef.current) ringtoneRef.current = createRingtone();

    try {
      const creds = await api.get<Credentials>("/softphone/credentials");
      const servers = iceServers();

      const sm = new Web.SessionManager(SIP_WSS_URL, {
        aor: `sip:${creds.extension}@${SIP_DOMAIN}`,
        media: {
          constraints: { audio: true, video: false },
          // Resolved lazily at call setup — the <audio> ref is populated by then.
          remote: () => ({ audio: audioRef.current ?? undefined }),
        },
        // Resilience: keep the transport alive and the registration fresh.
        reconnectionAttempts: 30,
        reconnectionDelay: 4,
        registrationRetry: true,
        registrationRetryInterval: 5,
        userAgentOptions: {
          authorizationUsername: creds.username,
          authorizationPassword: creds.password,
          logLevel: "error",
          sessionDescriptionHandlerFactoryOptions: {
            iceGatheringTimeout: 2000,
            peerConnectionConfiguration: servers.length
              ? { iceServers: servers }
              : undefined,
          },
        },
        delegate: {
          onServerConnect: () => patch({ connected: true, error: null }),
          onServerDisconnect: (err) =>
            patch({
              connected: false,
              registered: false,
              registrationState: "disconnected",
              error: err ? "Connection to phone server lost" : null,
            }),
          onRegistered: () =>
            patch({
              registered: true,
              registrationState: "registered",
              error: null,
            }),
          onUnregistered: () =>
            patch({ registered: false, registrationState: "unregistered" }),

          onCallCreated: (session) => {
            // Consult leg of an attended transfer: track separately, don't
            // disturb the primary call's UI state.
            if (consultPendingRef.current && session instanceof Inviter) {
              consultPendingRef.current = false;
              consultRef.current = session;
              patch({
                transferState: "consulting",
                consultIdentity: identityOf(session).name,
              });
              return;
            }
            sessionRef.current = session;
            // Inviter => we placed the call (outgoing). Invitation is handled
            // by onCallReceived below.
            if (session instanceof Inviter) {
              const { name } = identityOf(session);
              patch({ callState: "ringing_out", remoteIdentity: name });
            }
          },

          onCallReceived: (session) => {
            // Reject a second inbound call while already on one.
            if (sessionRef.current && sessionRef.current !== session) {
              void smRef.current?.decline(session).catch(() => undefined);
              return;
            }
            sessionRef.current = session;
            const info = identityOf(session);
            patch({
              callState: "ringing_in",
              incoming: info,
              remoteIdentity: info.name,
            });
            ringtoneRef.current?.start();
          },

          onCallAnswered: (session) => {
            stopRing();
            if (session === consultRef.current) {
              patch({ transferState: "consult_active" });
              return;
            }
            patch({ callState: "active", incoming: null, muted: false });
          },

          onCallHold: (session, held) => {
            if (session === sessionRef.current) {
              patch({ callState: held ? "held" : "active" });
            }
          },

          onCallHangup: (session) => {
            stopRing();
            if (session === consultRef.current) {
              // Consult leg ended: fall back to the (held) primary call.
              consultRef.current = null;
              patch({ transferState: "idle", consultIdentity: null });
              return;
            }
            if (session === sessionRef.current) {
              sessionRef.current = null;
              patch({
                callState: "idle",
                incoming: null,
                remoteIdentity: null,
                muted: false,
                transferState: "idle",
                consultIdentity: null,
              });
            }
          },
        },
      });

      smRef.current = sm;
      patch({ ready: true, error: null });
      await sm.connect();
      await sm.register();
    } catch (e) {
      patch({
        error: e instanceof Error ? e.message : "Registration failed",
        ready: false,
      });
      smRef.current = null;
    } finally {
      startingRef.current = false;
    }
  }, [patch, stopRing]);

  const unregister = useCallback(async () => {
    const sm = smRef.current;
    stopRing();
    try {
      await sm?.unregister().catch(() => undefined);
      await sm?.disconnect().catch(() => undefined);
    } finally {
      smRef.current = null;
      sessionRef.current = null;
      consultRef.current = null;
      consultPendingRef.current = false;
      patch({
        ready: false,
        connected: false,
        registered: false,
        registrationState: "unregistered",
        callState: "idle",
        incoming: null,
        remoteIdentity: null,
        transferState: "idle",
        consultIdentity: null,
      });
    }
  }, [patch, stopRing]);

  const call = useCallback(
    async (target: string) => {
      const sm = smRef.current;
      if (!sm || sessionRef.current) return;
      try {
        await sm.call(sipUri(target), {
          sessionDescriptionHandlerOptions: {
            constraints: { audio: true, video: false },
          },
        });
      } catch (e) {
        patch({ error: e instanceof Error ? e.message : "Call failed" });
      }
    },
    [patch],
  );

  const answer = useCallback(async () => {
    const sm = smRef.current;
    const session = sessionRef.current;
    if (!sm || !session) return;
    // SIP.js accepts an Invitation only from the Initial state; a second
    // attempt throws "Invalid session state Establishing". Accepting media can
    // take a moment (mic permission, ICE), so guard against the repeat click
    // rather than surfacing that error to the agent.
    if (answeringRef.current || session.state !== SessionState.Initial) return;
    answeringRef.current = true;
    try {
      stopRing();
      // Drop the ringing overlay up front: leaving it up for the whole
      // negotiation is what invites the second click in the first place.
      patch({ incoming: null });
      await sm.answer(session);
    } catch (e) {
      patch({ error: e instanceof Error ? e.message : "Answer failed" });
    } finally {
      answeringRef.current = false;
    }
  }, [patch, stopRing]);

  const decline = useCallback(async () => {
    const sm = smRef.current;
    const session = sessionRef.current;
    if (!sm || !session) return;
    // Same race as answer(): once an accept is under way the invitation can no
    // longer be rejected.
    if (answeringRef.current || session.state !== SessionState.Initial) return;
    stopRing();
    try {
      await sm.decline(session);
    } catch {
      /* ignore */
    } finally {
      patch({ incoming: null });
    }
  }, [patch, stopRing]);

  const hangup = useCallback(async () => {
    const sm = smRef.current;
    const session = sessionRef.current;
    if (!sm || !session) return;
    stopRing();
    try {
      await sm.hangup(session);
    } catch {
      /* ignore */
    }
  }, [stopRing]);

  const toggleHold = useCallback(async () => {
    const sm = smRef.current;
    const session = sessionRef.current;
    if (!sm || !session || session.state !== SessionState.Established) return;
    try {
      if (sm.isHeld(session)) await sm.unhold(session);
      else await sm.hold(session);
    } catch (e) {
      patch({ error: e instanceof Error ? e.message : "Hold failed" });
    }
  }, [patch]);

  const toggleMute = useCallback(() => {
    const sm = smRef.current;
    const session = sessionRef.current;
    if (!sm || !session) return;
    if (sm.isMuted(session)) {
      sm.unmute(session);
      patch({ muted: false });
    } else {
      sm.mute(session);
      patch({ muted: true });
    }
  }, [patch]);

  const sendDtmf = useCallback((digit: string) => {
    const sm = smRef.current;
    const session = sessionRef.current;
    if (!sm || !session) return;
    void sm.sendDTMF(session, digit).catch(() => undefined);
  }, []);

  const blindTransfer = useCallback(
    async (target: string) => {
      const sm = smRef.current;
      const session = sessionRef.current;
      if (!sm || !session || session.state !== SessionState.Established) return;
      try {
        await sm.transfer(session, sipUri(target));
      } catch (e) {
        patch({ error: e instanceof Error ? e.message : "Transfer failed" });
      }
    },
    [patch],
  );

  const startAttendedTransfer = useCallback(
    async (target: string) => {
      const sm = smRef.current;
      const session = sessionRef.current;
      if (!sm || !session || session.state !== SessionState.Established) return;
      if (consultRef.current) return;
      try {
        // Hold the customer, then dial the consult party.
        if (!sm.isHeld(session)) await sm.hold(session);
        consultPendingRef.current = true;
        await sm.call(sipUri(target), {
          sessionDescriptionHandlerOptions: {
            constraints: { audio: true, video: false },
          },
        });
      } catch (e) {
        consultPendingRef.current = false;
        patch({
          error: e instanceof Error ? e.message : "Consult call failed",
          transferState: "idle",
        });
      }
    },
    [patch],
  );

  const completeAttendedTransfer = useCallback(async () => {
    const sm = smRef.current;
    const primary = sessionRef.current;
    const consult = consultRef.current;
    if (!sm || !primary || !consult) return;
    try {
      // REFER with Replaces: bridges the customer to the consult party.
      await sm.transfer(primary, consult);
    } catch (e) {
      patch({ error: e instanceof Error ? e.message : "Transfer failed" });
    }
  }, [patch]);

  const cancelAttendedTransfer = useCallback(async () => {
    const sm = smRef.current;
    const primary = sessionRef.current;
    const consult = consultRef.current;
    if (!sm) return;
    try {
      if (consult) await sm.hangup(consult).catch(() => undefined);
      if (primary && sm.isHeld(primary)) await sm.unhold(primary);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (autoRegister) void register();
    return () => {
      void unregister();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    audioRef,
    register,
    unregister,
    call,
    answer,
    decline,
    hangup,
    toggleHold,
    toggleMute,
    sendDtmf,
    blindTransfer,
    startAttendedTransfer,
    completeAttendedTransfer,
    cancelAttendedTransfer,
  };
}
