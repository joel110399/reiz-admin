"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { PaginatedTable } from "@/components/paginated-table";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, formatApiErrorBody } from "@/lib/api-client";
import { fetchAllPages } from "@/lib/drf-helpers";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

type Opt = { id: number; name: string };

function idOf(
  v: number | { id: number } | null | undefined
): number | undefined {
  if (v == null) return undefined;
  return typeof v === "object" ? v.id : v;
}

export default function ReservasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BookingRow | null>(null);

  const [status, setStatus] = React.useState("pending");
  const [date, setDate] = React.useState("");
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [cBusiness, setCBusiness] = React.useState("");
  const [cClient, setCClient] = React.useState("");
  const [cService, setCService] = React.useState("");
  const [cDate, setCDate] = React.useState("");
  const [cStart, setCStart] = React.useState("09:00");

  const { data: businesses = [] } = useQuery({
    queryKey: ["businesses-all"],
    queryFn: () => fetchAllPages<Opt>("/api/businesses/"),
    enabled: open || createOpen,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services-for-biz", cBusiness],
    queryFn: () =>
      fetchAllPages<Opt & { business?: number }>(
        `/api/services/?business=${encodeURIComponent(cBusiness)}`
      ),
    enabled: createOpen && !!cBusiness,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["bookings"] });

  React.useEffect(() => {
    if (open && editing) {
      setStatus(editing.status);
      setDate(String(editing.date ?? ""));
      setStartTime(String(editing.start_time ?? "").slice(0, 8));
      setEndTime(String(editing.end_time ?? "").slice(0, 8));
      setNotes(editing.notes ?? "");
    }
  }, [open, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const body: Record<string, unknown> = {
        status,
        notes: notes.trim() || null,
        date,
        start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
        end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
      };
      const res = await apiFetch(`/api/bookings/${editing.id}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      toast.success("Reserva actualizada");
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
        description="Editar estado y horario; crear reserva ligando cliente existente (staff)."
        toolbar={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1 size-4" />
            Nueva reserva
          </Button>
        }
        columns={[
          { key: "id", header: "ID", render: (r) => String(r.id) },
          { key: "date", header: "Fecha", render: (r) => String(r.date ?? "") },
          {
            key: "time",
            header: "Horario",
            render: (r) =>
              `${String(r.start_time ?? "").slice(0, 5)}–${String(r.end_time ?? "").slice(0, 5)}`,
          },
          {
            key: "status",
            header: "Estado",
            render: (r) => String(r.status ?? ""),
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
          <div className="flex justify-end gap-1">
            <Link
              href={`/dashboard/reservas/${row.id}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-8"
              )}
              aria-label="Ver detalle"
            >
              <Eye className="size-4" />
            </Link>
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
          </div>
        )}
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar reserva #{editing?.id}</SheetTitle>
            <SheetDescription>
              Ajusta estado, fecha u horas; respeta solapes del negocio.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4 py-2">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v ?? "pending")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["pending", "confirmed", "completed", "cancelled"].map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Inicio</Label>
                <Input
                  type="time"
                  value={startTime.length > 5 ? startTime.slice(0, 5) : startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fin</Label>
                <Input
                  type="time"
                  value={endTime.length > 5 ? endTime.slice(0, 5) : endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nueva reserva (staff)</SheetTitle>
            <SheetDescription>
              Usa IDs de cliente y servicio del mismo negocio. El fin se calcula
              con la duración del servicio.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4 py-2">
            <div className="space-y-2">
              <Label>Negocio</Label>
              <Select
                value={cBusiness}
                onValueChange={(v) => setCBusiness(v ?? "")}
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
              <Label>ID cliente</Label>
              <Input
                inputMode="numeric"
                value={cClient}
                onChange={(e) => setCClient(e.target.value)}
                placeholder="pk del cliente"
              />
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
