"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Eye, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { apiJson } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type NoveltyRow = {
  id: number;
  slug: string;
  title: string;
  body: string;
  is_active: boolean;
  audience_count: number;
  accepted_count: number;
  dismissed_count: number;
  unseen_count: number;
  seen_count: number;
  hidden_count: number;
  forced_count: number;
};

export default function NovedadesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-novelties"],
    queryFn: () => apiJson<NoveltyRow[]>("/api/notifications/staff/novelties/"),
  });

  const items = data ?? [];
  const total = items.length;
  const active = items.filter((n) => n.is_active).length;
  const audience = items[0]?.audience_count ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Novedades"
        description="Avisos al abrir la app del negocio. Actívalos, míralos y elige quién los ve."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Novedades</CardDescription>
            <CardTitle className="text-2xl">{isLoading ? "—" : total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Activas</CardDescription>
            <CardTitle className="text-2xl">{isLoading ? "—" : active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cuentas negocio</CardDescription>
            <CardTitle className="text-2xl">
              {isLoading ? "—" : audience}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {error ? (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : "No se pudieron cargar"}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Listado
          </CardTitle>
          <CardDescription>
            Abrió = tocó el botón principal. Ahora no = cerró el aviso. Sin ver
            = todavía no respondió.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Cargando…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Novedad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Sin ver</TableHead>
                  <TableHead className="text-right">Abrió</TableHead>
                  <TableHead className="text-right">Ahora no</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>
                      <div className="font-medium">{n.title}</div>
                      <div className="text-muted-foreground text-xs">{n.slug}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={n.is_active ? "default" : "secondary"}>
                        {n.is_active ? "Activa" : "Apagada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {n.unseen_count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {n.accepted_count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {n.dismissed_count}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/novedades/${n.id}`}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "icon" }),
                          "size-8"
                        )}
                        aria-label="Ver detalle"
                      >
                        <Eye className="size-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
