"use client";
/**
 * Admin › AI Studio — configure the AVR/Gemini voice agent's identity,
 * behaviour and model in plain language, then publish it live (writes the AVR
 * .env and recreates the AI container). No code, no config files.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Building2,
  Languages,
  BookOpen,
  SlidersHorizontal,
  Save,
  Rocket,
  CheckCircle2,
  AlertTriangle,
  Power,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Input,
  Textarea,
  Select,
  Toggle,
  Spinner,
  useToast,
} from "@/components/ui";

interface ModelOption {
  value: string;
  label: string;
}
interface AiStatus {
  apiKeySet: boolean;
  containerRunning: boolean;
  avrDir: string;
}
interface AiConfigView {
  id: string;
  agentName: string;
  organizationName: string;
  businessDescription: string | null;
  language: string;
  allowEnglish: boolean;
  personality: string | null;
  businessFacts: string | null;
  fallbackBehavior: string | null;
  greeting: string | null;
  model: string;
  voice: string;
  published: boolean;
  lastPublishedAt: string | null;
  compiledPreview: string;
  status: AiStatus;
  models: ModelOption[];
  languages: ModelOption[];
  voices: ModelOption[];
}

/** Editable subset of the config (what the form binds to). */
interface FormState {
  agentName: string;
  organizationName: string;
  businessDescription: string;
  language: string;
  allowEnglish: boolean;
  personality: string;
  businessFacts: string;
  fallbackBehavior: string;
  greeting: string;
  model: string;
  voice: string;
}

function toForm(c: AiConfigView): FormState {
  return {
    agentName: c.agentName ?? "",
    organizationName: c.organizationName ?? "",
    businessDescription: c.businessDescription ?? "",
    language: c.language ?? "bn",
    allowEnglish: c.allowEnglish,
    personality: c.personality ?? "",
    businessFacts: c.businessFacts ?? "",
    fallbackBehavior: c.fallbackBehavior ?? "",
    greeting: c.greeting ?? "",
    model: c.model,
    voice: c.voice ?? "",
  };
}

