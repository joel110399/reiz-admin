"use client";

import { PaginatedTable } from "@/components/paginated-table";
import { ActiveBadge } from "@/components/status-badge";

export default function TokensPage() {
  return (
    <PaginatedTable
      queryKey="device-tokens"
      initialPath="/api/notifications/device-tokens/"
      title="Device tokens (push)"
      description="Tokens FCM/APNs registrados — útil para diagnosticar notificaciones."
      columns={[
        { key: "id", header: "ID", render: (r) => String(r.id) },
        {
          key: "user",
          header: "Usuario ID",
          render: (r) => String(r.user ?? ""),
        },
        { key: "platform", header: "Plataforma", render: (r) => String(r.platform ?? "") },
        {
          key: "active",
          header: "Activo",
          render: (r) => <ActiveBadge active={!!r.is_active} />,
        },
        {
          key: "token",
          header: "Token (preview)",
          render: (r) => {
            const t = String(r.token ?? "");
            return t.length > 24 ? `${t.slice(0, 24)}…` : t;
          },
        },
      ]}
    />
  );
}
