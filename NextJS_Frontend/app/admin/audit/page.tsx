"use client";
/** Admin › Audit Log — config-change history. */
import { useRequireAuth } from "@/lib/auth-context";
import { useResourceList } from "@/lib/use-resource";
import { PageHeader, DataTable, Badge, Spinner, type Column, type BadgeVariant } from "@/components/ui";

interface AuditRow {
  id: string; createdAt: string; username?: string | null; role?: string | null;
  method: string; action: string; path: string; resource?: string | null;
  statusCode?: number | null; ip?: string | null;
}
const METHOD_VARIANT: Record<string, BadgeVariant> = {
  POST: "success", PATCH: "warn", PUT: "warn", DELETE: "danger",
};

export default function AuditPage() {
  const { user, loading: authLoading } = useRequireAuth("admin");
  const list = useResourceList<AuditRow>("/audit-logs", 25);

  const columns: Column<AuditRow>[] = [
    { key: "time", header: "Time", cell: (r) => <span className="whitespace-nowrap text-xs text-ink-muted">{new Date(r.createdAt).toLocaleString()}</span> },
    { key: "user", header: "User", cell: (r) => (
      <span className="flex flex-col leading-tight">
        <span className="font-medium">{r.username ?? "—"}</span>
        {r.role && <span className="text-[11px] capitalize text-ink-subtle">{r.role}</span>}
      </span>) },
    { key: "action", header: "Action", cell: (r) => <span className="flex items-center gap-2"><Badge variant={METHOD_VARIANT[r.method] ?? "neutral"}>{r.method}</Badge><span className="text-xs capitalize text-ink-muted">{r.action}</span></span> },
    { key: "resource", header: "Resource", cell: (r) => r.resource || <span className="text-ink-subtle">—</span> },
    { key: "path", header: "Path", cell: (r) => <span className="font-mono text-xs text-ink-muted">{r.path}</span> },
    { key: "status", header: "Status", cell: (r) => r.statusCode ?? "—" },
  ];

  if (authLoading || !user) return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  return (
    <div>
      <PageHeader title="Audit Log" description="Every configuration change, by whom and when." />
      <DataTable<AuditRow> columns={columns} data={list.rows} rowKey={(r) => r.id} loading={list.loading} error={list.error} onRetry={list.reload}
        emptyMessage="No audit entries." pagination={{ page: list.page, pageSize: list.pageSize, total: list.total, onPageChange: list.setPage }} />
    </div>
  );
}