export default function AiStudioPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();

  const [cfg, setCfg] = useState<AiConfigView | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [apiKey, setApiKey] = useState("");

  const load = useCallback(async () => {
    try {
      const view = await api.get<AiConfigView>("/ai-agent/config");
      setCfg(view);
      setForm(toForm(view));
    } catch (e) {
      toast({
        title: "Could not load AI configuration",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const view = await api.put<AiConfigView>("/ai-agent/config", form);
      setCfg(view);
      setForm(toForm(view));
      toast({
        title: "Draft saved",
        description: "Click Publish to push it live to the AI.",
        variant: "success",
      });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      // Persist the current form first, then push it live.
      if (form) await api.put<AiConfigView>("/ai-agent/config", form);
      const view = await api.post<AiConfigView>("/ai-agent/publish", {
        apiKey: apiKey.trim() || undefined,
      });
      setCfg(view);
      setForm(toForm(view));
      setConfirmPublish(false);
      setApiKey("");
      toast({
        title: "Published — the AI is live",
        description: "The next call will use the new settings.",
        variant: "success",
      });
    } catch (e) {
      toast({
        title: "Publish failed",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "error",
      });
    } finally {
      setPublishing(false);
    }
  }

  if (authLoading || !user || loading || !cfg || !form) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const isBangla = form.language === "bn";

  return (
    <div className="pb-10">
      <PageHeader
        title="AI Studio"
        description="Give your AI phone agent its identity, knowledge and behaviour — then publish it live."
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<Save className="h-4 w-4" />}
              loading={saving}
              onClick={save}
            >
              Save draft
            </Button>
            <Button
              variant="primary"
              leftIcon={<Rocket className="h-4 w-4" />}
              onClick={() => setConfirmPublish(true)}
            >
              Publish live
            </Button>
          </>
        }
      />

      {/* Status strip */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
            <Power className="h-4 w-4 text-ink-subtle" /> AI container
            <Badge variant={cfg.status.containerRunning ? "success" : "danger"}>
              {cfg.status.containerRunning ? "running" : "stopped"}
            </Badge>
          </span>
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
            Gemini key
            <Badge variant={cfg.status.apiKeySet ? "success" : "warn"}>
              {cfg.status.apiKeySet ? "set" : "missing"}
            </Badge>
          </span>
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
            State
            <Badge variant={cfg.published ? "success" : "warn"}>
              {cfg.published ? "published" : "unpublished draft"}
            </Badge>
          </span>
          {cfg.lastPublishedAt && (
            <span className="text-sm text-ink-muted">
              Last published{" "}
              {new Date(cfg.lastPublishedAt).toLocaleString()}
            </span>
          )}
        </div>
      </Card>

      {/* Publish confirm */}
      {confirmPublish && (
        <Card className="mb-6 border-accent/40 bg-accent-soft">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
            <div className="w-full">
              <h3 className="text-base font-semibold text-ink">
                Publish to the live AI?
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                This saves your changes, writes them to the AI, and restarts the
                AI container. Any call the AI is handling right now will drop for
                a few seconds. Agents and normal calls are unaffected.
              </p>
              <div className="mt-4 max-w-md">
                <Input
                  label="Update Gemini API key (optional)"
                  type="password"
                  placeholder="Leave blank to keep the current key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  hint="Only fill this in to rotate the key. It is written to the AI, never stored in the database."
                />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="primary"
                  leftIcon={<Rocket className="h-4 w-4" />}
                  loading={publishing}
                  onClick={publish}
                >
                  Confirm publish
                </Button>
                <Button
                  variant="ghost"
                  disabled={publishing}
                  onClick={() => {
                    setConfirmPublish(false);
                    setApiKey("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Identity */}
        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
            <Bot className="h-4 w-4 text-accent" /> Identity
          </h3>
          <div className="flex flex-col gap-4">
            <Input
              label="Agent name"
              placeholder="e.g. Konik"
              value={form.agentName}
              onChange={(e) => set("agentName", e.target.value)}
            />
            <Input
              label="Organization name"
              placeholder="e.g. Doer Technologies Ltd."
              value={form.organizationName}
              onChange={(e) => set("organizationName", e.target.value)}
              leftIcon={<Building2 className="h-4 w-4" />}
            />
            <Textarea
              label="What your organization does"
              placeholder="e.g. We sell home appliances and provide delivery and after-sales support in Dhaka."
              rows={3}
              value={form.businessDescription}
              onChange={(e) => set("businessDescription", e.target.value)}
            />
          </div>
        </Card>

        {/* Language & tone */}
        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
            <Languages className="h-4 w-4 text-accent" /> Language & tone
          </h3>
          <div className="flex flex-col gap-4">
            <Select
              label="Primary language"
              options={cfg.languages}
              value={form.language}
              onChange={(e) => set("language", e.target.value)}
            />
            <Toggle
              checked={form.allowEnglish}
              onCheckedChange={(v) => set("allowEnglish", v)}
              disabled={!isBangla}
              label={
                isBangla
                  ? "Switch to English if the caller speaks English"
                  : "Bilingual switching (Bangla only)"
              }
            />
            <Textarea
              label="Personality / tone"
              placeholder="e.g. Warm, polite, patient. Speak in one or two short sentences."
              rows={2}
              value={form.personality}
              onChange={(e) => set("personality", e.target.value)}
            />
            <Input
              label="Opening line (optional)"
              placeholder="e.g. আসসালামু আলাইকুম, কনিক বলছি।"
              value={form.greeting}
              onChange={(e) => set("greeting", e.target.value)}
            />
          </div>
        </Card>

        {/* Business knowledge */}
        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
            <BookOpen className="h-4 w-4 text-accent" /> Business knowledge
          </h3>
          <Textarea
            label="Facts & policies the AI may state"
            placeholder={
              "e.g. Hours: 9am–9pm daily. Delivery: 2–3 days inside Dhaka. Returns: within 7 days."
            }
            rows={7}
            value={form.businessFacts}
            onChange={(e) => set("businessFacts", e.target.value)}
            hint="Keep this to your key facts. Large FAQs and per-customer data (orders, accounts) come later via the Knowledge Base and data connectors."
          />
        </Card>

        {/* Behaviour & model */}
        <Card>
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink">
            <SlidersHorizontal className="h-4 w-4 text-accent" /> Behaviour &
            model
          </h3>
          <div className="flex flex-col gap-4">
            <Textarea
              label="When the AI cannot help"
              placeholder="e.g. Offer to connect the caller to a human agent, then stop."
              rows={3}
              value={form.fallbackBehavior}
              onChange={(e) => set("fallbackBehavior", e.target.value)}
            />
            <Select
              label="AI model"
              options={cfg.models}
              value={form.model}
              onChange={(e) => set("model", e.target.value)}
              hint="Speech-to-speech model used for every AI call."
            />
            <Select
              label="Voice"
              options={cfg.voices}
              value={form.voice}
              onChange={(e) => set("voice", e.target.value)}
              hint="Male/female voice for the AI. Test on a call after publishing; revert to Default if a voice sounds wrong."
            />
          </div>
        </Card>
      </div>

      {/* Compiled preview */}
      <Card className="mt-6">
        <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-ink">
          <CheckCircle2 className="h-4 w-4 text-accent" /> Instruction preview
        </h3>
        <p className="mb-3 text-sm text-ink-muted">
          This is exactly what the AI is told, built from the fields above. It
          refreshes when you Save draft.
        </p>
        <pre className="scrollbar-thin max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-muted p-4 text-sm text-ink-muted">
          {cfg.compiledPreview}
        </pre>
      </Card>
    </div>
  );
}
