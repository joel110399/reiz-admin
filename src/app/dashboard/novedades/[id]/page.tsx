"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DetailPageHeader } from "@/components/detail-page-header";
import type { NoveltyRow } from "../page";
import { apiFetch, apiJson, formatApiErrorBody } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UserRow = {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  status: string;
  override: string;
  responded_at: string | null;
};

type PaginatedUsers = {
  count: number;
  next: string | null;
  previous: string | null;
  results: UserRow[];
};

const FILTERS = [
  { id: "unseen", label: "Sin ver" },
  { id: "accepted", label: "Abrió" },
  { id: "dismissed", label: "Ahora no" },
  { id: "hidden", label: "Ocultos" },
  { id: "forced", label: "Forzados" },
  { id: "all", label: "Todos" },
] as const;

function statusLabel(row: UserRow) {
  if (row.override === "hide") return "Oculto";
  if (row.override === "show") return "Forzado";
  if (row.status === "accepted") return "Abrió";
  if (row.status === "dismissed") return "Ahora no";
  return "Sin ver";
}

export default function NovedadDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState<string>("unseen");
  const [q, setQ] = React.useState("");
  const [qDebounced, setQDebounced] = React.useState("");
  const [selected, setSelected] = React.useState<number[]>([]);

  React.useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    setSelected([]);
  }, [filter, qDebounced, id]);

  const noveltyQuery = useQuery({
    queryKey: ["staff-novelty", id],
    queryFn: () =>
      apiJson<NoveltyRow>(`/api/notifications/staff/novelties/${id}/`),
    enabled: !!id,
  });

  const usersQuery = useQuery({
    queryKey: ["staff-novelty-users", id, filter, qDebounced],
    queryFn: () => {
      const params = new URLSearchParams({
        status: filter,
        page_size: "100",
      });
      if (qDebounced) params.set("q", qDebounced);
      return apiJson<PaginatedUsers>(
        `/api/notifications/staff/novelties/${id}/users/?${params}`
      );
    },
    enabled: !!id,
  });

  const toggleMutation = useMutation({
    mutationFn: async (next: boolean) => {
      const res = await apiFetch(`/api/notifications/staff/novelties/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: next }),
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff-novelty", id] });
      void qc.invalidateQueries({ queryKey: ["staff-novelties"] });
      toast.success("Estado actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const targetMutation = useMutation({
    mutationFn: async (action: "show" | "hide" | "reset") => {
      const res = await apiFetch(
        `/api/notifications/staff/novelties/${id}/target/`,
        {
          method: "POST",
          body: JSON.stringify({ action, user_ids: selected }),
        }
      );
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      setSelected([]);
      void qc.invalidateQueries({ queryKey: ["staff-novelty", id] });
      void qc.invalidateQueries({ queryKey: ["staff-novelty-users", id] });
      void qc.invalidateQueries({ queryKey: ["staff-novelties"] });
      toast.success("Usuarios actualizados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const novelty = noveltyQuery.data;
  const users = usersQuery.data?.results ?? [];
  const allIds = users.map((u) => u.id);
  const allSelected =
    allIds.length > 0 && allIds.every((uid) => selected.includes(uid));

  const toggleOne = (uid: number) => {
    setSelected((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    );
  };

  if (!id) {
    return <p className="text-muted-foreground text-sm">ID no válido.</p>;
  }

  if (noveltyQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Cargando novedad…</p>;
  }

  if (noveltyQuery.error || !novelty) {
    return (
      <>
        <DetailPageHeader
          backHref="/dashboard/novedades"
          title="Novedad"
          description="No se pudo cargar."
        />
        <p className="text-destructive text-sm">
          {noveltyQuery.error instanceof Error
            ? noveltyQuery.error.message
            : "Error"}
        </p>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <DetailPageHeader
        backHref="/dashboard/novedades"
        title={novelty.title}
        description={novelty.body}
        actions={
          <Button
            variant={novelty.is_active ? "destructive" : "default"}
            disabled={toggleMutation.isPending}
            onClick={() => toggleMutation.mutate(!novelty.is_active)}
          >
            {novelty.is_active ? "Desactivar para todos" : "Activar para todos"}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={novelty.is_active ? "default" : "secondary"}>
          {novelty.is_active ? "Activa" : "Apagada"}
        </Badge>
        <span className="text-muted-foreground text-sm">
          {novelty.unseen_count} sin ver · {novelty.accepted_count} abrió ·{" "}
          {novelty.dismissed_count} ahora no · {novelty.audience_count} cuentas
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios</CardTitle>
          <CardDescription>
            Selecciona cuentas y muestra u oculta esta novedad. Forzar la
            vuelve a mostrar aunque la hayan cerrado o esté apagada para todos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={filter === f.id ? "default" : "outline"}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                {f.id === "unseen" ? ` (${novelty.unseen_count})` : ""}
                {f.id === "accepted" ? ` (${novelty.accepted_count})` : ""}
                {f.id === "dismissed" ? ` (${novelty.dismissed_count})` : ""}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar email, usuario o nombre"
              className="sm:max-w-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!selected.length || targetMutation.isPending}
                onClick={() => targetMutation.mutate("show")}
              >
                Mostrar a seleccionados
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!selected.length || targetMutation.isPending}
                onClick={() => targetMutation.mutate("hide")}
              >
                Ocultar a seleccionados
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!selected.length || targetMutation.isPending}
                onClick={() => targetMutation.mutate("reset")}
              >
                Quitar override
              </Button>
            </div>
          </div>

          {usersQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Cargando usuarios…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(allSelected ? [] : allIds)
                      }
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      Nadie en este filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected.includes(u.id)}
                          onChange={() => toggleOne(u.id)}
                          aria-label={`Seleccionar ${u.email}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {u.full_name || u.username}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {u.email} · id {u.id}
                        </div>
                      </TableCell>
                      <TableCell>{statusLabel(u)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
          {usersQuery.data?.count ? (
            <p className="text-muted-foreground text-xs">
              Mostrando {users.length} de {usersQuery.data.count}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
