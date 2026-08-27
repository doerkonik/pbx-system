"use client";

/** Small helper hook: paginated + searchable list fetch with reload/delete. */
import { useCallback, useEffect, useState } from "react";
import { api, type PaginatedResult } from "./api";

export function useResourceList<T>(path: string, pageSize = 20) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResult<T>>(path, {
        params: { page, limit: pageSize, search: search || undefined },
      });
      setRows(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [path, page, pageSize, search]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  return {
    rows, total, page, setPage, pageSize,
    search: searchInput, setSearch: setSearchInput,
    loading, error, reload,
  };
}
