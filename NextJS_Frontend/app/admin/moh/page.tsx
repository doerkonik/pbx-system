"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Music, Plus, Pencil, Trash2, ListMusic } from "lucide-react";

import { useRequireAuth } from "@/lib/auth-context";
import { api, ApiError, type PaginatedResult } from "@/lib/api";
import {
  PageHeader,
  DataTable,
  Modal,
  Button,
  Input,
  Select,
  Badge,
  ConfirmDialog,
  EmptyState,
  Spinner,
  useToast,
  type Column,
} from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Types (local — do not depend on lib/types.ts)                      */
/* ------------------------------------------------------------------ */

interface MohFile {
  id: string | number;
  fileName: string;
  filePath: string;
}

interface MohClass {
  id: string | number;
  name: string;
  mode: string;
  directory: string;
  format: string;
  /** Present on the detail (GET /moh/:id) response. */
  files?: MohFile[];
  /** May be present on the list response. */
  fileCount?: number;
}

const MODE_OPTIONS = [
  { label: "files", value: "files" },
  { label: "mp3", value: "mp3" },
  { label: "custom", value: "custom" },
];

const FORMAT_OPTIONS = [
  { label: "wav", value: "wav" },
  { label: "mp3", value: "mp3" },
  { label: "gsm", value: "gsm" },
  { label: "ulaw", value: "ulaw" },
  { label: "alaw", value: "alaw" },
];

/* ------------------------------------------------------------------ */
/* Class create / edit form schema                                    */
/* ------------------------------------------------------------------ */

const classSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  mode: z.string().trim().min(1, "Mode is required"),
  directory: z.string().trim().min(1, "Directory is required"),
  format: z.string().trim().min(1, "Format is required"),
});

type ClassFormValues = z.infer<typeof classSchema>;

const emptyClassDefaults: ClassFormValues = {
  name: "",
  mode: "files",
  directory: "",
  format: "wav",
};

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong";
}

/* ================================================================== */
/* Page                                                               */
/* ================================================================== */

