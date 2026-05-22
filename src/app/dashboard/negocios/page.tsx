"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { CreateBusinessWizard } from "@/components/create-business-wizard";
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BizRow = {
  id: number;
  name: string;
  slug?: string | null;
  owner: number;
  is_active: boolean;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export default function NegociosPage() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BizRow | null>(null);

  const [name, setName] = React.useState("");
  const [isActive, setIsActive] = React.useState("true");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [address, setAddress] = React.useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["businesses"] });

  React.useEffect(() => {
    if (open && editing) {
      setName(editing.name);
      setIsActive(editing.is_active ? "true" : "false");
      setPhone(editing.phone ?? "");
      setEmail(editing.email ?? "");
      setAddress(editing.address ?? "");
    }
  }, [open, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const body = {
        name: name.trim(),
        is_active: isActive === "true",
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
      };
      const res = await apiFetch(`/api/businesses/${editing.id}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      toast.success("Negocio actualizado");
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PaginatedTable<BizRow>
        queryKey="businesses"
        initialPath="/api/businesses/"
        paginationStyle="limit"
        defaultPageSize={10}
        title="Negocios"
        description="Editar datos básicos o crear negocio asignando un usuario con rol negocio."
        toolbar={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 size-4" />
            Nuevo negocio
          </Button>
        }
        columns={[
          { key: "id", header: "ID", render: (r) => String(r.id) },
          { key: "name", header: "Nombre", render: (r) => String(r.name ?? "") },
          {
            key: "slug",
            header: "Slug",
            render: (r) => String(r.slug ?? "—"),
          },
          { key: "owner", header: "Owner ID", render: (r) => String(r.owner ?? "") },
          {
            key: "is_active",
            header: "Activo",
            render: (r) => (r.is_active ? "Sí" : "No"),
          },
        ]}
        renderRowActions={(row) => (
          <div className="flex justify-end gap-1">
            <Link
              href={`/dashboard/negocios/${row.id}`}
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
            <SheetTitle>Editar negocio #{editing?.id}</SheetTitle>
            <SheetDescription>Cambios vía PATCH (slug lo gestiona el backend).</SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4 py-2">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
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
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
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

      <CreateBusinessWizard
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={invalidate}
      />
    </>
  );
}
