"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Activity,
  Cpu,
  HardDrive,
  MessageCircle,
  RefreshCw,
  Server,
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
import { cn } from "@/lib/utils";

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

export default function EvolutionOpsPage() {
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } =
    useQuery({
      queryKey: ["staff-evolution-ops"],
      queryFn: () =>
        apiJson<OpsPayload>("/api/notifications/staff/evolution-ops/"),
      refetchInterval: 30_000,
    });

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

      <Card>
        <CardHeader>
          <CardTitle>Números conectados</CardTitle>
          <CardDescription>
            Combina lo guardado en Reiz con el estado live de Evolution. Las
            huérfanas existen en el servidor y no en un negocio.
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
                {evolution.instances.map((row) => (
                  <TableRow key={`${row.instance}-${row.business_id ?? "x"}`}>
                    <TableCell>
                      {row.business_id ? (
                        <div className="min-w-40">
                          <Link
                            href={`/dashboard/negocios/${row.business_id}`}
                            className="font-medium hover:underline"
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
                        {!row.in_evolution && evolution.reachable ? (
                          <span className="text-destructive text-[11px]">
                            No está en Evolution
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{row.sent_24h}</TableCell>
                    <TableCell className="tabular-nums">{row.sent_7d}</TableCell>
                    <TableCell
                      className={cn(
                        "tabular-nums",
                        row.failed_24h > 0 && "text-destructive"
                      )}
                    >
                      {row.failed_24h}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmtWhen(row.last_sent_at)}
                    </TableCell>
                  </TableRow>
                ))}
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
