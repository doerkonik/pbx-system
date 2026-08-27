"use client";

/**
 * Admin › Extensions — manage SIP extensions.
 * Endpoints: GET/POST /extensions, PATCH/DELETE /extensions/:id
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

import { api, ApiError, type PaginatedResult } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth-context";
import {
  PageHeader,
  DataTable,
  Modal,
  Button,
  Input,
  Toggle,
  StatusPill,
  Badge,
  Spinner,
  ConfirmDialog,
  useToast,
  type Column,
  type StatusPillVariant,
} from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Types (local — endpoint shapes differ from lib/types.ts)           */
/* ------------------------------------------------------------------ */

type Presence =
  | "idle"
  | "ringing"
  | "in_call"
  | "on_hold"
  | "paused"
  | "offline";

interface ExtensionRegistration {
  presence: Presence;
}

interface Extension {
  id: string;
  extensionNumber: string;
  displayName?: string | null;
  department?: string | null;
  webrtc: boolean;
  recordingEnabled: boolean;
  callGroup?: string | null;
  pickupGroup?: string | null;
  isActive: boolean;
  registration?: ExtensionRegistration | null;
}

const PAGE_SIZE = 20;

/* ------------------------------------------------------------------ */
/* Validation                                                         */
/* ------------------------------------------------------------------ */

const EXT_REGEX = /^\d{2,10}$/;

const baseSchema = z.object({
  extensionNumber: z.string().regex(EXT_REGEX, "Must be 2–10 digits"),
  secret: z.string().optional().or(z.literal("")),
  displayName: z.string().optional().or(z.literal("")),
  department: z.string().optional().or(z.literal("")),
  webrtc: z.boolean(),
  recordingEnabled: z.boolean(),
  callGroup: z.string().optional().or(z.literal("")),
  pickupGroup: z.string().optional().or(z.literal("")),
  isActive: z.boolean(),
});

/** superRefine keyed on isEdit: secret (min 8) is required on create only. */
function makeSchema(isEdit: boolean) {
  return baseSchema.superRefine((val, ctx) => {
    if (!isEdit) {
      if (!val.secret || val.secret.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["secret"],
          message: "Secret must be at least 8 characters",
        });
      }
    }
  });
}

type FormValues = z.infer<typeof baseSchema>;

const EMPTY_FORM: FormValues = {
  extensionNumber: "",
  secret: "",
  displayName: "",
  department: "",
  webrtc: false,
  recordingEnabled: false,
  callGroup: "",
  pickupGroup: "",
  isActive: true,
};