export default function MohPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [result, setResult] = useState<PaginatedResult<MohClass> | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<unknown>(null);

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MohClass | null>(null);
  const [detail, setDetail] = useState<MohClass | null>(null);
  const [deleting, setDeleting] = useState<MohClass | null>(null);

  // Debounce search -> reset to page 1
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await api.get<PaginatedResult<MohClass>>("/moh", {
        params: { page, limit: pageSize, search: search || undefined },
      });
      setResult(data);
    } catch (e) {
      setListError(e);
    } finally {
      setListLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (!user) return;
    void loadList();
  }, [user, loadList]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: MohClass) => {
    setEditing(row);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.del(`/moh/${deleting.id}`);
      toast({
        title: "Class deleted",
        description: `"${deleting.name}" was removed.`,
        variant: "success",
      });
      setDeleting(null);
      // If we deleted the last row on a page, step back a page.
      if (result && result.data.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        void loadList();
      }
    } catch (e) {
      toast({ title: "Delete failed", description: errMsg(e), variant: "error" });
    }
  };

  const columns = useMemo<Column<MohClass>[]>(
    () => [
      {
        key: "name",
        header: "Name",
        cell: (row) => (
          <div className="flex items-center gap-2 font-medium text-ink">
            <Music size={15} className="shrink-0 text-ink-subtle" />
            <span className="truncate">{row.name}</span>
          </div>
        ),
      },
      {
        key: "mode",
        header: "Mode",
        cell: (row) => <Badge variant="neutral">{row.mode}</Badge>,
      },
      {
        key: "directory",
        header: "Directory",
        cell: (row) => (
          <span className="font-mono text-xs text-ink-muted">
            {row.directory}
          </span>
        ),
      },
      {
        key: "format",
        header: "Format",
        cell: (row) => <Badge variant="accent">{row.format}</Badge>,
      },
      {
        key: "files",
        header: "Files",
        align: "center",
        cell: (row) => {
          const count = row.fileCount ?? row.files?.length;
          return count == null ? (
            <span className="text-ink-subtle">—</span>
          ) : (
            <Badge variant="info">{count}</Badge>
          );
        },
      },
      {
        key: "actions",
        header: "",
        align: "right",
        width: "1%",
        cell: (row) => (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ListMusic size={15} />}
              onClick={() => setDetail(row)}
            >
              Files
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit"
              onClick={() => openEdit(row)}
            >
              <Pencil size={15} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete"
              onClick={() => setDeleting(row)}
            >
              <Trash2 size={15} className="text-danger" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  if (authLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Music on Hold"
        description="Manage on-hold audio classes and their files."
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={openCreate}>
            New class
          </Button>
        }
      />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search classes…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          leftIcon={<Music size={15} />}
        />
      </div>

      <DataTable<MohClass>
        columns={columns}
        data={result?.data ?? []}
        rowKey={(row) => row.id}
        loading={listLoading}
        error={listError}
        onRetry={loadList}
        onRowClick={(row) => setDetail(row)}
        emptyMessage="No music-on-hold classes yet. Create one to get started."
        pagination={{
          page,
          pageSize,
          total: result?.total ?? 0,
          onPageChange: setPage,
        }}
      />

      {formOpen && (
        <ClassFormModal
          open={formOpen}
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            void loadList();
          }}
        />
      )}

      {detail && (
        <FilesModal
          classId={detail.id}
          initialName={detail.name}
          onClose={() => setDetail(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete music-on-hold class"
        description={
          deleting
            ? `"${deleting.name}" and its file references will be removed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}

/* ================================================================== */
/* Class create / edit modal                                          */
/* ================================================================== */

function ClassFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: MohClass | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: emptyClassDefaults,
  });

  useEffect(() => {
    if (editing) {
      reset({
        name: editing.name,
        mode: editing.mode,
        directory: editing.directory,
        format: editing.format,
      });
    } else {
      reset(emptyClassDefaults);
    }
  }, [editing, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (editing) {
        await api.patch(`/moh/${editing.id}`, values);
        toast({ title: "Class updated", variant: "success" });
      } else {
        await api.post("/moh", values);
        toast({ title: "Class created", variant: "success" });
      }
      onSaved();
    } catch (e) {
      toast({
        title: editing ? "Update failed" : "Create failed",
        description: errMsg(e),
        variant: "error",
      });
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? "Edit class" : "New music-on-hold class"}
      description="Audio played to callers placed on hold."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="moh-class-form"
            loading={isSubmitting}
          >
            {editing ? "Save changes" : "Create class"}
          </Button>
        </>
      }
    >
      <form id="moh-class-form" onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. default"
          error={errors.name?.message}
          {...register("name")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Mode"
            options={MODE_OPTIONS}
            error={errors.mode?.message}
            {...register("mode")}
          />
          <Select
            label="Format"
            options={FORMAT_OPTIONS}
            error={errors.format?.message}
            {...register("format")}
          />
        </div>
        <Input
          label="Directory"
          placeholder="e.g. /var/lib/asterisk/moh/default"
          hint="Filesystem path where the audio files live."
          error={errors.directory?.message}
          {...register("directory")}
        />
      </form>
    </Modal>
  );
}

/* ================================================================== */
/* Files management modal                                             */
/* ================================================================== */

const fileSchema = z.object({
  fileName: z.string().trim().min(1, "File name is required"),
  filePath: z.string().trim().min(1, "File path is required"),
});

type FileFormValues = z.infer<typeof fileSchema>;

function FilesModal({
  classId,
  initialName,
  onClose,
}: {
  classId: string | number;
  initialName: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [moh, setMoh] = useState<MohClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [deletingFile, setDeletingFile] = useState<MohFile | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FileFormValues>({
    resolver: zodResolver(fileSchema),
    defaultValues: { fileName: "", filePath: "" },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<MohClass>(`/moh/${classId}`);
      setMoh(data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Defensive: files array key may vary.
  const files: MohFile[] = moh?.files ?? [];

  const onAdd = handleSubmit(async (values) => {
    try {
      await api.post(`/moh/${classId}/files`, values);
      toast({ title: "File added", variant: "success" });
      reset({ fileName: "", filePath: "" });
      await load();
    } catch (e) {
      toast({ title: "Add failed", description: errMsg(e), variant: "error" });
    }
  });

  const handleDeleteFile = async () => {
    if (!deletingFile) return;
    try {
      await api.del(`/moh/${classId}/files/${deletingFile.id}`);
      toast({ title: "File removed", variant: "success" });
      setDeletingFile(null);
      await load();
    } catch (e) {
      toast({ title: "Delete failed", description: errMsg(e), variant: "error" });
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Files — ${moh?.name ?? initialName}`}
      description="Audio files played in this on-hold class."
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size={22} />
        </div>
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-sm text-danger">{errMsg(error)}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* File list */}
          {files.length === 0 ? (
            <EmptyState
              compact
              icon={<ListMusic size={22} />}
              title="No files yet"
              description="Add the first audio file for this class below."
            />
          ) : (
            <ul className="divide-y divide-line rounded-card border border-line">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {f.fileName}
                    </p>
                    <p className="truncate font-mono text-xs text-ink-muted">
                      {f.filePath}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove file"
                    onClick={() => setDeletingFile(f)}
                  >
                    <Trash2 size={15} className="text-danger" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* Add-file mini form */}
          <form
            onSubmit={onAdd}
            className="space-y-3 rounded-card border border-line bg-surface-muted/40 p-4"
          >
            <p className="text-sm font-semibold text-ink">Add a file</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="File name"
                placeholder="e.g. track1.wav"
                error={errors.fileName?.message}
                {...register("fileName")}
              />
              <Input
                label="File path"
                placeholder="e.g. /var/lib/asterisk/moh/track1.wav"
                error={errors.filePath?.message}
                {...register("filePath")}
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                leftIcon={<Plus size={15} />}
                loading={isSubmitting}
              >
                Add file
              </Button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!deletingFile}
        onClose={() => setDeletingFile(null)}
        onConfirm={handleDeleteFile}
        title="Remove file"
        description={
          deletingFile
            ? `Remove "${deletingFile.fileName}" from this class?`
            : undefined
        }
        confirmLabel="Remove"
        destructive
      />
    </Modal>
  );
}
