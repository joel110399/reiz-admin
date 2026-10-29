"use client";

import Link from "next/link";
import { Eye, Mail, Users } from "lucide-react";

import { PaginatedTable } from "@/components/paginated-table";
import { ActiveBadge, RoleBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { initialsFrom } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

export default function UsuariosPage() {
  return (
    <PaginatedTable
      icon={Users}
      queryKey="staff-users"
      initialPath="/api/auth/staff/users/"
      title="Usuarios"
      description="Cuentas del sistema. Pulsa una fila para ver sus negocios o enviarle un correo."
      searchPlaceholder="Buscar por nombre o correo…"
      rowHref={(r) => `/dashboard/usuarios/${r.id}`}
      columns={[
        {
          key: "email",
          header: "Usuario",
          render: (r) => {
            const name =
              [r.first_name, r.last_name].filter(Boolean).join(" ") ||
              String(r.username ?? "");
            return (
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar size="sm" className="size-8">
                  <AvatarFallback className="text-[11px]">
                    {initialsFrom(name || String(r.email ?? ""))}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">{name || "Sin nombre"}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {String(r.email ?? "")}
                  </p>
                </div>
              </div>
            );
          },
          csvValue: (r) => String(r.email ?? ""),
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
          csvValue: (r) => String(r.date_joined ?? ""),
          render: (r) => formatDateTime(r.date_joined as string | undefined),
        },
      ]}
      renderRowActions={(row) => (
        <div className="flex justify-end gap-0.5">
          {row.email ? (
            <Link
              href={`/dashboard/correos?user=${row.id}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-8"
              )}
              aria-label="Enviar correo"
              title="Enviar correo"
            >
              <Mail className="size-4" />
            </Link>
          ) : null}
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
