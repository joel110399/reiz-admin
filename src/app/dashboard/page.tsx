"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Star,
  Users,
} from "lucide-react";

import { KpiStatCard } from "@/components/dashboard/kpi-stat-card";
import { apiJson } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Summary = {
  users_total: number;
  businesses_total: number;
  businesses_active: number;
  bookings_total: number;
  bookings_by_status: Record<string, number>;
  bookings_last_days: { date: string; count: number }[];
  reviews_total: number;
  average_rating: number;
};

const areaConfig = {
  count: { label: "Reservas", color: "var(--chart-1)" },
} satisfies ChartConfig;

const STATUS_ORDER = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
};

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Últimos 7 días calendario (local), rellenando huecos en la serie del API. */
function buildLast7DaysLocal(
  series: { date: string; count: number }[]
): { date: string; count: number; short: string }[] {
  const map = new Map(series.map((s) => [s.date, s.count]));
  const out: { date: string; count: number; short: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    out.push({
      date: iso,
      count: map.get(iso) ?? 0,
      short: d.toLocaleDateString("es", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    });
  }
  return out;
}

/** Tendencia % entre la segunda mitad y la primera mitad del periodo de 7 días. */
function momentumFromSeries(counts: number[]): number | null {
  if (counts.length < 2) return null;
  const mid = Math.floor(counts.length / 2);
  const first = counts.slice(0, mid).reduce((a, b) => a + b, 0);
  const second = counts.slice(mid).reduce((a, b) => a + b, 0);
  if (first === 0 && second === 0) return null;
  const base = first === 0 ? Math.max(second, 1) : first;
  return ((second - first) / base) * 100;
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-summary"],
    queryFn: () => apiJson<Summary>("/api/auth/staff/summary/"),
  });

  const chartData = React.useMemo(() => {
    if (!data) return [];
    return buildLast7DaysLocal(data.bookings_last_days);
  }, [data]);

  const bookingMomentum = React.useMemo(() => {
    if (chartData.length === 0) return null;
    return momentumFromSeries(chartData.map((d) => d.count));
  }, [chartData]);

  const statusPie = React.useMemo(() => {
    if (!data) return [];
    const entries = Object.entries(data.bookings_by_status);
    const ordered = [
      ...STATUS_ORDER.filter((k) => k in data.bookings_by_status).map(
        (k) => [k, data.bookings_by_status[k]] as const
      ),
      ...entries.filter(([k]) => !STATUS_ORDER.includes(k as (typeof STATUS_ORDER)[number])),
    ];
    const total = entries.reduce((s, [, n]) => s + n, 0);
    return ordered.map(([status, value], i) => ({
      status,
      name: STATUS_LABEL[status] ?? status,
      value,
      pct: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [data]);

  const activeShare =
    data && data.businesses_total > 0
      ? Math.round((data.businesses_active / data.businesses_total) * 1000) /
        10
      : null;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[148px] rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[380px] rounded-xl lg:col-span-2" />
          <Skeleton className="h-[380px] rounded-xl" />
        </div>
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="ring-1 ring-foreground/10">
        <CardHeader>
          <CardTitle>No se pudieron cargar las métricas</CardTitle>
          <CardDescription>
            Comprueba NEXT_PUBLIC_API_URL, CORS y que el usuario tenga is_staff.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-foreground/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Panel de control
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
            Resumen operativo
          </h1>
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Vista unificada del ecosistema Reiz: cuentas, negocios, citas y
            reputación. Datos en tiempo real desde el backend Django.
          </p>
        </div>
        <div className="text-muted-foreground flex flex-col items-start gap-1 text-right text-xs sm:items-end">
          <span className="text-foreground/90 font-medium">
            Periodo gráfico: últimos 7 días
          </span>
          <span>
            Actualizado:{" "}
            {new Date().toLocaleString("es", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiStatCard
          title="Usuarios registrados"
          subtitle="Cuentas en la base"
          icon={Users}
          value={data.users_total.toLocaleString("es")}
        />
        <KpiStatCard
          title="Negocios"
          subtitle={
            activeShare != null
              ? `${activeShare}% activos sobre el total`
              : "Activos / total"
          }
          icon={Building2}
          value={
            <>
              {data.businesses_active.toLocaleString("es")}
              <span className="text-muted-foreground text-2xl font-normal md:text-3xl">
                {" "}
                / {data.businesses_total.toLocaleString("es")}
              </span>
            </>
          }
        />
        <KpiStatCard
          title="Reservas"
          subtitle="Total histórico en sistema"
          icon={CalendarDays}
          value={data.bookings_total.toLocaleString("es")}
          trend={
            bookingMomentum != null
              ? {
                  value: bookingMomentum,
                  label: "ritmo últimos días vs. anteriores",
                }
              : null
          }
        />
        <KpiStatCard
          title="Reseñas"
          subtitle="Valoración media global"
          icon={Star}
          value={
            <>
              {data.reviews_total.toLocaleString("es")}
              <span className="text-muted-foreground text-2xl font-normal md:text-3xl">
                {" "}
                · {data.average_rating.toFixed(2)}
              </span>
            </>
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 ring-1 ring-foreground/10 shadow-none">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="font-heading text-lg">
                Actividad de reservas
              </CardTitle>
              <CardDescription>
                Citas creadas por día (últimos 7 días, zona horaria local)
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={areaConfig} className="h-[min(360px,55vh)] w-full">
              <AreaChart
                accessibilityLayer
                data={chartData}
                margin={{ left: 4, right: 8, top: 12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-count)"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-count)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="short"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tickFormatter={(v) => String(v).replace(/\.$/, "")}
                />
                <YAxis
                  allowDecimals={false}
                  width={40}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  content={<ChartTooltipContent />}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-count)"
                  strokeWidth={2}
                  fill="url(#fillCount)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="ring-1 ring-foreground/10 shadow-none">
          <CardHeader>
            <CardTitle className="font-heading text-lg">
              Reservas por estado
            </CardTitle>
            <CardDescription>Distribución global en base</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ChartContainer
              config={{}}
              className="mx-auto aspect-square max-h-[220px] w-full max-w-[240px]"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={statusPie}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={80}
                  strokeWidth={2}
                  stroke="var(--background)"
                >
                  {statusPie.map((entry, i) => (
                    <Cell key={entry.status} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="flex flex-col gap-3">
              {statusPie.length === 0 ? (
                <li className="text-muted-foreground text-sm">Sin datos</li>
              ) : (
                statusPie.map((row) => (
                  <li
                    key={row.status}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: row.fill }}
                      />
                      <span className="truncate">{row.name}</span>
                    </span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {row.value}{" "}
                      <span className="text-foreground/80">
                        ({row.pct}%)
                      </span>
                    </span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </section>

      <Card className="ring-1 ring-foreground/10 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">
            Accesos rápidos
          </CardTitle>
          <CardDescription>
            Ir a las secciones más usadas del panel interno
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-0">
          {[
            { href: "/dashboard/negocios", label: "Negocios" },
            { href: "/dashboard/reservas", label: "Reservas" },
            { href: "/dashboard/clientes", label: "Clientes" },
            { href: "/dashboard/resenas", label: "Reseñas" },
            { href: "/dashboard/usuarios", label: "Usuarios" },
            { href: "/dashboard/buscar", label: "Búsqueda" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "inline-flex gap-1.5 rounded-full no-underline"
              )}
            >
              {l.label}
              <ArrowRight className="size-3.5 opacity-70" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
