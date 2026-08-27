"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Phone,
  PhoneOff,
  PhoneForwarded,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Pause,
  Play,
  Mic,
  MicOff,
  ArrowRightLeft,
  Delete,
  Users,
  Star,
  Search,
  Clock,
  Grid3x3,
  RefreshCw,
} from "lucide-react";
import { useSoftphoneApi } from "@/lib/softphone-context";
import { useDirectory, useCallLogs } from "@/lib/use-softphone-data";
import {
  Card,
  Button,
  Input,
  Modal,
  Tabs,
  StatusPill,
  Spinner,
  EmptyState,
  type StatusPillVariant,
  type TabItem,
} from "@/components/ui";

const DIALPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
type PhoneTab = "dialpad" | "contacts" | "recent";

function useCallTimer(active: boolean): string {
  const [secs, setSecs] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (active) {
      setSecs(0);
      ref.current = setInterval(() => setSecs((s) => s + 1), 1000);
    } else if (ref.current) {
      clearInterval(ref.current);
    }
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [active]);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function fmtDuration(sec: number): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** In-browser WebRTC softphone dock (SIP.js SessionManager). */
export function Softphone() {
  const phone = useSoftphoneApi();
  const [tab, setTab] = useState<PhoneTab>("dialpad");
  const [dial, setDial] = useState("");
  const [xferOpen, setXferOpen] = useState(false);
  const [xferTarget, setXferTarget] = useState("");
  const [xferMode, setXferMode] = useState<"blind" | "attended">("attended");

  const inCall = phone.callState === "active" || phone.callState === "held";
  const timer = useCallTimer(inCall);
  const transferring = phone.transferState !== "idle";

  const place = (target: string) => {
    if (!phone.registered || !target) return;
    void phone.call(target);
    setDial("");
  };

  // Registration status pill.
  let regVariant: StatusPillVariant = "offline";
  let regLabel = phone.registrationState;
  if (phone.registered) {
    regVariant = "idle";
    regLabel = "Registered";
  } else if (phone.connected) {
    regVariant = "warn";
    regLabel = "Connecting…";
  }

  const runTransfer = () => {
    if (!xferTarget) return;
    if (xferMode === "blind") void phone.blindTransfer(xferTarget);
    else void phone.startAttendedTransfer(xferTarget);
    setXferTarget("");
    setXferOpen(false);
  };

  const tabs: TabItem<PhoneTab>[] = [
    { value: "dialpad", label: "Dialpad" },
    { value: "contacts", label: "Contacts" },
    { value: "recent", label: "Recent" },
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink">Softphone</h3>
        <StatusPill
          variant={regVariant}
          label={regLabel}
          dot
          pulse={!phone.registered && phone.connected}
        />
      </div>

      {phone.error && (
        <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
          {phone.error}
        </p>
      )}

      {/* Attended-transfer consult panel */}
      {transferring && (
        <div className="mb-4 rounded-card border border-info/40 bg-info/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-info" />
            <span className="font-medium text-ink">
              {phone.consultIdentity ?? "Consulting"}
            </span>
            <span className="text-ink-muted">
              {phone.transferState === "consulting" ? "· ringing…" : "· connected"}
            </span>
          </div>
          <p className="mb-3 text-xs text-ink-muted">
            The caller is on hold. Complete the transfer to connect them, or
            cancel to return to the caller.
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void phone.completeAttendedTransfer()}
              leftIcon={<PhoneForwarded className="h-4 w-4" />}
            >
              Complete transfer
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void phone.cancelAttendedTransfer()}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Active call panel */}
      {inCall && (
        <div className="mb-4 rounded-card border border-line bg-surface-muted/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-ink">
                {phone.remoteIdentity ?? "Connected"}
              </p>
              <p className="text-xs text-ink-muted">
                {phone.callState === "held" ? "On hold" : "In call"} · {timer}
              </p>
            </div>
            <div className="tabular-nums text-lg font-semibold text-accent">
              {timer}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" size="sm" onClick={() => void phone.hangup()} leftIcon={<PhoneOff className="h-4 w-4" />}>
              Hangup
            </Button>
            <Button variant="secondary" size="sm" disabled={transferring} onClick={() => void phone.toggleHold()} leftIcon={phone.callState === "held" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}>
              {phone.callState === "held" ? "Resume" : "Hold"}
            </Button>
            <Button variant="secondary" size="sm" onClick={phone.toggleMute} leftIcon={phone.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}>
              {phone.muted ? "Unmute" : "Mute"}
            </Button>
            <Button variant="secondary" size="sm" disabled={transferring} onClick={() => setXferOpen(true)} leftIcon={<ArrowRightLeft className="h-4 w-4" />}>
              Transfer
            </Button>
          </div>
          {/* In-call DTMF */}
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {DIALPAD.map((d) => (
              <button
                key={d}
                onClick={() => phone.sendDtmf(d)}
                className="rounded-lg border border-line py-2 text-sm font-medium text-ink transition hover:bg-surface-muted"
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {phone.callState === "ringing_out" && (
        <div className="mb-4 rounded-card border border-line bg-surface-muted/40 p-4 text-center">
          <p className="text-sm text-ink-muted">Calling {phone.remoteIdentity}…</p>
          <Button variant="danger" size="sm" className="mt-3" onClick={() => void phone.hangup()}>
            Cancel
          </Button>
        </div>
      )}

      {/* Idle: tabbed dialpad / contacts / recent */}
      {!inCall && phone.callState !== "ringing_out" && (
        <>
          <Tabs
            tabs={tabs}
            value={tab}
            onChange={setTab}
            variant="pill"
            size="sm"
            className="mb-4 w-full justify-center"
          />
          {tab === "dialpad" && (
            <DialpadTab
              dial={dial}
              setDial={setDial}
              onCall={() => place(dial)}
              canCall={phone.registered && !!dial}
            />
          )}
          {tab === "contacts" && (
            <ContactsTab onCall={place} disabled={!phone.registered} />
          )}
          {tab === "recent" && (
            <RecentTab onCall={place} disabled={!phone.registered} />
          )}
        </>
      )}

      {/* Transfer modal — blind or attended */}
      <Modal
        open={xferOpen}
        onClose={() => setXferOpen(false)}
        size="sm"
        title="Transfer call"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setXferOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!xferTarget} onClick={runTransfer}>
              {xferMode === "blind" ? "Transfer now" : "Consult"}
            </Button>
          </div>
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setXferMode("attended")}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
              xferMode === "attended"
                ? "border-accent bg-accent/5 text-ink"
                : "border-line text-ink-muted hover:bg-surface-muted"
            }`}
          >
            <span className="block font-medium">Attended</span>
            <span className="text-xs">Talk first, then connect</span>
          </button>
          <button
            type="button"
            onClick={() => setXferMode("blind")}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
              xferMode === "blind"
                ? "border-accent bg-accent/5 text-ink"
                : "border-line text-ink-muted hover:bg-surface-muted"
            }`}
          >
            <span className="block font-medium">Blind</span>
            <span className="text-xs">Transfer immediately</span>
          </button>
        </div>
        <Input
          label="Transfer to extension/number"
          value={xferTarget}
          onChange={(e) => setXferTarget(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runTransfer()}
          placeholder="e.g. 1002"
          autoFocus
        />
      </Modal>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                               */
/* ------------------------------------------------------------------ */

function DialpadTab({
  dial,
  setDial,
  onCall,
  canCall,
}: {
  dial: string;
  setDial: (v: string | ((p: string) => string)) => void;
  onCall: () => void;
  canCall: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex gap-2">
        <Input
          value={dial}
          onChange={(e) => setDial(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && canCall && onCall()}
          placeholder="Enter number…"
          className="text-center text-lg tracking-wide"
        />
        <Button variant="ghost" size="icon" aria-label="Backspace" onClick={() => setDial((d) => d.slice(0, -1))}>
          <Delete className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {DIALPAD.map((d) => (
          <button
            key={d}
            onClick={() => setDial((v) => v + d)}
            className="rounded-lg border border-line py-3 text-lg font-medium text-ink transition hover:bg-surface-muted"
          >
            {d}
          </button>
        ))}
      </div>
      <Button
        variant="primary"
        className="mt-3 w-full"
        disabled={!canCall}
        onClick={onCall}
        leftIcon={<Phone className="h-4 w-4" />}
      >
        Call
      </Button>
    </div>
  );
}

function ContactsTab({
  onCall,
  disabled,
}: {
  onCall: (ext: string) => void;
  disabled: boolean;
}) {
  const { entries, favorites, toggleFavorite, loading, error } = useDirectory();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (e: (typeof entries)[number]) =>
      !needle ||
      e.name.toLowerCase().includes(needle) ||
      e.extension.includes(needle) ||
      (e.department ?? "").toLowerCase().includes(needle);
    const rows = entries.filter(match);
    // Favorites first, then alphabetical by name (already sorted by ext).
    return [...rows].sort((a, b) => {
      const fa = favorites.includes(a.extension) ? 0 : 1;
      const fb = favorites.includes(b.extension) ? 0 : 1;
      return fa - fb;
    });
  }, [entries, favorites, q]);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, ext, department…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : error ? (
        <p className="py-6 text-center text-xs text-danger">{error}</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="No contacts" description="No matching extensions." />
      ) : (
        <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
          {filtered.map((c) => {
            const fav = favorites.includes(c.extension);
            return (
              <div
                key={c.extension}
                className="group flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition hover:border-line hover:bg-surface-muted/60"
              >
                <button
                  onClick={() => toggleFavorite(c.extension)}
                  aria-label={fav ? "Unfavorite" : "Favorite"}
                  className={fav ? "text-warn" : "text-ink-subtle hover:text-warn"}
                >
                  <Star className="h-4 w-4" fill={fav ? "currentColor" : "none"} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{c.name}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {c.extension}
                    {c.department ? ` · ${c.department}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Call ${c.name}`}
                  disabled={disabled}
                  onClick={() => onCall(c.extension)}
                  className="opacity-0 transition group-hover:opacity-100"
                >
                  <Phone className="h-4 w-4 text-success" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecentTab({
  onCall,
  disabled,
}: {
  onCall: (ext: string) => void;
  disabled: boolean;
}) {
  const phone = useSoftphoneApi();
  // Refetch when the phone returns to idle (a call just finished).
  const { logs, loading, error, reload } = useCallLogs(phone.callState === "idle");

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">Recent calls</span>
        <button
          onClick={reload}
          aria-label="Refresh"
          className="text-ink-subtle transition hover:text-ink"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : error ? (
        <p className="py-6 text-center text-xs text-danger">{error}</p>
      ) : logs.length === 0 ? (
        <EmptyState icon={<Clock className="h-5 w-5" />} title="No recent calls" description="Your call history appears here." />
      ) : (
        <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
          {logs.map((c) => {
            const Icon = c.missed
              ? PhoneMissed
              : c.direction === "outbound"
                ? PhoneOutgoing
                : PhoneIncoming;
            const tone = c.missed
              ? "text-danger"
              : c.direction === "outbound"
                ? "text-info"
                : "text-success";
            return (
              <div
                key={c.id}
                className="group flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition hover:border-line hover:bg-surface-muted/60"
              >
                <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {c.name || c.party}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {c.party} · {fmtWhen(c.at)}
                    {!c.missed && c.durationSec ? ` · ${fmtDuration(c.durationSec)}` : ""}
                    {c.missed ? " · missed" : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Call ${c.party}`}
                  disabled={disabled}
                  onClick={() => onCall(c.party)}
                  className="opacity-0 transition group-hover:opacity-100"
                >
                  <Phone className="h-4 w-4 text-success" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
