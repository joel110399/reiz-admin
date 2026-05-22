"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Paginated } from "@/types/drf";

export type PaginatedColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Valor para export CSV (si falta, se intenta `String(row[key])`). */
  csvValue?: (row: T) => string;
};

function mergeQuery(
  path: string,
  updates: Record<string, string | null | undefined>
): string {
  const qIndex = path.indexOf("?");
  const pathname = qIndex === -1 ? path : path.slice(0, qIndex);
  const raw = qIndex === -1 ? "" : path.slice(qIndex + 1);
  const sp = new URLSearchParams(raw);
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined) continue;
    if (v === null || v === "") sp.delete(k);
    else sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `${pathname}?${s}` : pathname;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function parseSearchParams(path: string): URLSearchParams {
  const q = path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
  return new URLSearchParams(q);
}

function getVisibleRange(
  paginationStyle: "page" | "limit",
  pageUrl: string,
  pageSize: number,
  count: number,
  resultsLength: number
): { from: number; to: number } {
  if (count === 0 || resultsLength === 0) return { from: 0, to: 0 };
  const sp = parseSearchParams(pageUrl);
  if (paginationStyle === "limit") {
    const offset = parseInt(sp.get("offset") || "0", 10);
    const from = offset + 1;
    const to = offset + resultsLength;
    return { from, to: Math.min(to, count) };
  }
  const page = parseInt(sp.get("page") || "1", 10);
  const from = (page - 1) * pageSize + 1;
  const to = from + resultsLength - 1;
  return { from, to: Math.min(to, count) };
}

function totalPages(count: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(count / pageSize));
}

