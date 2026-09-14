"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  HardDrive,
  Info,
  MessageCircle,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Server,
  Settings2,
  Stethoscope,
  Unplug,
  Webhook,
  Wifi,
  Wrench,
  Zap,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConnectPlatformEvolutionCard } from "@/components/connect-platform-evolution-card";
import type { PlatformChannel } from "@/components/connect-platform-evolution-card";
import {
  RetryBusinessButton,
  RetryMessageButton,
  SkipInvalidBusinessButton,
  SkipMessageButton,
} from "@/components/whatsapp-failed-retry";
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
  can_skip?: boolean;
  /** "lost" = recordatorio que se pasó de hora sin salir, no un fallo del proveedor. */
  kind?: string;
};

type MessageRow = FailureRow & {
  body: string;
  sent_at: string | null;
  status: MessageStatus;
  direction: string;
  can_retry?: boolean;
  can_skip?: boolean;
};

type MessagesPayload = Paginated<MessageRow> & {
  counts: { all: number; sent: number; failed: number; skipped: number };
};

type QuotaInfo = {
  channel_key: string;
  exists: boolean;
  paused: boolean;
  paused_until?: string | null;
  pause_reason?: string;
  warmup_day: number | null;
  daily_cap: number;
  hourly_cap: number;
  sent_today: number;
  sent_this_hour: number;
  deferred_count?: number;
  hourly_full?: boolean;
  daily_full?: boolean;
  next_available_at?: string | null;
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
  needs_repair?: boolean;
  disconnect_reason?: number | null;
  disconnect_at?: string | null;
  sent_24h: number;
  sent_7d: number;
  failed_24h: number;
  lost_24h: number;
  last_sent_at: string | null;
  recent_failures?: FailureRow[];
  quota?: QuotaInfo | null;
};

type SnapshotPayload = {
  instance: string;
  state: string | null;
  state_error: string | null;
  disconnect_reason: number | null;
  disconnect_at: string | null;
  needs_repair: boolean;
  webhook: {
    ok: boolean;
    error: string;
    url: string;
    enabled: boolean;
    expected_url: string;
    matches: boolean;
  };
  settings: {
    ok: boolean;
    error: string;
    alwaysOnline?: boolean;
    syncFullHistory?: boolean;
    readMessages?: boolean;
    readStatus?: boolean;
    rejectCall?: boolean;
    groupsIgnore?: boolean;
  };
  quota: QuotaInfo | null;
};

type DiagCheck = {
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
};

