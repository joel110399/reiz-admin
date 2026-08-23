"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

import { PaginatedTable } from "@/components/paginated-table";
import { ActiveBadge, RoleBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function UsuariosPage() {
  return (
    <PaginatedTable
      queryKey="staff-users"
      initialPath="/api/auth/staff/users/"
      title="Usuarios"
      description="Cuentas del sistema. Pulsa una fila para ver dueños y acceso."
      rowHref={(r) => `/dashboard/usuarios/${r.id}`}
      columns={[
        { key: "id", header: "ID", render: (r) => String(r.id) },
        { key: "email", header: "Email", render: (r) => String(r.email ?? "") },
        {
          key: "username",
          header: "Usuario",
          render: (r) => String(r.username ?? ""),
        },
        { key: "role", header: "Rol", render: (r) => <RoleBadge role={String(r.role ?? "")} /> },
        {
          key: "staff",
          header: "Staff",
          render: (r) => (
            <ActiveBadge
              active={!!r.is_staff}
              trueLabel="Staff"
              falseLabel="No"
            />
          ),
        },
        {
          key: "active",
          header: "Activo",
          render: (r) => <ActiveBadge active={!!r.is_active} />,
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