/** Páginas a mostrar (1 … N) con elipsis si hace falta. */
function paginationItems(
  current: number,
  total: number
): (number | "ellipsis")[] {
  if (total <= 0) return [];
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>();
  set.add(1);
  set.add(total);
  for (let p = current - 2; p <= current + 2; p++) {
    if (p >= 1 && p <= total) set.add(p);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

function currentPageNumber(
  paginationStyle: "page" | "limit",
  pageUrl: string,
  pageSize: number
): number {
  const sp = parseSearchParams(pageUrl);
  if (paginationStyle === "limit") {
    const offset = parseInt(sp.get("offset") || "0", 10);
    const lim = parseInt(sp.get("limit") || String(pageSize), 10) || pageSize;
    return Math.floor(offset / lim) + 1;
  }
  return parseInt(sp.get("page") || "1", 10);
}

function buildPageLink(
  paginationStyle: "page" | "limit",
  initialPath: string,
  page: number,
  pageSize: number,
  search: string | undefined
): string {
  if (paginationStyle === "limit") {
    const offset = (page - 1) * pageSize;
    return mergeQuery(initialPath, {
      limit: String(pageSize),
      offset: offset > 0 ? String(offset) : null,
      search: search?.trim() || null,
    });
  }
  return mergeQuery(initialPath, {
    page: page > 1 ? String(page) : null,
    page_size: String(pageSize),
    search: search?.trim() || null,
  });
}

function downloadCsv(
  filename: string,
  headers: string[],
  rows: string[][]
) {
  const BOM = "\uFEFF";
  const esc = (cell: string) =>
    `"${String(cell).replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const lines = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob([BOM + lines], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function slugifyTitle(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function PaginatedTable<T extends Record<string, unknown>>({
  title,
  description,
  queryKey,
  initialPath,
  columns,
  toolbar,
  renderRowActions,
  filters,
  showSearch = true,
  searchPlaceholder = "Buscar…",
  paginationStyle = "page",
  pageSizeOptions = [5, 10, 20, 50],
  defaultPageSize = 20,
  exportFileName,
  enableExport = true,
}: {
  title: string;
  description?: string;
  queryKey: string;
  initialPath: string;
  columns: PaginatedColumn<T>[];
  toolbar?: React.ReactNode;
  renderRowActions?: (row: T) => React.ReactNode;
  /** Bloque opcional bajo el título «Filtros» (selects, etc.). */
  filters?: React.ReactNode;
  showSearch?: boolean;
  searchPlaceholder?: string;
  /** `page`: ?page=&page_size= (DRF estándar). `limit`: ?limit=&offset= (p. ej. negocios). */
  paginationStyle?: "page" | "limit";
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  exportFileName?: string;
  enableExport?: boolean;
}) {
  const [pageSize, setPageSize] = React.useState(defaultPageSize);
  const [searchInput, setSearchInput] = React.useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 350);

  const baseParams = React.useMemo(() => {
    const s = debouncedSearch.trim();
    if (paginationStyle === "limit") {
      return {
        limit: String(pageSize),
        offset: null as string | null,
        search: s || null,
      };
    }
    return {
      page_size: String(pageSize),
      page: null as string | null,
      search: s || null,
    };
  }, [debouncedSearch, pageSize, paginationStyle]);

  const [pageUrl, setPageUrl] = React.useState(() =>
    mergeQuery(initialPath, baseParams)
  );

  React.useEffect(() => {
    setPageUrl(mergeQuery(initialPath, baseParams));
  }, [initialPath, baseParams]);

  const { data, isLoading, error } = useQuery({
    queryKey: [queryKey, pageUrl],
    queryFn: async () => {
      const { apiJson } = await import("@/lib/api-client");
      return apiJson<Paginated<T>>(pageUrl);
    },
  });

  const exportCsv = React.useCallback(() => {
    if (!data?.results.length) return;
    const headers = columns.map((c) => c.header);
    const rows = data.results.map((row) =>
      columns.map((c) => {
        if (c.csvValue) return c.csvValue(row);
        const v = row[c.key as keyof T];
        if (v === null || v === undefined) return "";
        if (
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean"
        )
          return String(v);
        return JSON.stringify(v);
      })
    );
    const name =
      (exportFileName && exportFileName.trim()) ||
      slugifyTitle(title) ||
      "export";
    downloadCsv(name, headers, rows);
  }, [columns, data, exportFileName, title]);

  const pageNumbers = React.useMemo(() => {
    if (!data) return [] as (number | "ellipsis")[];
    return paginationItems(
      currentPageNumber(paginationStyle, pageUrl, pageSize),
      totalPages(data.count, pageSize)
    );
  }, [data, pageUrl, pageSize, paginationStyle]);

  const goToPage = React.useCallback(
    (p: number) => {
      if (!data) return;
      const tp = totalPages(data.count, pageSize);
      if (p < 1 || p > tp) return;
      setPageUrl(
        buildPageLink(
          paginationStyle,
          initialPath,
          p,
          pageSize,
          debouncedSearch.trim() || undefined
        )
      );
    },
    [data, debouncedSearch, initialPath, pageSize, paginationStyle]
  );

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 max-w-full" />
        <Skeleton className="h-12 w-full max-w-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive border-destructive/30 rounded-xl border p-4 text-sm">
        {error instanceof Error ? error.message : "Error"}
      </div>
    );
  }

  if (!data) return null;

  const actionCol = !!renderRowActions;
  const colCount = columns.length + (actionCol ? 1 : 0);
  const { from, to } = getVisibleRange(
    paginationStyle,
    pageUrl,
    pageSize,
    data.count,
    data.results.length
  );
  const tp = totalPages(data.count, pageSize);
  const cur = currentPageNumber(paginationStyle, pageUrl, pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <Card className="overflow-hidden py-0 shadow-none ring-1 ring-foreground/10">
        {filters ? (
          <div className="border-border border-b px-4 py-4 md:px-6">
            <h2 className="mb-3 text-sm font-semibold tracking-tight">Filtros</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filters}</div>
          </div>
        ) : null}

        <CardHeader className="border-border flex-col gap-4 space-y-0 border-b px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex w-full min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            {showSearch ? (
              <div className="relative max-w-md flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input
                  type="search"
                  placeholder={searchPlaceholder}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-9 pl-9"
                  autoComplete="off"
                />
              </div>
            ) : null}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground hidden text-xs sm:inline">
                Filas
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => setPageSize(Number(v ?? pageSize))}
              >
                <SelectTrigger size="sm" className="w-[4.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {enableExport ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={exportCsv}
                disabled={!data.results.length}
              >
                <Download className="size-3.5" />
                Exportar
              </Button>
            ) : null}
            {toolbar ? (
              <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-b-0">
                {columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className="text-muted-foreground h-11 px-4 font-medium"
                  >
                    {c.header}
                  </TableHead>
                ))}
                {actionCol ? (
                  <TableHead className="text-muted-foreground h-11 w-[120px] px-4 text-right font-medium">
                    Acciones
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.results.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={colCount}
                    className="text-muted-foreground h-32 text-center"
                  >
                    Sin resultados
                  </TableCell>
                </TableRow>
              )}
              {data.results.map((row, i) => (
                <TableRow
                  key={i}
                  className="border-border/80 hover:bg-muted/30"
                >
                  {columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className="text-foreground/90 max-w-[min(100vw-4rem,420px)] px-4 py-3 align-middle"
                    >
                      <div className="truncate">{c.render(row)}</div>
                    </TableCell>
                  ))}
                  {actionCol ? (
                    <TableCell className="px-4 py-3 text-right">
                      {renderRowActions!(row)}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>

        <div className="border-border bg-muted/20 flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <p className="text-muted-foreground text-sm tabular-nums">
            Mostrando{" "}
            <span className="text-foreground font-medium">
              {data.count === 0 ? 0 : from}
            </span>{" "}
            a{" "}
            <span className="text-foreground font-medium">
              {data.count === 0 ? 0 : to}
            </span>{" "}
            de{" "}
            <span className="text-foreground font-medium">{data.count}</span>{" "}
            {data.count === 1 ? "entrada" : "entradas"}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-0.5 px-2"
              disabled={!data.previous}
              onClick={() => data.previous && setPageUrl(data.previous)}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <div className="flex items-center gap-0.5 px-1">
              {pageNumbers.map((p, idx) =>
                p === "ellipsis" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="text-muted-foreground px-1 text-sm"
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    type="button"
                    variant={p === cur ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "size-8 min-w-8 p-0 font-medium",
                      p === cur && "pointer-events-none"
                    )}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </Button>
                )
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-0.5 px-2"
              disabled={!data.next}
              onClick={() => data.next && setPageUrl(data.next)}
            >
              Siguiente
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