type DiagResult = {
  instance: string;
  overall: "ok" | "warn" | "error";
  checks: DiagCheck[];
  live: { state: string | null; disconnect_reason: number | null; needs_repair: boolean };
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
    platform?: PlatformChannel | null;
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

function fmtClock(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("es", { hour: "numeric", minute: "2-digit" });
}

function fmtRemaining(iso: string, now = Date.now()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const sec = Math.max(0, Math.round((d.getTime() - now) / 1000));
  if (sec < 60) return sec <= 1 ? "en 1 segundo" : `en ${sec} segundos`;
  const minutes = Math.floor(sec / 60);
  if (minutes < 60) return minutes === 1 ? "en 1 minuto" : `en ${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return hours === 1 ? "en 1 hora" : `en ${hours} horas`;
  const hourLabel = hours === 1 ? "1 hora" : `${hours} horas`;
  const minLabel = rest === 1 ? "1 minuto" : `${rest} minutos`;
  return `en ${hourLabel} y ${minLabel}`;
}

function fmtAgo(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const sec = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "hace un momento";
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    return m === 1 ? "hace 1 min" : `hace ${m} min`;
  }
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    return h === 1 ? "hace 1 h" : `hace ${h} h`;
  }
  const days = Math.floor(sec / 86400);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
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
  if (row.needs_repair || row.disconnect_reason === 401) {
    return "WhatsApp invalidó la sesión (401). Hay que volver a vincular el número; no basta con reconectar en Reiz.";
  }
  if (row.evolution_state === "close") {
    return "El socket de WhatsApp está cerrado. Hay que volver a conectar el número.";
  }
  return null;
}

export default function EvolutionOpsPage() {
  const queryClient = useQueryClient();
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
  const [liveState, setLiveState] = React.useState<Record<string, string>>({});
  // probe state
  const [probePhone, setProbePhone] = React.useState("");
  const [probeBody, setProbeBody] = React.useState("");
  // diag state
  const [diagResult, setDiagResult] = React.useState<DiagResult | null>(null);
  // filter
  const [filterSearch, setFilterSearch] = React.useState("");
  const [filterState, setFilterState] = React.useState<"all" | "healthy" | "error">("all");

  function openInstance(row: InstanceRow, filter: MessageFilter = "all") {
    setOpenFilter(filter);
    setConfirmClose(false);
    setSelected(row);
    setProbePhone("");
    setProbeBody("");
    setDiagResult(null);
  }

  function staffPost<T>(path: string, body: object) {
    return apiJson<T & { detail?: string }>(`/api/notifications/staff/evolution-ops/${path}/`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  const disconnectMutation = useMutation({
    mutationFn: (row: InstanceRow) =>
      staffPost<{ detail: string }>("disconnect", {
        business_id: row.business_id,
        instance: row.instance,
      }),
    onSuccess: (payload) => {
      toast.success(payload.detail || "Conexión cerrada");
      setConfirmClose(false);
      setSelected(null);
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const restartMutation = useMutation({
    mutationFn: (row: InstanceRow) =>
      staffPost<{ detail: string }>("restart", {
        business_id: row.business_id,
        instance: row.instance,
      }),
    onSuccess: (payload) => {
      toast.success(payload.detail || "Socket reiniciado");
      void queryClient.invalidateQueries({ queryKey: ["staff-evolution-snapshot"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const repairMutation = useMutation({
    mutationFn: (row: InstanceRow) =>
      staffPost<{ detail: string; pairing_code?: string }>("repair", {
        business_id: row.business_id,
      }),
    onSuccess: (payload) => {
      toast.success(payload.detail || "Re-vinculación iniciada");
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const webhookMutation = useMutation({
    mutationFn: (row: InstanceRow) =>
      staffPost<{ detail: string; webhook_url?: string }>("set-webhook", {
        business_id: row.business_id,
        instance: row.instance,
      }),
    onSuccess: (payload) => {
      toast.success(payload.detail || "Webhook actualizado");
      void queryClient.invalidateQueries({ queryKey: ["staff-evolution-snapshot"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const settingsMutation = useMutation({
    mutationFn: (row: InstanceRow) =>
      staffPost<{ detail: string }>("set-settings", {
        business_id: row.business_id,
        instance: row.instance,
      }),
    onSuccess: (payload) => {
      toast.success(payload.detail || "Settings aplicados");
      void queryClient.invalidateQueries({ queryKey: ["staff-evolution-snapshot"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const probeMutation = useMutation({
    mutationFn: ({ row, phone, body }: { row: InstanceRow; phone: string; body: string }) =>
      staffPost<{ detail: string }>("send-probe", {
        business_id: row.business_id,
        instance: row.instance,
        phone,
        body,
      }),
    onSuccess: (payload) => toast.success(payload.detail || "Mensaje enviado"),
    onError: (err: Error) => toast.error(err.message),
  });

  const diagnoseMutation = useMutation({
    mutationFn: (row: InstanceRow) =>
      staffPost<DiagResult>("diagnose", {
        business_id: row.business_id,
        instance: row.instance,
      }),
    onSuccess: (payload) => setDiagResult(payload),
    onError: (err: Error) => toast.error(err.message),
  });

  const healAllMutation = useMutation({
    mutationFn: () =>
      staffPost<{ detail: string; stats: Record<string, number> }>("heal-all", {}),
    onSuccess: (payload) => {
      toast.success(payload.detail || "Heal-all completado");
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pauseMutation = useMutation({
    mutationFn: ({
      row,
      hours,
    }: {
      row: InstanceRow;
      hours: number;
    }) =>
      staffPost<{ detail: string; quota: QuotaInfo }>("pause-channel", {
        business_id: row.business_id,
        hours,
      }),
    onSuccess: (payload) => {
      toast.success(payload.detail || "Canal pausado");
      void queryClient.invalidateQueries({ queryKey: ["staff-evolution-snapshot"] });
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unpauseMutation = useMutation({
    mutationFn: (row: InstanceRow) =>
      staffPost<{ detail: string; quota: QuotaInfo }>("unpause-channel", {
        business_id: row.business_id,
      }),
    onSuccess: (payload) => {
      toast.success(payload.detail || "Pausa levantada");
      void queryClient.invalidateQueries({ queryKey: ["staff-evolution-snapshot"] });
      void refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const snapshotQuery = useQuery({
    queryKey: [
      "staff-evolution-snapshot",
      selected?.instance,
      selected?.business_id,
    ],
    queryFn: () =>
      staffPost<SnapshotPayload>("snapshot", {
        business_id: selected?.business_id,
        instance: selected?.instance,
      }),
    enabled: Boolean(
      selected && (selected.instance || selected.business_id)
    ),
  });

  React.useEffect(() => {
    if (!selected?.instance || !snapshotQuery.data?.state) return;
    setLiveState((prev) => ({
      ...prev,
      [selected.instance]: snapshotQuery.data.state as string,
    }));
  }, [selected?.instance, snapshotQuery.data?.state]);

  // Live ping por fila
  async function pingRow(row: InstanceRow, silent = false) {
    try {
      const res = await staffPost<{ state: string }>("connection-state", {
        business_id: row.business_id,
        instance: row.instance,
      });
      setLiveState((prev) => ({ ...prev, [row.instance]: res.state ?? "?" }));
      if (!silent) toast.info(`${row.instance}: ${res.state ?? "?"}`);
    } catch {
      if (!silent) toast.error("No se pudo consultar el estado");
    }
  }

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
  const failedInstances = evolution.instances.filter(
    (row) => row.failed_24h + (row.lost_24h ?? 0) > 0,
  );
  const totalFailed = failedInstances.reduce(
    (sum, row) => sum + row.failed_24h + (row.lost_24h ?? 0),
    0,
  );

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
        <div className="flex flex-wrap items-center gap-2">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => healAllMutation.mutate()}
            disabled={healAllMutation.isPending}
          >
            <Zap className="size-3.5" />
            {healAllMutation.isPending ? "Reparando…" : "Heal-All"}
          </Button>
        </div>
      </header>

      <ConnectPlatformEvolutionCard initial={evolution.platform} />

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
              Los fallos los rechazó WhatsApp y se pueden reenviar. Los marcados
              como sin enviar son recordatorios que se pasaron de hora porque el
              canal estaba en su tope: ya no se reenvían. Pulsa un negocio para
              ver el historial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {failedInstances.map((row) => {
              const preview = (row.recent_failures ?? []).slice(0, 5);
              const lost = row.lost_24h ?? 0;
              const total = row.failed_24h + lost;
              const extra = Math.max(0, total - preview.length);
              const countLabel = [
                row.failed_24h > 0
                  ? row.failed_24h === 1
                    ? "1 fallo"
                    : `${row.failed_24h} fallos`
                  : "",
                lost > 0 ? (lost === 1 ? "1 sin enviar" : `${lost} sin enviar`) : "",
              ]
                .filter(Boolean)
                .join(" · ");
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
                        {countLabel}
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
                              {fail.kind === "lost" ? (
                                <span className="mr-1 rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-500">
                                  Sin enviar
                                </span>
                              ) : null}
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
                            <p
                              className={`mt-0.5 text-sm leading-snug ${
                                fail.kind === "lost"
                                  ? "text-amber-700 dark:text-amber-500"
                                  : "text-destructive"
                              }`}
                            >
                              {fail.error_message}
                            </p>
                          </div>
                          {row.business_id && (fail.can_retry || fail.can_skip) ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {fail.can_retry ? (
                                <RetryMessageButton
                                  logId={fail.id}
                                  businessId={row.business_id}
                                />
                              ) : null}
                              {fail.can_skip ? (
                                <SkipMessageButton
                                  logId={fail.id}
                                  businessId={row.business_id}
                                />
                              ) : null}
                            </div>
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
                            Ver {extra === 1 ? "1 más" : `${extra} más`}
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                  {row.business_id && row.failed_24h > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-destructive/10 px-3 py-2">
                      <RetryBusinessButton
                        businessId={row.business_id}
                        failedCount={row.failed_24h}
                        hours={24}
                      />
                      <SkipInvalidBusinessButton
                        businessId={row.business_id}
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Números conectados</CardTitle>
              <CardDescription>
                Combina lo guardado en Reiz con el estado live de Evolution. Pulsa
                una fila para ver todos los mensajes; en Fallos 24 h ves el motivo.
                Las huérfanas existen en el servidor y no en un negocio.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                className="h-8 w-48 text-sm"
                placeholder="Buscar negocio…"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
              {(["all", "healthy", "error"] as const).map((f) => (
                <Button
                  key={f}
                  type="button"
                  size="sm"
                  variant={filterState === f ? "default" : "outline"}
                  onClick={() => setFilterState(f)}
                >
                  {f === "all" ? "Todas" : f === "healthy" ? "Sanas" : "Con error"}
                </Button>
              ))}
            </div>
          </div>
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
                  <TableHead>Activo</TableHead>
                  <TableHead>24 h</TableHead>
                  <TableHead>7 d</TableHead>
                  <TableHead>Fallos 24 h</TableHead>
                  <TableHead>Último envío</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evolution.instances
                  .filter((row) => {
                    if (filterSearch) {
                      const q = filterSearch.toLowerCase();
                      if (
                        !row.business_name.toLowerCase().includes(q) &&
                        !row.instance.toLowerCase().includes(q) &&
                        !(row.phone || "").includes(q) &&
                        !(row.owner_email || "").toLowerCase().includes(q)
                      ) return false;
                    }
                    if (filterState === "healthy") return row.healthy;
                    if (filterState === "error") return !row.healthy;
                    return true;
                  })
                  .map((row) => {
                  const issue = connectionIssue(row);
                  const lastFail = (row.recent_failures ?? [])[0];
                  const liveSt = liveState[row.instance];
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
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            variant={
                              row.evolution_state === "open" ||
                              row.evolution_state === "connected"
                                ? "default"
                                : "outline"
                            }
                          >
                            {liveSt
                              ? STATE_LABEL[liveSt] || liveSt
                              : STATE_LABEL[row.evolution_state] ||
                                row.evolution_state ||
                                "Sin dato"}
                          </Badge>
                          {row.needs_repair ? (
                            <Badge variant="destructive" className="text-[10px]">
                              401
                            </Badge>
                          ) : null}
                          <button
                            type="button"
                            title="Ping estado live"
                            onClick={(e) => { e.stopPropagation(); void pingRow(row); }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Zap className="size-3" />
                          </button>
                        </div>
                        {issue ? (
                          <span className="text-destructive max-w-40 text-[11px] leading-snug">
                            {issue}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {row.quota?.paused ? (
                        <Badge variant="secondary" className="mb-1 text-[10px]">
                          Pausado
                        </Badge>
                      ) : null}
                      {fmtAgo(row.connected_at) || "—"}
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
                        (snapshotQuery.data?.state ||
                          liveState[selected.instance] ||
                          selected.evolution_state) === "open" ||
                        (snapshotQuery.data?.state ||
                          liveState[selected.instance] ||
                          selected.evolution_state) === "connected"
                          ? "default"
                          : "outline"
                      }
                    >
                      {snapshotQuery.isFetching
                        ? "Consultando…"
                        : STATE_LABEL[
                            snapshotQuery.data?.state ||
                              liveState[selected.instance] ||
                              selected.evolution_state
                          ] ||
                          snapshotQuery.data?.state ||
                          liveState[selected.instance] ||
                          selected.evolution_state ||
                          "Sin dato"}
                    </Badge>
                    {selected.quota?.paused || snapshotQuery.data?.quota?.paused ? (
                      <Badge variant="secondary">Canal pausado</Badge>
                    ) : null}
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
                  {fmtAgo(selected.connected_at) ? (
                    <p className="text-muted-foreground text-xs">
                      Vinculado {fmtAgo(selected.connected_at)}
                      {selected.connected_at
                        ? ` · ${fmtWhen(selected.connected_at)}`
                        : ""}
                    </p>
                  ) : null}
                  {snapshotQuery.data?.state_error ? (
                    <p className="text-destructive text-sm">
                      {snapshotQuery.data.state_error}
                    </p>
                  ) : null}
                  {/* Actions row */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {/* Restart socket */}
                    {selected.in_evolution && !selected.needs_repair ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={restartMutation.isPending}
                        onClick={() => restartMutation.mutate(selected)}
                      >
                        <RotateCcw className="size-3.5" />
                        {restartMutation.isPending ? "Reiniciando…" : "Restart socket"}
                      </Button>
                    ) : null}

                    {/* Repair (re-pairing) */}
                    {selected.needs_repair && selected.business_id ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={repairMutation.isPending}
                        onClick={() => repairMutation.mutate(selected)}
                      >
                        <Wrench className="size-3.5" />
                        {repairMutation.isPending ? "Re-vinculando…" : "Re-vincular"}
                      </Button>
                    ) : null}

                    {/* Set webhook */}
                    {selected.in_evolution ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={webhookMutation.isPending}
                        onClick={() => webhookMutation.mutate(selected)}
                      >
                        <Webhook className="size-3.5" />
                        {webhookMutation.isPending ? "Aplicando…" : "Webhook"}
                      </Button>
                    ) : null}

                    {/* Set settings */}
                    {selected.in_evolution ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={settingsMutation.isPending}
                        onClick={() => settingsMutation.mutate(selected)}
                      >
                        <Settings2 className="size-3.5" />
                        {settingsMutation.isPending ? "Aplicando…" : "Settings"}
                      </Button>
                    ) : null}

                    {/* Diagnose */}
                    {selected.in_evolution ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={diagnoseMutation.isPending}
                        onClick={() => diagnoseMutation.mutate(selected)}
                      >
                        <Stethoscope className="size-3.5" />
                        {diagnoseMutation.isPending ? "Diagnosticando…" : "Diagnóstico"}
                      </Button>
                    ) : null}

                    {/* Close / disconnect */}
                    {canDisconnect && !confirmClose ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmClose(true)}
                      >
                        <Unplug className="size-3.5" />
                        Cerrar conexión
                      </Button>
                    ) : null}
                  </div>

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

                {/* Diagnose result */}
                {diagResult ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                      Diagnóstico
                    </p>
                    <div
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm",
                        diagResult.overall === "ok"
                          ? "border-green-500/30 bg-green-500/5"
                          : diagResult.overall === "warn"
                            ? "border-amber-500/30 bg-amber-500/5"
                            : "border-destructive/30 bg-destructive/5"
                      )}
                    >
                      <ul className="space-y-1.5">
                        {diagResult.checks.map((c) => (
                          <li key={c.label} className="flex gap-2">
                            {c.status === "ok" ? (
                              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-green-600" />
                            ) : c.status === "warn" ? (
                              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                            ) : (
                              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                            )}
                            <div>
                              <p className="font-medium">{c.label}</p>
                              <p className="text-muted-foreground text-xs whitespace-pre-line">{c.detail}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}

                <InstanceLiveDetails
                  row={selected}
                  snapshot={snapshotQuery.data}
                  loading={snapshotQuery.isFetching}
                  pausePending={pauseMutation.isPending}
                  unpausePending={unpauseMutation.isPending}
                  onPause={(hours) =>
                    pauseMutation.mutate({ row: selected, hours })
                  }
                  onUnpause={() => unpauseMutation.mutate(selected)}
                />

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

                {/* Send probe form */}
                {selected.in_evolution ? (
                  <div className="space-y-2 rounded-lg border border-foreground/10 bg-muted/30 px-3 py-3">
                    <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                      Test de envío en vivo
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="probe-phone" className="text-xs">Teléfono destino</Label>
                      <Input
                        id="probe-phone"
                        placeholder="+1 809 000 0000"
                        value={probePhone}
                        onChange={(e) => setProbePhone(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="probe-body" className="text-xs">Mensaje (opcional)</Label>
                      <Textarea
                        id="probe-body"
                        placeholder="Mensaje de prueba…"
                        value={probeBody}
                        onChange={(e) => setProbeBody(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={probeMutation.isPending || !probePhone.trim()}
                      onClick={() =>
                        probeMutation.mutate({
                          row: selected,
                          phone: probePhone,
                          body: probeBody,
                        })
                      }
                    >
                      <Send className="size-3.5" />
                      {probeMutation.isPending ? "Enviando…" : "Enviar prueba"}
                    </Button>
                  </div>
                ) : null}

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

function QuotaResumeHint({ quota }: { quota: QuotaInfo }) {
  const iso = quota.next_available_at ?? null;
  const hourlyFull = Boolean(quota.hourly_full) || quota.sent_this_hour >= quota.hourly_cap;
  const dailyFull = Boolean(quota.daily_full) || quota.sent_today >= quota.daily_cap;
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!iso || quota.paused) return undefined;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [iso, quota.paused]);

  if (quota.paused || !iso || (!hourlyFull && !dailyFull)) return null;
  const remaining = fmtRemaining(iso);
  const when = fmtClock(iso);
  const scope = dailyFull ? "del día" : "de esta hora";
  return (
    <p className="text-amber-800 dark:text-amber-400 text-xs leading-snug">
      Tope {scope} lleno. Podrás enviar de nuevo {remaining} ({when}).
    </p>
  );
}

function InstanceLiveDetails({
  row,
  snapshot,
  loading,
  pausePending,
  unpausePending,
  onPause,
  onUnpause,
}: {
  row: InstanceRow;
  snapshot: SnapshotPayload | undefined;
  loading: boolean;
  pausePending: boolean;
  unpausePending: boolean;
  onPause: (hours: number) => void;
  onUnpause: () => void;
}) {
  const quota = snapshot?.quota ?? row.quota ?? null;
  const webhook = snapshot?.webhook;
  const settings = snapshot?.settings;
  const [hours, setHours] = React.useState("24");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Webhook y settings
          {loading ? " · actualizando" : ""}
        </p>
        <div className="space-y-2 rounded-lg border border-foreground/10 px-3 py-3 text-sm">
          <Row
            label="Webhook"
            value={
              webhook
                ? webhook.ok
                  ? webhook.enabled
                    ? webhook.matches
                      ? "Activo y coincide"
                      : webhook.url || "Sin URL"
                    : "Desactivado"
                  : webhook.error || "Sin dato"
                : loading
                  ? "Consultando…"
                  : "—"
            }
          />
          {webhook?.url ? (
            <p className="text-muted-foreground break-all text-[11px] leading-snug">
              {webhook.url}
            </p>
          ) : null}
          {webhook?.expected_url && !webhook.matches ? (
            <p className="text-amber-700 dark:text-amber-500 text-[11px] leading-snug">
              Esperado: {webhook.expected_url}
            </p>
          ) : null}
          <Row
            label="alwaysOnline"
            value={
              settings?.ok
                ? settings.alwaysOnline
                  ? "Sí"
                  : "No"
                : settings?.error || (loading ? "…" : "—")
            }
          />
          <Row
            label="syncFullHistory"
            value={
              settings?.ok
                ? settings.syncFullHistory
                  ? "Sí"
                  : "No"
                : "—"
            }
          />
          <Row
            label="groupsIgnore"
            value={
              settings?.ok ? (settings.groupsIgnore ? "Sí" : "No") : "—"
            }
          />
          {snapshot?.disconnect_reason ? (
            <Row
              label="Última desconexión"
              value={`${snapshot.disconnect_reason}${
                snapshot.disconnect_at
                  ? ` · ${fmtWhen(snapshot.disconnect_at)}`
                  : ""
              }`}
            />
          ) : row.disconnect_reason ? (
            <Row
              label="Última desconexión"
              value={`${row.disconnect_reason}${
                row.disconnect_at ? ` · ${fmtWhen(row.disconnect_at)}` : ""
              }`}
            />
          ) : null}
        </div>
      </div>

      {row.business_id ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Cuota del canal
          </p>
          <div
            className={cn(
              "space-y-2 rounded-lg border px-3 py-3 text-sm",
              quota?.paused || quota?.hourly_full || quota?.daily_full
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-foreground/10"
            )}
          >
            {quota ? (
              <>
                <Row
                  label="Hoy"
                  value={`${quota.sent_today} / ${quota.daily_cap}`}
                />
                <Row
                  label="Esta hora"
                  value={`${quota.sent_this_hour} / ${quota.hourly_cap}`}
                />
                <Row
                  label="Calentamiento"
                  value={
                    quota.warmup_day
                      ? `Día ${quota.warmup_day}`
                      : "Sin rampa"
                  }
                />
                <QuotaResumeHint quota={quota} />
                {quota.paused ? (
                  <>
                    <p className="text-amber-800 dark:text-amber-400 text-xs leading-snug">
                      Pausado hasta {fmtWhen(quota.paused_until ?? null)}
                      {quota.pause_reason ? ` · ${quota.pause_reason}` : ""}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={unpausePending}
                      onClick={onUnpause}
                    >
                      <Play className="size-3.5" />
                      {unpausePending ? "Levantando…" : "Levantar pausa"}
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-wrap items-end gap-2 pt-1">
                    <div className="space-y-1">
                      <Label htmlFor="pause-hours" className="text-xs">
                        Horas
                      </Label>
                      <Input
                        id="pause-hours"
                        className="h-8 w-20 text-sm"
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pausePending}
                      onClick={() => {
                        const n = Number.parseInt(hours, 10);
                        onPause(Number.isFinite(n) && n > 0 ? Math.min(n, 168) : 24);
                      }}
                    >
                      <Pause className="size-3.5" />
                      {pausePending ? "Pausando…" : "Pausar canal"}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-xs">
                Todavía no hay cuota (se crea con el primer envío).
              </p>
            )}
          </div>
        </div>
      ) : null}
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
          <div className="flex flex-wrap items-center gap-1.5">
            <RetryBusinessButton
              businessId={businessId}
              failedCount={counts.failed || failedCount}
            />
            <SkipInvalidBusinessButton businessId={businessId} />
          </div>
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
                      {row.kind === "lost"
                        ? "Sin enviar"
                        : LOG_STATUS_LABEL[row.status]}
                    </Badge>
                    {row.status === "failed" && (row.can_retry || row.can_skip) ? (
                      <>
                        {row.can_retry ? (
                          <RetryMessageButton
                            logId={row.id}
                            businessId={businessId}
                          />
                        ) : null}
                        {row.can_skip ? (
                          <SkipMessageButton
                            logId={row.id}
                            businessId={businessId}
                          />
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {[row.recipient_name, row.recipient_phone]
                    .filter(Boolean)
                    .join(" · ") || "Sin destinatario"}
                  {row.created_at ? ` · ${fmtWhen(row.created_at)}` : ""}
                </p>
                {(row.status === "failed" || row.kind === "lost") &&
                row.error_message ? (
                  <p
                    className={cn(
                      "mt-2 text-sm leading-snug",
                      row.kind === "lost"
                        ? "text-amber-700 dark:text-amber-500"
                        : "text-destructive"
                    )}
                  >
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
