"use client";

import * as React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function BuscarPage() {
  const [bookingId, setBookingId] = React.useState("");
  const [businessId, setBusinessId] = React.useState("");

  const bookingHref =
    bookingId.trim() && /^\d+$/.test(bookingId.trim())
      ? `/dashboard/reservas?highlight=${encodeURIComponent(bookingId.trim())}`
      : null;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Atajos de soporte
        </h1>
        <p className="text-muted-foreground text-sm">
          Abre listados con filtros o copia IDs para la API. Las reservas y
          negocios se gestionan en las secciones dedicadas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reserva por ID</CardTitle>
          <CardDescription>
            Tras cargar la tabla de reservas, localiza el ID en la primera
            columna o usa la API{" "}
            <code className="text-xs">GET /api/bookings/&lt;id&gt;/</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="bid">ID numérico de reserva</Label>
            <Input
              id="bid"
              inputMode="numeric"
              placeholder="ej. 1234"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
            />
          </div>
          {bookingHref ? (
            <Link
              href={bookingHref}
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              Ir a reservas (busca en la lista)
            </Link>
          ) : (
            <p className="text-muted-foreground text-xs">
              Introduce un ID válido para habilitar el enlace.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Negocio por ID</CardTitle>
          <CardDescription>
            Vista detalle:{" "}
            <code className="text-xs">GET /api/businesses/&lt;id&gt;/</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="nid">ID numérico de negocio</Label>
            <Input
              id="nid"
              inputMode="numeric"
              placeholder="ej. 56"
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
            />
          </div>
          {businessId.trim() && /^\d+$/.test(businessId.trim()) ? (
            <Link
              href="/dashboard/negocios"
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              Ver listado de negocios
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
