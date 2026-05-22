"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

import { PaginatedTable } from "@/components/paginated-table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function UsuariosPage() {
  return (
    <PaginatedTable
      queryKey="staff-users"
      initialPath="/api/auth/staff/users/"
      title="Usuarios (cuentas)"
      description="Usuarios del sistema — endpoint interno staff."
      columns={[
        { key: "id", header: "ID", render: (r) => String(r.id) },
        { key: "email", header: "Email", render: (r) => String(r.email ?? "") },
        {
          key: "username",
          header: "Usuario",
          render: (r) => String(r.username ?? ""),
        },
        { key: "role", header: "Rol", render: (r) => String(r.role ?? "") },
        {
          key: "staff",
          header: "Staff",
          render: (r) => (r.is_staff ? "Sí" : "No"),
        },
        {
          key: "active",
          header: "Activo",
          render: (r) => (r.is_active ? "Sí" : "No"),
        },
        {
          key: "joined",
          header: "Alta",
          render: (r) => String(r.date_joined ?? "").slice(0, 19),
        },
      ]}
      renderRowActions={(row) => (
        <div className="flex justify-end">
          <Link
            href={`/dashboard/usuarios/${row.id}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "size-8"
            )}
            aria-label="Ver detalle"
          >
            <Eye className="size-4" />
          </Link>
        </div>
      )}
    />
  );
}
