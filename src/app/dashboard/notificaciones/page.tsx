"use client";

import { PaginatedTable } from "@/components/paginated-table";

export default function NotificacionesPage() {
  return (
    <PaginatedTable
      queryKey="notifications"
      initialPath="/api/notifications/notifications/"
      title="Notificaciones in-app"
      description="Historial de notificaciones (todos los usuarios, vista staff)."
      columns={[
        { key: "id", header: "ID", render: (r) => String(r.id) },
        {
          key: "user",
          header: "Usuario ID",
          render: (r) =>
            typeof r.user === "object" && r.user && "id" in r.user
              ? String((r.user as { id?: number }).id)
              : String(r.user ?? ""),
        },
        { key: "title", header: "Título", render: (r) => String(r.title ?? "") },
        {
          key: "read",
          header: "Leída",
          render: (r) => (r.read ? "Sí" : "No"),
        },
        {
          key: "created",
          header: "Creada",
          render: (r) => String(r.created_at ?? "").slice(0, 19),
        },
      ]}
    />
  );
}
