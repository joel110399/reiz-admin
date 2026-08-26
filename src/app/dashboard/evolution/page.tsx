"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Cpu,
  HardDrive,
  MessageCircle,
  RefreshCw,
  Server,
  Unplug,
  Wifi,
} from "lucide-react";

import { KpiStatCard } from "@/components/dashboard/kpi-stat-card";
import { apiJson } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RetryBusinessButton, RetryMessageButton } from "@/components/whatsapp-failed-retry";
import { cn } from "@/lib/utils";
import type { Paginated } from "@/types/drf";

type MessageStatus = "sent" | "failed" | "skipped";
type MessageFilter = "all" | MessageStatus;

type FailureRow = {
  id: number;
  template_key: string;
  template_label: string;
  recipient_name: string;
  recipient_phone: string;
  error_message: string;
  body_preview: string;
  created_at: string | null;
  trigger: string;
  provider: string;
  can_retry?: boolean;
};

type MessageRow = FailureRow & {
  body: string;
  sent_at: string | null;
  status: MessageStatus;
  direction: string;
  can_retry?: boolean;
};

type MessagesPayload = Paginated<MessageRow> & {
  counts: { all: number; sent: number; failed: number; skipped: number };
};

type InstanceRow = {
  business_id: number | null;
  business_name: string;
  owner_email: string;
  instance: string;
  phone: string;
  profile_name: string;
  connect_status: string;
  evolution_state: string;
  connected_at: string | null;
  updated_at: string | null;
  pairing_code: string;
  in_reiz: boolean;
  in_evolution: boolean;
  healthy: boolean;
  sent_24h: number;
  sent_7d: number;
  failed_24h: number;
  last_sent_at: string | null;
  recent_failures?: FailureRow[];
};

type SeriesPoint = { ts: number; value: number };

type OpsPayload = {
  evolution: {
    configured: boolean;
    reachable: boolean;
    api_url: string;
    error: string | null;
    instance_count: number;
    connected_count: number;
    open_count: number;
    instances: InstanceRow[];
  };
  digitalocean: {
    configured: boolean;
    error: string | null;
    droplet: {
      id: number;
      name: string;
      status: string;
      region: string;
      image: string;
      size_slug: string;
      vcpus: number;
      memory_mb: number;
      disk_gb: number;
      price_monthly: number | null;
      ip: string;
      created_at: string;
      monitoring: boolean;
    } | null;
    metrics: {
      cpu_percent: number | null;
      memory_percent: number | null;
      memory_used_mb: number | null;
      memory_total_mb: number | null;
      load_1: number | null;
      disk_percent: number | null;
      disk_used_gb: number | null;
      disk_total_gb: number | null;
      bandwidth_in_mbps: number | null;
      bandwidth_out_mbps: number | null;
    } | null;
    series: { cpu: SeriesPoint[]; memory: SeriesPoint[] };
  };
};

const PAGE_SIZE = 20;

const LOG_STATUS_LABEL: Record<MessageStatus, string> = {
  sent: "Enviado",
  failed: "Fallido",
  skipped: "Omitido",
};

const CONNECT_LABEL: Record<string, string> = {
  connected: "Conectado",
  waiting: "Esperando código",
  preparing: "Preparando",
  idle: "Sin vincular",
  orphan: "Huérfana",
};

const STATE_LABEL: Record<string, string> = {
  open: "Abierto",
  connected: "Abierto",
  close: "Cerrado",
  connecting: "Conectando",
};

const cpuConfig = {
  value: { label: "CPU %", color: "var(--chart-1)" },
} satisfies ChartConfig;

const memConfig = {
  value: { label: "RAM %", color: "var(--chart-2)" },
} satisfies ChartConfig;

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}

