"use client";

/**
 * App-wide incoming-call popup. Rendered once at the agent layout level (inside
 * <SoftphoneProvider>) so a ringing call surfaces on every page, not just the
 * dashboard. Offers Answer, Decline, and Forward (blind-transfer the ringing
 * call to another extension without answering it).
 */
import { useEffect, useState } from "react";
import { Phone, PhoneOff, PhoneForwarded, X } from "lucide-react";
import { useSoftphoneApi } from "@/lib/softphone-context";
import { Button, Input } from "@/components/ui";

export function IncomingCallOverlay() {
  const phone = useSoftphoneApi();
  const [forwarding, setForwarding] = useState(false);
  const [target, setTarget] = useState("");

  const ringing = phone.callState === "ringing_in" && !!phone.incoming;

  // Reset the forward sub-panel whenever the ring ends.
  useEffect(() => {
    if (!ringing) {
      setForwarding(false);
      setTarget("");
    }
  }, [ringing]);

  if (!ringing || !phone.incoming) return null;

  const submitForward = () => {
    if (!target) return;
    void phone.blindTransfer(target);
    setForwarding(false);
    setTarget("");
  };

  return (
    <div className="fixed inset-x-0 top-4 z-[100] flex justify-center px-4 sm:left-auto sm:right-6 sm:justify-end">
      <div className="w-full max-w-sm animate-slide-up overflow-hidden rounded-card border border-accent/40 bg-surface shadow-2xl ring-1 ring-accent/20">
        <div className="flex items-center gap-3 border-b border-line bg-accent/5 px-4 py-3">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-accent/15">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/30" />
            <Phone className="relative h-4 w-4 text-accent" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">
              {phone.incoming.name || phone.incoming.number}
            </p>
            <p className="truncate text-xs text-ink-muted">
              {phone.incoming.number} · incoming call…
            </p>
          </div>
        </div>

        <div className="p-4">
          {!forwarding ? (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => void phone.answer()}
                leftIcon={<Phone className="h-4 w-4" />}
              >
                Answer
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => void phone.decline()}
                leftIcon={<PhoneOff className="h-4 w-4" />}
              >
                Decline
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Forward call"
                title="Forward without answering"
                onClick={() => setForwarding(true)}
              >
                <PhoneForwarded className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">
                  Forward to extension
                </span>
                <button
                  onClick={() => setForwarding(false)}
                  className="text-ink-muted hover:text-ink"
                  aria-label="Cancel forward"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex gap-2">
                <Input
                  value={target}
                  autoFocus
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitForward()}
                  placeholder="e.g. 1002"
                />
                <Button variant="primary" disabled={!target} onClick={submitForward}>
                  Send
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
