"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { BookingEditForm } from "@/components/booking-edit-form";
import { PaginatedTable } from "@/components/paginated-table";
import { BookingStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, apiJson, formatApiErrorBody } from "@/lib/api-client";
import { fetchAllPages } from "@/lib/drf-helpers";
import { BOOKING_STATUSES, bookingStatusLabel, timeShort } from "@/lib/labels";
import type { Paginated } from "@/types/drf";

type BookingRow = {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string | null;
  business: number | { id: number; name?: string };
  client?: number | { id: number; name?: string } | null;
  service?: number | null;
};

type Opt = { id: number; name: string; email?: string | null; phone?: string | null };

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function ReservasPage() {
  return (
    <Suspense>
      <ReservasPageInner />
    </Suspense>
  );
}

function ReservasPageInner() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get("status") ?? "all";
  const [statusFilter, setStatusFilter] = React.useState(
    BOOKING_STATUSES.includes(urlStatus as (typeof BOOKING_STATUSES)[number])
      ? urlStatus
      : "all"
  );
  const [open, setOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BookingRow | null>(null);

  const [cBusiness, setCBusiness] = React.useState("");
  const [cClient, setCClient] = React.useState("");
  const [cClientLabel, setCClientLabel] = React.useState("");
  const [cClientQuery, setCClientQuery] = React.useState("");
  const [cService, setCService] = React.useState("");
  const [cDate, setCDate] = React.useState("");
  const [cStart, setCStart] = React.useState("09:00");
  const clientSearch = useDebounced(cClientQuery, 280);

  const { data: businesses = [] } = useQuery({
    queryKey: ["businesses-all"],
    queryFn: () => fetchAllPages<Opt>("/api/businesses/"),
    enabled: createOpen,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services-for-biz", cBusiness],
    queryFn: () =>
      fetchAllPages<Opt & { business?: number }>(
        `/api/services/?business=${encodeURIComponent(cBusiness)}`
      ),
    enabled: createOpen && !!cBusiness,
  });

  const { data: clientHits } = useQuery({
    queryKey: ["client-picker", cBusiness, clientSearch],
    queryFn: () =>
      apiJson<Paginated<Opt>>(
        `/api/bookings/clients/?business=${encodeURIComponent(cBusiness)}&search=${encodeURIComponent(clientSearch)}&page_size=12`
      ),
    enabled: createOpen && !!cBusiness && clientSearch.trim().length >= 1,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["bookings"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const bid = Number(cBusiness);
      const cid = Number(cClient);
      const sid = Number(cService);
      if (!bid || !cid || !sid || !cDate.trim())
        throw new Error("Negocio, cliente, servicio y fecha son obligatorios.");
      const st = cStart.length === 5 ? `${cStart}:00` : cStart;
      const body = {
        business: bid,
        client: cid,
        service: sid,
        date: cDate,
        start_time: st,
        is_walk_in: false,
      };
      const res = await apiFetch("/api/bookings/", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      toast.success("Reserva creada");
      setCreateOpen(false);
      setCBusiness("");
      setCClient("");
      setCClientLabel("");
      setCClientQuery("");
      setCService("");
      setCDate("");
      setCStart("09:00");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PaginatedTable<BookingRow>
        queryKey="bookings"
        initialPath="/api/bookings/"
        title="Reservas"
        description="Confirma, reprograma o cancela citas. Pulsa una fila para abrir el caso."
        extraQuery={{
          status: statusFilter === "all" ? null : statusFilter,
        }}
        rowHref={(r) => `/dashboard/reservas/${r.id}`}
        toolbar={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 size-4" />
            Nueva reserva
          </Button>
        }
        filters={
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v ?? "all")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {BOOKING_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {bookingStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        columns={[
          { key: "id", header: "ID", render: (r) => String(r.id) },
          { key: "date", header: "Fecha", render: (r) => String(r.date ?? "") },
          {
            key: "time",
            header: "Horario",
            render: (r) =>
              `${timeShort(r.start_time)}–${timeShort(r.end_time)}`,
          },
          {
            key: "status",
            header: "Estado",
            render: (r) => <BookingStatusBadge status={r.status} />,
          },
          {
            key: "business",
            header: "Negocio",
            render: (r) =>
              typeof r.business === "object" && r.business && "name" in r.business
                ? String((r.business as { name?: string }).name)
                : String(r.business ?? ""),
          },
          {
            key: "client",
            header: "Cliente",
            render: (r) =>
              r.client && typeof r.client === "object" && "name" in r.client
                ? String((r.client as { name?: string }).name)
                : String(r.client ?? "—"),
          },
        ]}
        renderRowActions={(row) => (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Editar"
            onClick={() => {
              setEditing(row);
              setOpen(true);
            }}
          >
            <Pencil className="size-4" />
          </Button>
        )}
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Resolver reserva #{editing?.id}</SheetTitle>
            <SheetDescription>
              Cambia estado, fecha u horas. El backend valida solapes.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 py-2">
            {editing ? (
              <BookingEditForm
                booking={editing}
                onSaved={() => {
                  setOpen(false);
                  setEditing(null);
                }}
                onCancel={() => setOpen(false)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nueva reserva</SheetTitle>
            <SheetDescription>
              Busca el cliente del negocio. El fin se calcula con la duración
              del servicio.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4 py-2">
            <div className="space-y-2">
              <Label>Negocio</Label>
              <Select
                value={cBusiness}
                onValueChange={(v) => {
                  setCBusiness(v ?? "");
                  setCClient("");
                  setCClientLabel("");
                  setCService("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Negocio" />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name} (#{b.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              {cClient ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="truncate">{cClientLabel || `#${cClient}`}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCClient("");
                      setCClientLabel("");
                    }}
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    value={cClientQuery}
                    onChange={(e) => setCClientQuery(e.target.value)}
                    placeholder={
                      cBusiness
                        ? "Nombre, email o teléfono"
                        : "Elige un negocio primero"
                    }
                    disabled={!cBusiness}
                  />
                  {clientHits?.results?.length ? (
                    <ul className="max-h-40 overflow-y-auto rounded-lg border">
                      {clientHits.results.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="hover:bg-muted w-full px-3 py-2 text-left text-sm"
                            onClick={() => {
                              setCClient(String(c.id));
                              setCClientLabel(
                                [c.name, c.phone || c.email]
                                  .filter(Boolean)
                                  .join(" · ")
                              );
                              setCClientQuery("");
                            }}
                          >
                            <span className="block font-medium">{c.name}</span>
                            <span className="text-muted-foreground text-xs">
                              {[c.phone, c.email].filter(Boolean).join(" · ") ||
                                `#${c.id}`}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label>Servicio</Label>
              <Select
                value={cService}
                onValueChange={(v) => setCService(v ?? "")}
                disabled={!cBusiness}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Servicio del negocio" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} (#{s.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={cDate}
                onChange={(e) => setCDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hora inicio</Label>
              <Input
                type="time"
                value={cStart}
                onChange={(e) => setCStart(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creando…" : "Crear"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