function fmtNum(n: number | null | undefined, suffix = "") {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("es", { maximumFractionDigits: 1 })}${suffix}`;
}

function chartRows(points: SeriesPoint[]) {
  return points.map((p) => ({
    ...p,
    label: new Date(p.ts * 1000).toLocaleTimeString("es", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));
}

function instanceTitle(row: InstanceRow) {
  return row.business_name || row.instance || "Instancia";
}

function connectionIssue(row: InstanceRow): string | null {
  if (row.connect_status === "orphan") {
    return "Existe en Evolution pero no está ligada a un negocio en Reiz.";
  }
  if (row.in_reiz && !row.in_evolution) {
    return "Está en Reiz pero no aparece en el servidor Evolution.";
  }
  if (row.connect_status === "waiting") {
    return "Pidió el código de vinculación y todavía no conectó el WhatsApp.";
  }
  if (row.connect_status === "preparing") {
    return "La instancia se está creando o reiniciando.";
  }
  if (row.connect_status === "idle") {
    return "No hay un WhatsApp vinculado.";
  }
  if (row.evolution_state === "close") {
    return "El socket de WhatsApp está cerrado. Hay que volver a conectar el número.";
  }
  return null;
}

export default function EvolutionOpsPage() {
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } =
    useQuery({
      queryKey: ["staff-evolution-ops"],
      queryFn: () =>
        apiJson<OpsPayload>("/api/notifications/staff/evolution-ops/"),
      refetchInterval: 30_000,
    });
  const [selected, setSelected] = React.useState<InstanceRow | null>(null);
  const [openFilter, setOpenFilter] = React.useState<MessageFilter>("all");
  const [confirmClose, setConfirmClose] = React.useState(false);

  function openInstance(row: InstanceRow, filter: MessageFilter = "all") {
    setOpenFilter(filter);
    setConfirmClose(false);
    setSelected(row);
  }

  const disconnectMutation = useMutation({
    mutationFn: (row: InstanceRow) =>
      apiJson<{ detail: string }>(
        "/api/notifications/staff/evolution-ops/disconnect/",
        {
          method: "POST",
          body: JSON.stringify({
            business_id: row.business_id,
            instance: row.instance,
          }),
        }
      ),
    onSuccess: (payload) => {
      toast.success(payload.detail || "Conexión cerrada");
      setConfirmClose(false);
      setSelected(null);
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canDisconnect = Boolean(
    selected &&
      (selected.instance ||
        (selected.business_id && selected.connect_status !== "idle"))
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72 max-w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[148px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No se pudo cargar Evolution / DigitalOcean</CardTitle>
          <CardDescription>
            {error instanceof Error
              ? error.message
              : "Comprueba que el usuario sea staff y que el backend esté vivo."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { evolution, digitalocean } = data;
  const droplet = digitalocean.droplet;
  const metrics = digitalocean.metrics;
  const cpuRows = chartRows(digitalocean.series.cpu);
  const memRows = chartRows(digitalocean.series.memory);
  const failedInstances = evolution.instances.filter((row) => row.failed_24h > 0);
  const totalFailed = failedInstances.reduce((sum, row) => sum + row.failed_24h, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-foreground/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Infraestructura
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            WhatsApp Evolution
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Instancias conectadas al Evolution API y salud del droplet en
            DigitalOcean. Se actualiza cada 30 s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            {dataUpdatedAt
              ? `Actualizado ${new Date(dataUpdatedAt).toLocaleTimeString("es")}`
              : null}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            Actualizar
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiStatCard
          title="Instancias"
          subtitle="En Reiz + Evolution"
          icon={MessageCircle}
          value={evolution.instance_count.toLocaleString("es")}
        />
        <KpiStatCard
          title="Socket abierto"
          subtitle="Estado live en Evolution"
          icon={Wifi}
          value={evolution.open_count.toLocaleString("es")}
        />
        <KpiStatCard
          title="CPU droplet"
          subtitle="Última muestra"
          icon={Cpu}
          value={fmtNum(metrics?.cpu_percent, "%")}
        />
        <KpiStatCard
          title="RAM droplet"
          subtitle={
            metrics?.memory_used_mb != null
              ? `${fmtNum(metrics.memory_used_mb)} / ${fmtNum(metrics.memory_total_mb)} MB`
              : "Última muestra"
          }
          icon={Activity}
          value={fmtNum(metrics?.memory_percent, "%")}
        />
      </section>

      {!evolution.configured || !evolution.reachable ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Evolution no responde</CardTitle>
            <CardDescription>
              {evolution.error || "Revisa EVOLUTION_API_URL y que el droplet esté arriba."}
              {evolution.api_url ? ` URL: ${evolution.api_url}` : ""}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {totalFailed > 0 ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>
              {totalFailed === 1
                ? "1 mensaje no salió en las últimas 24 h"
                : `${totalFailed} mensajes no salieron en las últimas 24 h`}
            </CardTitle>
            <CardDescription>
              Pulsa un negocio para ver el historial. Reenviar usa el WhatsApp
              del salón si está conectado; si no, el de Reiz.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {failedInstances.map((row) => {
              const preview = (row.recent_failures ?? []).slice(0, 5);
              const extra = Math.max(0, row.failed_24h - preview.length);
              return (
                <div
                  key={`${row.instance}-${row.business_id ?? "x"}-fail`}
                  className="rounded-lg border border-destructive/20 bg-destructive/5"
                >
                  <button
                    type="button"
                    onClick={() => openInstance(row, "failed")}
                    className="w-full px-3 py-3 text-left transition hover:bg-destructive/10"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium">{instanceTitle(row)}</p>
                      <p className="text-destructive text-xs font-medium">
                        {row.failed_24h === 1
                          ? "1 fallo"
                          : `${row.failed_24h} fallos`}
                      </p>
                    </div>
                  </button>
                  {preview.length > 0 ? (
                    <ul className="space-y-2 border-t border-destructive/10 px-3 py-2">
                      {preview.map((fail) => (
                        <li
                          key={fail.id}
                          className="flex flex-wrap items-start justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-muted-foreground text-xs">
                              {fail.template_label}
                              {fail.recipient_name || fail.recipient_phone
                                ? ` → ${[fail.recipient_name, fail.recipient_phone]
                                    .filter(Boolean)
                                    .join(" · ")}`
                                : null}
                              {fail.created_at
                                ? ` · ${fmtWhen(fail.created_at)}`
                                : null}
                            </p>
                            <p className="text-destructive mt-0.5 text-sm leading-snug">
                              {fail.error_message}
                            </p>
                          </div>
                          {row.business_id && fail.can_retry ? (
                            <RetryMessageButton
                              logId={fail.id}
                              businessId={row.business_id}
                            />
                          ) : null}
                        </li>
                      ))}
                      {extra > 0 ? (
                        <li>
                          <button
                            type="button"
                            className="text-muted-foreground text-xs hover:underline"
                            onClick={() => openInstance(row, "failed")}
                          >
                            Ver {extra === 1 ? "1 fallo más" : `${extra} fallos más`}
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                  {row.business_id ? (
                    <div className="border-t border-destructive/10 px-3 py-2">
                      <RetryBusinessButton
                        businessId={row.business_id}
                        failedCount={row.failed_24h}
                        hours={24}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Números conectados</CardTitle>
          <CardDescription>
            Combina lo guardado en Reiz con el estado live de Evolution. Pulsa
            una fila para ver todos los mensajes; en Fallos 24 h ves el motivo.
            Las huérfanas existen en el servidor y no en un negocio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {evolution.instances.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Todavía no hay instancias Evolution.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Instancia</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Reiz</TableHead>
                  <TableHead>Evolution</TableHead>
                  <TableHead>24 h</TableHead>
                  <TableHead>7 d</TableHead>
                  <TableHead>Fallos 24 h</TableHead>
                  <TableHead>Último envío</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evolution.instances.map((row) => {
                  const issue = connectionIssue(row);
                  const lastFail = (row.recent_failures ?? [])[0];
                  return (
                  <TableRow
                    key={`${row.instance}-${row.business_id ?? "x"}`}
                    className="cursor-pointer"
                    onClick={() => openInstance(row)}
                  >
                    <TableCell>
                      {row.business_id ? (
                        <div className="min-w-40">
                          <Link
                            href={`/dashboard/negocios/${row.business_id}`}
                            className="font-medium hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {row.business_name || `Negocio ${row.business_id}`}
                          </Link>
                          <p className="text-muted-foreground text-xs">
                            {row.owner_email || "—"}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Sin negocio</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.instance || "—"}
                    </TableCell>
                    <TableCell>
                      <div>
                        {row.phone || "—"}
                        {row.profile_name ? (
                          <p className="text-muted-foreground text-xs">
                            {row.profile_name}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.connect_status === "connected"
                            ? "default"
                            : row.connect_status === "orphan"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {CONNECT_LABEL[row.connect_status] ?? row.connect_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant={
                            row.evolution_state === "open" ||
                            row.evolution_state === "connected"
                              ? "default"
                              : "outline"
                          }
                        >
                          {STATE_LABEL[row.evolution_state] ||
                            row.evolution_state ||
                            "Sin dato"}
                        </Badge>
                        {issue ? (
                          <span className="text-destructive max-w-40 text-[11px] leading-snug">
                            {issue}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{row.sent_24h}</TableCell>
                    <TableCell className="tabular-nums">{row.sent_7d}</TableCell>
                    <TableCell
                      className={cn(
                        "max-w-48",
                        row.failed_24h > 0 && "cursor-pointer text-destructive"
                      )}
                      onClick={(event) => {
                        if (row.failed_24h > 0) {
                          event.stopPropagation();
                          openInstance(row, "failed");
                        }
                      }}
                    >
                      <p
                        className={cn(
                          "tabular-nums font-medium",
                          row.failed_24h > 0 && "underline-offset-2 hover:underline"
                        )}
                      >
                        {row.failed_24h}
                      </p>
                      {lastFail ? (
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug">
                          {lastFail.error_message}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmtWhen(row.last_sent_at)}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="size-4" />
              Droplet
            </CardTitle>
            <CardDescription>
              {digitalocean.configured
                ? "Datos de DigitalOcean (última hora)."
                : "Falta DIGITALOCEAN_TOKEN en Render."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {digitalocean.error ? (
              <p className="text-destructive">{digitalocean.error}</p>
            ) : null}
            {droplet ? (
              <>
                <Row label="Nombre" value={droplet.name} />
                <Row
                  label="Estado"
                  value={
                    droplet.status === "active" ? "Activo" : droplet.status
                  }
                />
                <Row label="IP" value={droplet.ip || "—"} />
                <Row label="Región" value={droplet.region.toUpperCase()} />
                <Row
                  label="Plan"
                  value={`${droplet.vcpus} vCPU · ${droplet.memory_mb} MB · ${droplet.disk_gb} GB`}
                />
                <Row label="Imagen" value={droplet.image} />
                <Row
                  label="Costo"
                  value={
                    droplet.price_monthly != null
                      ? `US$ ${droplet.price_monthly}/mes`
                      : "—"
                  }
                />
                <Row
                  label="Monitoring"
                  value={droplet.monitoring ? "Activo" : "Inactivo"}
                />
                <Row label="Creado" value={fmtWhen(droplet.created_at)} />
                <Row
                  label="Disco"
                  value={
                    metrics?.disk_used_gb != null
                      ? `${fmtNum(metrics.disk_used_gb)} / ${fmtNum(metrics.disk_total_gb)} GB (${fmtNum(metrics.disk_percent, "%")})`
                      : "—"
                  }
                />
                <Row label="Load 1m" value={fmtNum(metrics?.load_1)} />
                <Row
                  label="Ancho de banda"
                  value={`↓ ${fmtNum(metrics?.bandwidth_in_mbps, " Mbps")} · ↑ ${fmtNum(metrics?.bandwidth_out_mbps, " Mbps")}`}
                />
              </>
            ) : digitalocean.configured ? null : (
              <p className="text-muted-foreground">
                Crea un token de solo lectura en DigitalOcean → API y pégalo en
                Render como DIGITALOCEAN_TOKEN. Opcional: DIGITALOCEAN_DROPLET_ID.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="size-4" />
              CPU (1 h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cpuRows.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Sin serie de CPU. Activa Monitoring en el droplet.
              </p>
            ) : (
              <ChartContainer config={cpuConfig} className="aspect-[16/9]">
                <AreaChart data={cpuRows}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    dataKey="value"
                    type="monotone"
                    fill="var(--color-value)"
                    fillOpacity={0.2}
                    stroke="var(--color-value)"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="size-4" />
              RAM (1 h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {memRows.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Sin serie de memoria.
              </p>
            ) : (
              <ChartContainer config={memConfig} className="aspect-[16/9]">
                <AreaChart data={memRows}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    dataKey="value"
                    type="monotone"
                    fill="var(--color-value)"
                    fillOpacity={0.2}
                    stroke="var(--color-value)"
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <Sheet
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setConfirmClose(false);
          }
        }}
      >
        <SheetContent
          side="right"
          className="data-[side=right]:sm:max-w-xl overflow-y-auto"
        >
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{instanceTitle(selected)}</SheetTitle>
                <SheetDescription>
                  {selected.instance || "Sin instancia"}
                  {selected.phone ? ` · ${selected.phone}` : ""}
                  {selected.owner_email ? ` · ${selected.owner_email}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-6">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                    Conexión
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={
                        selected.connect_status === "connected"
                          ? "default"
                          : selected.connect_status === "orphan"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {CONNECT_LABEL[selected.connect_status] ??
                        selected.connect_status}
                    </Badge>
                    <Badge
                      variant={
                        selected.evolution_state === "open" ||
                        selected.evolution_state === "connected"
                          ? "default"
                          : "outline"
                      }
                    >
                      {STATE_LABEL[selected.evolution_state] ||
                        selected.evolution_state ||
                        "Sin dato"}
                    </Badge>
                  </div>
                  {connectionIssue(selected) ? (
                    <p className="text-destructive text-sm leading-snug">
                      {connectionIssue(selected)}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Socket abierto y vinculado en Reiz.
                    </p>
                  )}
                  {selected.pairing_code ? (
                    <p className="text-xs">
                      Código de vinculación:{" "}
                      <span className="font-mono">{selected.pairing_code}</span>
                    </p>
                  ) : null}
                  {canDisconnect && !confirmClose ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="mt-2"
                      onClick={() => setConfirmClose(true)}
                    >
                      <Unplug className="size-3.5" />
                      Cerrar conexión
                    </Button>
                  ) : null}
                  {canDisconnect && confirmClose ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-3">
                      <p className="text-sm leading-snug">
                        {selected.business_id
                          ? "Esto cierra el WhatsApp en Evolution y lo desvincula del negocio. El dueño tendrá que volver a conectar el número."
                          : "Esto elimina la instancia huérfana del servidor Evolution."}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={disconnectMutation.isPending}
                          onClick={() => setConfirmClose(false)}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={disconnectMutation.isPending}
                          onClick={() => disconnectMutation.mutate(selected)}
                        >
                          {disconnectMutation.isPending
                            ? "Cerrando…"
                            : "Sí, cerrar"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Enviados 24 h</p>
                    <p className="font-medium tabular-nums">{selected.sent_24h}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Enviados 7 d</p>
                    <p className="font-medium tabular-nums">{selected.sent_7d}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Fallos 24 h</p>
                    <p
                      className={cn(
                        "font-medium tabular-nums",
                        selected.failed_24h > 0 && "text-destructive"
                      )}
                    >
                      {selected.failed_24h}
                    </p>
                  </div>
                </div>

                {selected.business_id ? (
                  <InstanceMessages
                    key={`${selected.business_id}-${openFilter}`}
                    businessId={selected.business_id}
                    initialStatus={openFilter}
                    failedCount={selected.failed_24h}
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Esta instancia no está ligada a un negocio, así que no hay
                    historial de mensajes en Reiz.
                  </p>
                )}

                {selected.business_id ? (
                  <Link
                    href={`/dashboard/negocios/${selected.business_id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    Ver negocio
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-foreground/5 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function InstanceMessages({
  businessId,
  initialStatus,
  failedCount,
}: {
  businessId: number;
  initialStatus: MessageFilter;
  failedCount: number;
}) {
  const [status, setStatus] = React.useState<MessageFilter>(initialStatus);
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [status]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-evolution-messages", businessId, status, page],
    queryFn: () => {
      const params = new URLSearchParams({
        business_id: String(businessId),
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (status !== "all") params.set("status", status);
      return apiJson<MessagesPayload>(
        `/api/notifications/staff/evolution-ops/messages/?${params.toString()}`
      );
    },
    placeholderData: keepPreviousData,
  });

  const counts = data?.counts ?? { all: 0, sent: 0, failed: 0, skipped: 0 };
  const from = data && data.results.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = data ? (page - 1) * PAGE_SIZE + data.results.length : 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;
  const filters: { id: MessageFilter; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: counts.all },
    { id: "failed", label: "Fallidos", count: counts.failed },
    { id: "sent", label: "Enviados", count: counts.sent },
    { id: "skipped", label: "Omitidos", count: counts.skipped },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Mensajes
        </p>
        {counts.failed > 0 || failedCount > 0 ? (
          <RetryBusinessButton
            businessId={businessId}
            failedCount={counts.failed || failedCount}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {filters.map((filter) => (
          <Button
            key={filter.id}
            type="button"
            size="xs"
            variant={status === filter.id ? "default" : "outline"}
            onClick={() => setStatus(filter.id)}
          >
            {filter.label}
            <span className="tabular-nums opacity-80">{filter.count}</span>
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : error || !data ? (
        <p className="text-destructive text-sm">
          {error instanceof Error
            ? error.message
            : "No se pudo cargar el historial."}
        </p>
      ) : data.results.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {status === "failed"
            ? "No hay envíos fallidos."
            : "Todavía no hay mensajes para este negocio."}
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {data.results.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "rounded-lg border px-3 py-3",
                  row.status === "failed"
                    ? "border-destructive/20 bg-destructive/5"
                    : "border-foreground/10"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium">{row.template_label}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={
                        row.status === "failed"
                          ? "destructive"
                          : row.status === "sent"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {LOG_STATUS_LABEL[row.status]}
                    </Badge>
                    {row.status === "failed" && row.can_retry ? (
                      <RetryMessageButton
                        logId={row.id}
                        businessId={businessId}
                      />
                    ) : null}
                  </div>
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {[row.recipient_name, row.recipient_phone]
                    .filter(Boolean)
                    .join(" · ") || "Sin destinatario"}
                  {row.created_at ? ` · ${fmtWhen(row.created_at)}` : ""}
                </p>
                {row.status === "failed" && row.error_message ? (
                  <p className="text-destructive mt-2 text-sm leading-snug">
                    {row.error_message}
                  </p>
                ) : null}
                {row.body_preview ? (
                  <p className="text-muted-foreground mt-2 line-clamp-3 text-xs">
                    {row.body_preview}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-muted-foreground text-xs tabular-nums">
              {from}–{to} de {data.count}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-3.5" />
                Anterior
              </Button>
              <span className="text-muted-foreground px-1 text-xs tabular-nums">
                {page}/{totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={!data.next}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
