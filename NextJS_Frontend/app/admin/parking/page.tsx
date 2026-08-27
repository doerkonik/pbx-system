"use client";
/** Admin › Parking — live board of currently parked calls. */
import { useCallback, useEffect, useState } from "react";
import { Car } from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import { useTelephonyEvents } from "@/lib/ws";
import { PageHeader, Card, StatusListRow, EmptyState, Spinner } from "@/components/ui";

interface Parked { slot: string; channel: string; callerNum?: string; callerName?: string; parkerDialString?: string; parkedAt?: string; }

export default function ParkingPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const [parked, setParked] = useState<Parked[]>([]);
  const [loading, setLoading] = useState(true);
  const [, force] = useState(0);

  const load = useCallback(async () => {
    try { const res = await api.get<Parked[]>("/call-control/parked"); setParked(Array.isArray(res) ? res : []); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (user) void load(); }, [user, load]);
  useTelephonyEvents({ onEvent: (ev) => { if (typeof ev.event === "string" && ev.event.startsWith("park.")) void load(); } });
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 1000); return () => clearInterval(t); }, []);

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Call parking" description="Calls currently parked in shared slots. Retrieve from any phone by dialing the slot." />
      <Card className="p-5">
        {loading ? <div className="flex justify-center py-10"><Spinner /></div> : parked.length === 0 ? (
          <EmptyState icon={<Car className="h-6 w-6" />} title="No parked calls" description="Parked calls appear here in real time." />
        ) : (
          <div className="divide-y divide-line">
            {parked.map((p) => {
              const wait = p.parkedAt ? Math.floor((Date.now() - new Date(p.parkedAt).getTime()) / 1000) : 0;
              return <StatusListRow key={p.slot} leading={<span className="rounded-lg bg-accent/10 px-2.5 py-1 text-sm font-semibold text-accent">{p.slot}</span>}
                name={p.callerName || p.callerNum || p.channel} subtitle={`Parked by ${p.parkerDialString ?? "—"}`} status="on_hold" metric={`${wait}s`} />;
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
