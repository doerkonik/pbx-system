"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { Button } from "./Button";

export type SortDirection = "asc" | "desc";

export interface Column<T> {
  /** Stable key; used for sorting state and as React key. */
  key: string;
  header: React.ReactNode;
  /** Cell renderer. Receives the row and its index. */
  cell: (row: T, index: number) => React.ReactNode;
  /** Enable clickable sort header for this column. */
  sortable?: boolean;
  /** Text alignment. */
  align?: "left" | "center" | "right";
  /** Fixed width (CSS value). */
  width?: string;
  /** Extra className for the cell. */
  className?: string;
  /** Extra className for the header cell. */
  headerClassName?: string;
}

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Row key extractor. */
  rowKey: (row: T, index: number) => string | number;
  loading?: boolean;
  /** Error object/message; renders the baked-in ErrorState. */
  error?: unknown;
  onRetry?: () => void;
  /** Controlled sort state. Omit for uncontrolled internal sorting. */
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  /** Server-side pagination controls. Omit to hide the footer. */
  pagination?: DataTablePagination;
  /** Row click handler (makes rows interactive). */
  onRowClick?: (row: T, index: number) => void;
  /** Custom empty state content. */
  empty?: React.ReactNode;
  /** Message when there are no rows. */
  emptyMessage?: string;
  className?: string;
}

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * Paginated, sortable table with loading / empty / error states baked in.
 * Sorting can be controlled (server-side) or left uncontrolled (client-side).
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  error,
  onRetry,
  sort,
  onSortChange,
  pagination,
  onRowClick,
  empty,
  emptyMessage = "No records found.",
  className,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState<SortState | null>(null);
  const controlled = sort !== undefined;
  const activeSort = controlled ? sort ?? null : internalSort;

  const setSort = (next: SortState | null) => {
    if (controlled) onSortChange?.(next);
    else setInternalSort(next);
  };

  const toggleSort = (key: string) => {
    let next: SortState | null;
    if (!activeSort || activeSort.key !== key) {
      next = { key, direction: "asc" };
    } else if (activeSort.direction === "asc") {
      next = { key, direction: "desc" };
    } else {
      next = null;
    }
    setSort(next);
  };

  // Client-side sorting only when uncontrolled + a sort is active.
  const rows = useMemo(() => {
    if (controlled || !internalSort) return data;
    const { key, direction } = internalSort;
    const factor = direction === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = (a as Record<string, unknown>)[key];
      const bv = (b as Record<string, unknown>)[key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * factor;
      }
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [data, internalSort, controlled]);

  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

  const colCount = columns.length;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-line-soft bg-surface shadow-sm",
        className,
      )}
    >
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line-soft bg-surface-muted">
              {columns.map((col) => {
                const isSorted = activeSort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      "px-6 py-3 text-sm font-bold text-ink-muted",
                      alignClass[col.align ?? "left"],
                      col.headerClassName,
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={cn(
                          "inline-flex items-center gap-1 transition-colors hover:text-ink",
                          col.align === "right" && "flex-row-reverse",
                        )}
                      >
                        {col.header}
                        {isSorted ? (
                          activeSort?.direction === "asc" ? (
                            <ChevronUp size={13} />
                          ) : (
                            <ChevronDown size={13} />
                          )
                        ) : (
                          <ChevronsUpDown size={13} className="text-ink-subtle" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colCount} className="px-4">
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted">
                    <Spinner size={18} />
                    Loading…
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={colCount} className="px-4">
                  <ErrorState error={error} onRetry={onRetry} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4">
                  {empty ?? (
                    <EmptyState title="Nothing here yet" description={emptyMessage} />
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                  className={cn(
                    "border-b border-line-soft transition-colors last:border-0 hover:bg-surface-muted",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-6 py-4 text-ink-muted",
                        alignClass[col.align ?? "left"],
                        col.className,
                      )}
                    >
                      {col.cell(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && !loading && !error && rows.length > 0 && (
        <div className="flex items-center justify-between gap-4 border-t border-line-soft px-6 py-3">
          <p className="text-xs text-ink-muted">
            {(pagination.page - 1) * pagination.pageSize + 1}–
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
            {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <span className="text-xs tabular-nums text-ink-muted">
              Page {pagination.page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