/** Map the live presence enum 1:1 onto a StatusPill variant. */
const PRESENCE_VARIANT: Record<Presence, StatusPillVariant> = {
  idle: "idle",
  ringing: "ringing",
  in_call: "in_call",
  on_hold: "on_hold",
  paused: "paused",
  offline: "offline",
};

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function ExtensionsPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();

  const [rows, setRows] = useState<Extension[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Extension | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Extension | null>(null);

  const isEdit = editing !== null;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(makeSchema(isEdit)),
    defaultValues: EMPTY_FORM,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResult<Extension>>("/extensions", {
        params: { page, limit: PAGE_SIZE, search: search || undefined },
      });
      setRows(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, page, search, load]);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  function openCreate() {
    setEditing(null);
    reset(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(row: Extension) {
    setEditing(row);
    reset({
      extensionNumber: row.extensionNumber,
      secret: "",
      displayName: row.displayName ?? "",
      department: row.department ?? "",
      webrtc: row.webrtc,
      recordingEnabled: row.recordingEnabled,
      callGroup: row.callGroup ?? "",
      pickupGroup: row.pickupGroup ?? "",
      isActive: row.isActive,
    });
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditing(null);
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        extensionNumber: values.extensionNumber,
        displayName: values.displayName || undefined,
        department: values.department || undefined,
        webrtc: values.webrtc,
        recordingEnabled: values.recordingEnabled,
        callGroup: values.callGroup || undefined,
        pickupGroup: values.pickupGroup || undefined,
        isActive: values.isActive,
      };

      if (editing) {
        // secret is create-only — never send on edit.
        await api.patch<Extension>(`/extensions/${editing.id}`, payload);
        toast({
          title: "Extension updated",
          description: `Extension ${values.extensionNumber} saved.`,
          variant: "success",
        });
      } else {
        payload.secret = values.secret;
        await api.post<Extension>("/extensions", payload);
        toast({
          title: "Extension created",
          description: `Extension ${values.extensionNumber} added.`,
          variant: "success",
        });
      }
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong";
      toast({ title: "Save failed", description: msg, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  });

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      await api.del(`/extensions/${target.id}`);
      toast({
        title: "Extension deleted",
        description: `Extension ${target.extensionNumber} removed.`,
        variant: "success",
      });
      setDeleteTarget(null);
      // Step back a page if we just removed the last row on it.
      if (rows.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        await load();
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong";
      toast({ title: "Delete failed", description: msg, variant: "error" });
      throw e; // keep the dialog open on failure
    }
  }

  const columns = useMemo<Column<Extension>[]>(
    () => [
      {
        key: "extensionNumber",
        header: "Extension",
        cell: (row) => (
          <span className="font-medium text-ink">{row.extensionNumber}</span>
        ),
      },
      {
        key: "displayName",
        header: "Name",
        cell: (row) => row.displayName || "—",
      },
      {
        key: "department",
        header: "Department",
        cell: (row) => row.department || "—",
      },
      {
        key: "type",
        header: "Type",
        cell: (row) =>
          row.webrtc ? (
            <Badge variant="accent">WebRTC</Badge>
          ) : (
            <Badge variant="neutral">SIP</Badge>
          ),
      },
      {
        key: "presence",
        header: "Presence",
        cell: (row) => {
          const presence: Presence = row.registration?.presence ?? "offline";
          return (
            <StatusPill
              variant={PRESENCE_VARIANT[presence]}
              dot
              pulse={presence === "ringing" || presence === "in_call"}
            />
          );
        },
      },
      {
        key: "actions",
        header: "",
        align: "right",
        width: "1%",
        cell: (row) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit extension"
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete extension"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteTarget(row);
              }}
            >
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          </div>
        ),
      },
    ],
    // Handlers are defined in component scope and stable for table lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (authLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Extensions"
        description="Manage SIP extensions and their assignments."
        actions={
          <Button
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={openCreate}
          >
            Create extension
          </Button>
        }
      />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search extensions…"
          leftIcon={<Search className="h-4 w-4" />}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <DataTable<Extension>
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={load}
        emptyMessage="No extensions found."
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total,
          onPageChange: setPage,
        }}
      />

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        size="lg"
        title={isEdit ? "Edit extension" : "Create extension"}
        description={
          isEdit
            ? "Update the extension configuration."
            : "Add a new SIP extension."
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={closeModal}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="extension-form"
              variant="primary"
              loading={submitting}
            >
              {isEdit ? "Save changes" : "Create"}
            </Button>
          </div>
        }
      >
        <form id="extension-form" onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Extension number"
              placeholder="e.g. 1001"
              disabled={isEdit}
              hint={isEdit ? "Extension number cannot be changed" : undefined}
              error={errors.extensionNumber?.message}
              {...register("extensionNumber")}
            />
            {!isEdit && (
              <Input
                label="Secret"
                type="password"
                placeholder="At least 8 characters"
                error={errors.secret?.message}
                {...register("secret")}
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Display name"
              placeholder="Optional"
              error={errors.displayName?.message}
              {...register("displayName")}
            />
            <Input
              label="Department"
              placeholder="Optional"
              error={errors.department?.message}
              {...register("department")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Call group"
              placeholder="Optional"
              error={errors.callGroup?.message}
              {...register("callGroup")}
            />
            <Input
              label="Pickup group"
              placeholder="Optional"
              error={errors.pickupGroup?.message}
              {...register("pickupGroup")}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-lg border border-line p-4 sm:grid-cols-3">
            <Controller
              control={control}
              name="webrtc"
              render={({ field }) => (
                <Toggle
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label="WebRTC"
                />
              )}
            />
            <Controller
              control={control}
              name="recordingEnabled"
              render={({ field }) => (
                <Toggle
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label="Recording"
                />
              )}
            />
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <Toggle
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label="Active"
                />
              )}
            />
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete extension"
        description={
          deleteTarget
            ? `Delete extension ${deleteTarget.extensionNumber}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
