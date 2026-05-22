"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
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

type ClientRow = {
  id: number;
  business: number;
  business_name?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

type BusinessOpt = { id: number; name: string };

export default function ClientesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ClientRow | null>(null);
  const [businessId, setBusinessId] = React.useState("");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const { data: businesses = [] } = useQuery({
    queryKey: ["businesses-all"],
    queryFn: () => fetchAllPages<BusinessOpt>("/api/businesses/"),
    enabled: open,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["clients"] });

  React.useEffect(() => {
    if (open && editing) {
      setBusinessId(String(editing.business));
      setName(editing.name);
      setPhone(editing.phone ?? "");
      setEmail(editing.email ?? "");
      setNotes(editing.notes ?? "");
    } else if (open && !editing) {
      setBusinessId("");
      setName("");
      setPhone("");
      setEmail("");
      setNotes("");
    }
  }, [open, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const bid = Number(businessId);
      if (!bid || !name.trim()) throw new Error("Negocio y nombre son obligatorios.");
      const body = {
        business: bid,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
      };
      if (editing) {
        const res = await apiFetch(`/api/bookings/clients/${editing.id}/`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        const t = await res.text();
        if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
        return;
      }
      const res = await apiFetch("/api/bookings/clients/", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const t2 = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t2, res.statusText));
    },
    onSuccess: () => {
      toast.success(editing ? "Cliente actualizado" : "Cliente creado");
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/bookings/clients/${id}/`, {
        method: "DELETE",
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      toast.success("Cliente eliminado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PaginatedTable<ClientRow>
        queryKey="clients"
        initialPath="/api/bookings/clients/"
        title="Clientes"
        description="Crear, editar o eliminar clientes por negocio (requiere permisos staff en API)."
        toolbar={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="mr-1 size-4" />
            Nuevo cliente
          </Button>
        }
        columns={[
          { key: "id", header: "ID", render: (r) => String(r.id) },
          { key: "name", header: "Nombre", render: (r) => String(r.name ?? "") },
          { key: "email", header: "Email", render: (r) => String(r.email ?? "—") },
          { key: "phone", header: "Teléfono", render: (r) => String(r.phone ?? "—") },
          {
            key: "business",
            header: "Negocio",
            render: (r) =>
              typeof r.business === "object" && r.business && "name" in r.business
                ? String((r.business as { name?: string }).name)
                : String(r.business_name ?? r.business ?? ""),
          },
        ]}
        renderRowActions={(row) => (
          <div className="flex justify-end gap-1">
            <Link
              href={`/dashboard/clientes/${row.id}`}
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
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive size-8"
              aria-label="Eliminar"
              onClick={() => {
                if (
                  !confirm(
                    `¿Eliminar al cliente «${row.name}»? Las reservas asociadas pueden verse afectadas.`
                  )
                )
                  return;
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
              {editing ? "Editar cliente" : "Nuevo cliente"}
            </SheetTitle>
            <SheetDescription>
              Los cambios se guardan en el backend Django.
            </SheetDescription>
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
                  <SelectValue placeholder="Selecciona negocio" />
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
              <Label htmlFor="cname">Nombre</Label>
              <Input
                id="cname"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cemail">Email</Label>
              <Input
                id="cemail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cphone">Teléfono</Label>
              <Input
                id="cphone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnotes">Notas</Label>
              <Textarea
                id="cnotes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter className="gap-2 sm:justify-between">
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
