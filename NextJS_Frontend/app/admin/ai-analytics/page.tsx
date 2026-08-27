"use client";
/**
 * Admin › AI Analytics — how many calls the AI agent handled, durations,
 * answered rate, a daily trend, and the recent AI calls with playable
 * recordings. Data comes from the CDR rows the AVR dialplan tags as AI_AGENT.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Phone,
  Clock,
  CheckCircle2,
  RefreshCw,
  Play,
  Headphones,
  Radio,
  FileText,
  X,
} from "lucide-react";
import { api, ApiError, API_BASE_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-storage";
import { useRequireAuth } from "@/lib/auth-context";
import { formatDuration } from "@/lib/utils";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Spinner,
  useToast,
} from "@/components/ui";

interface Totals {
  total: number;
  answered: number;
  today: number;
  totalBillsec: number;
  avgBillsec: number;
}
interface RecentCall {
  uniqueid: string;
  calldate: string | null;
  src: string;
  dst: string;
  duration: number;
  billsec: number;
  disposition: string;
  hasRecording: boolean;
  hasTranscript: boolean;
  csatScore: number | null;
  csatLabel: string | null;
}
interface Review {
  uniqueid: string;
  caller: string;
  transcript: string | null;
  csatScore: number | null;
  csatLabel: string | null;
  summary: string | null;
  createdAt: string;
}
interface Analytics {
  totals: Totals;
  series: { day: string; count: number }[];
  recent: RecentCall[];
  spanDays: number;
}
interface LiveCall {
  uniqueid: string;
  channel: string;
  caller: string;
  startedAt: number;
  durationSec: number;
}

const mmss = (s: number) => {
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, "0");
  return `${m}:${ss}`;
};

function csatBadge(
  score: number | null,
  label: string | null,
): { variant: "success" | "warn" | "danger"; text: string } | null {
  if (score == null) return null;
  const variant = score >= 4 ? "success" : score === 3 ? "warn" : "danger";
  return { variant, text: `${score}/5${label ? ` · ${label}` : ""}` };
}

function StatTile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-sm font-medium text-ink-muted">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-ink">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-subtle">{sub}</div>}
    </Card>
  );
}

export default function AiAnalyticsPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [live, setLive] = useState<LiveCall[]>([]);
  const [listening, setListening] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.get<Analytics>("/ai-agent/analytics", { params: { days: 14 } }));
    } catch (e) {
      toast({
        title: "Could not load analytics",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadLive = useCallback(async () => {
    try {
      setLive(await api.get<LiveCall[]>("/ai-agent/live"));
    } catch {
      /* transient */
    }
  }, []);

  useEffect(() => {
    if (user) {
      void load();
      void loadLive();
    }
  }, [user, load, loadLive]);
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => void loadLive(), 4000);
    return () => clearInterval(id);
  }, [user, loadLive]);

  async function listen(channel: string) {
    setListening(channel);
    try {
      await api.post("/ai-agent/listen", { channel, mode: "listen" });
      toast({
        title: "Connecting you in…",
        description: "Your softphone will ring — answer it to listen to the AI call.",
        variant: "success",
      });
    } catch (e) {
      toast({
        title: "Could not listen",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "error",
      });
    } finally {
      setListening(null);
    }
  }

  async function openReview(uniqueid: string) {
    setReviewFor(uniqueid);
    setReview(null);
    setReviewLoading(true);
    try {
      setReview(await api.get<Review>(`/ai-agent/review/${uniqueid}`));
    } catch (e) {
      toast({
        title: "Could not load transcript",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "error",
      });
    } finally {
      setReviewLoading(false);
    }
  }

  async function playRecording(uniqueid: string) {
    try {
      const res = await fetch(
        `${API_BASE_URL}/ai-agent/recording/${encodeURIComponent(uniqueid)}`,
        { headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      setAudioSrc(URL.createObjectURL(blob));
    } catch (e) {
      toast({
        title: "Cannot play recording",
        description: e instanceof Error ? e.message : "Error",
        variant: "error",
      });
    }
  }

  if (authLoading || !user || loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const t = data.totals;
  const answeredPct = t.total ? Math.round((t.answered / t.total) * 100) : 0;

  return (
    <div className="pb-10">
      <PageHeader
        title="AI Analytics"
        description="Calls handled by the AI agent, durations, answered rate and recordings."
        actions={
          <Button
            variant="secondary"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={() => void load()}
          >
            Refresh
          </Button>
        }
      />

      {/* Live AI calls */}
      <Card className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {live.length > 0 && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                live.length > 0 ? "bg-success" : "bg-ink-subtle"
              }`}
            />
          </span>
          <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
            <Radio className="h-4 w-4 text-accent" /> Live AI calls
          </h3>
          <Badge variant={live.length > 0 ? "success" : "warn"}>
            {live.length} now
          </Badge>
        </div>
        {live.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No AI calls in progress right now. When the AI is talking to a
            caller, it appears here and you can listen in.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {live.map((c) => (
              <div
                key={c.uniqueid}
                className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-surface-muted px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-success" />
                  <span className="font-medium text-ink">
                    {c.caller || "Unknown caller"}
                  </span>
                  <span className="text-xs tabular-nums text-ink-muted">
                    talking {mmss(c.durationSec)}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Headphones className="h-4 w-4" />}
                  loading={listening === c.channel}
                  onClick={() => listen(c.channel)}
                >
                  Listen
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="AI calls (total)"
          value={String(t.total)}
          sub={`${t.today} today`}
          icon={<Phone className="h-4 w-4 text-accent" />}
        />
        <StatTile
          label="Answered rate"
          value={`${answeredPct}%`}
          sub={`${t.answered} of ${t.total}`}
          icon={<CheckCircle2 className="h-4 w-4 text-accent" />}
        />
        <StatTile
          label="Avg call length"
          value={mmss(t.avgBillsec)}
          icon={<Clock className="h-4 w-4 text-accent" />}
        />
        <StatTile
          label="Total talk time"
          value={formatDuration(t.totalBillsec)}
          icon={<Clock className="h-4 w-4 text-accent" />}
        />
      </div>

      <Card className="mb-6">
        <h3 className="mb-4 text-base font-semibold text-ink">
          AI calls — last {data.spanDays} days
        </h3>
        {(() => {
          const max = Math.max(1, ...data.series.map((s) => s.count));
          return (
            <div className="flex h-56 items-end gap-1.5">
              {data.series.map((s) => (
                <div
                  key={s.day}
                  className="flex flex-1 flex-col items-center justify-end gap-1"
                  title={`${s.day}: ${s.count} call${s.count === 1 ? "" : "s"}`}
                >
                  <span className="text-[10px] tabular-nums text-ink-subtle">
                    {s.count > 0 ? s.count : ""}
                  </span>
                  <div
                    className="w-full rounded-t bg-accent/80 transition-all"
                    style={{
                      height: `${Math.max(s.count > 0 ? 4 : 0, (s.count / max) * 100)}%`,
                    }}
                  />
                  <span className="text-[10px] text-ink-subtle">
                    {s.day.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}
      </Card>

      {audioSrc && (
        <Card className="mb-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-ink">Now playing</span>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={audioSrc} controls autoPlay className="w-full" />
          </div>
        </Card>
      )}

      <Card flush>
        <div className="border-b border-line-soft px-6 py-4">
          <h3 className="text-base font-semibold text-ink">Recent AI calls</h3>
        </div>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-soft bg-surface-muted text-left text-xs uppercase tracking-wide text-ink-subtle">
                <th className="px-6 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">From</th>
                <th className="px-4 py-2.5 font-medium">To</th>
                <th className="px-4 py-2.5 font-medium">Length</th>
                <th className="px-4 py-2.5 font-medium">Result</th>
                <th className="px-4 py-2.5 font-medium">CSAT</th>
                <th className="px-6 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((r) => (
                <tr key={r.uniqueid} className="border-b border-line-soft last:border-0">
                  <td className="whitespace-nowrap px-6 py-3 text-ink-muted">
                    {r.calldate ? new Date(r.calldate).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink">{r.src || "—"}</td>
                  <td className="px-4 py-3 text-ink">{r.dst || "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-ink">{mmss(r.billsec)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={/answer/i.test(r.disposition) ? "success" : "warn"}>
                      {r.disposition || "—"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const b = csatBadge(r.csatScore, r.csatLabel);
                      return b ? (
                        <Badge variant={b.variant}>{b.text}</Badge>
                      ) : (
                        <span className="text-xs text-ink-subtle">—</span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1">
                      {r.hasRecording && (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Play className="h-4 w-4" />}
                          onClick={() => playRecording(r.uniqueid)}
                        >
                          Play
                        </Button>
                      )}
                      {r.hasTranscript && (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<FileText className="h-4 w-4" />}
                          onClick={() => openReview(r.uniqueid)}
                        >
                          Transcript
                        </Button>
                      )}
                      {!r.hasRecording && !r.hasTranscript && (
                        <span className="text-xs text-ink-subtle">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.recent.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-ink-muted">
                    No AI calls yet. When a caller reaches the AI agent, calls
                    appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Transcript + CSAT modal */}
      {reviewFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setReviewFor(null)}
        >
          <div
            className="max-h-[82vh] w-full max-w-2xl overflow-hidden rounded-card-lg bg-surface shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-semibold text-ink">
                  Call transcript
                </h3>
                {review &&
                  (() => {
                    const b = csatBadge(review.csatScore, review.csatLabel);
                    return b ? <Badge variant={b.variant}>{b.text}</Badge> : null;
                  })()}
              </div>
              <button
                onClick={() => setReviewFor(null)}
                className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="scrollbar-thin max-h-[70vh] overflow-y-auto p-5">
              {reviewLoading ? (
                <div className="flex justify-center py-10">
                  <Spinner />
                </div>
              ) : !review ? (
                <p className="text-sm text-ink-muted">No transcript available.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {review.summary && (
                    <div className="rounded-xl bg-surface-muted p-3 text-sm text-ink-muted">
                      <span className="font-medium text-ink">Summary: </span>
                      {review.summary}
                    </div>
                  )}
                  {review.transcript ? (
                    <div className="flex flex-col gap-2">
                      {review.transcript
                        .split("\n")
                        .filter(Boolean)
                        .map((line, i) => {
                          const isAi = line.startsWith("AI:");
                          const text = line.replace(/^(AI|Caller):\s*/, "");
                          return (
                            <div
                              key={i}
                              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm text-ink ${
                                isAi
                                  ? "self-end bg-accent-soft"
                                  : "self-start bg-surface-muted"
                              }`}
                            >
                              <div className="mb-0.5 text-[10px] font-medium uppercase text-ink-subtle">
                                {isAi ? "AI" : "Caller"}
                              </div>
                              {text}
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-muted">Transcript is empty.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
