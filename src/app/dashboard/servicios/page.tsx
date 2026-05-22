"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
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

type ServiceRow = {
  id: number;
  business: number;
  name: string;
  description?: string | null;
  price: string;
  duration_minutes: number;
  is_active: boolean;
};

type BusinessOpt = { id: number; name: string };

export default function ServiciosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ServiceRow | null>(null);
  const [businessId, setBusinessId] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [duration, setDuration] = React.useState("");
  const [isActive, setIsActive] = React.useState("true");

  const { data: businesses = [] } = useQuery({
    queryKey: ["businesses-all"],
    queryFn: () => fetchAllPages<BusinessOpt>("/api/businesses/"),
    enabled: open,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["services"] });

  React.useEffect(() => {
    if (open && editing) {
      setBusinessId(String(editing.business));
      setName(editing.name);
      setDescription(editing.description ?? "");
      setPrice(String(editing.price));
      setDuration(String(editing.duration_minutes));
      setIsActive(editing.is_active ? "true" : "false");
    } else if (open && !editing) {
      setBusinessId("");
      setName("");
      setDescription("");
      setPrice("");
      setDuration("30");
      setIsActive("true");
    }
  }, [open, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const bid = Number(businessId);
      const pr = Number(price);
      const dur = Number(duration);
      if (!bid || !name.trim()) throw new Error("Negocio y nombre son obligatorios.");
      if (Number.isNaN(pr) || pr < 0) throw new Error("Precio inválido.");
      if (Number.isNaN(dur) || dur <= 0) throw new Error("Duración inválida (minutos).");
      const body = {
        business: bid,
        name: name.trim(),
        description: description.trim() || null,
        price: Number(pr.toFixed(2)),
        duration_minutes: dur,
        is_active: isActive === "true",
      };
      if (editing) {
        const res = await apiFetch(`/api/services/${editing.id}/`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        const t = await res.text();
        if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
        return;
      }
      const res = await apiFetch("/api/services/", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const t2 = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t2, res.statusText));
    },
    onSuccess: () => {
      toast.success(editing ? "Servicio actualizado" : "Servicio creado");
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/services/${id}/`, { method: "DELETE" });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      toast.success("Servicio eliminado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PaginatedTable<ServiceRow>
        queryKey="services"
        initialPath="/api/services/"
        title="Servicios"
        description="CRUD sobre servicios de cualquier negocio."
        toolbar={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-1 size-4" />
            Nuevo servicio
          </Button>
        }
        columns={[
          { key: "id", header: "ID", render: (r) => String(r.id) },
          { key: "name", header: "Nombre", render: (r) => String(r.name ?? "") },
          {
            key: "business",
            header: "Negocio",
            render: (r) => {
              const d = r as ServiceRow & {
                business_detail?: { name?: string };
              };
              if (d.business_detail?.name) return d.business_detail.name;
              return String(r.business ?? "");
            },
          },
          { key: "price", header: "Precio", render: (r) => String(r.price ?? "") },
          {
            key: "duration",
            header: "Min",
            render: (r) => String(r.duration_minutes ?? ""),
          },
          {
            key: "active",
            header: "Activo",
            render: (r) => (r.is_active ? "Sí" : "No"),
          },
        ]}
        renderRowActions={(row) => (
          <div className="flex justify-end gap-1">
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
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive size-8"
              aria-label="Eliminar"
              onClick={() => {
                if (!confirm(`¿Eliminar el servicio «${row.name}»?`)) return;
                deleteMutation.mutate(row.id);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {editing ? "Editar servicio" : "Nuevo servicio"}
            </SheetTitle>
            <SheetDescription>Precio en la moneda del negocio (ej. DOP).</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4 py-2">
            <div className="space-y-2">
              <Label>Negocio</Label>
              <Select
                value={businessId}
                onValueChange={(v) => setBusinessId(v ?? "")}
                disabled={!!editing}
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
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Precio</Label>
                <Input
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Duración (min)</Label>
                <Input
                  inputMode="numeric"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Activo</Label>
              <Select
                value={isActive}
                onValueChange={(v) => setIsActive(v ?? "true")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sí</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
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
    </>
  );
}
