"use client";

import { Briefcase } from "lucide-react";
import { PaginatedTable } from "@/components/paginated-table";
import { ActiveBadge } from "@/components/status-badge";

export default function EquipoPage() {
  return (
    <PaginatedTable
      icon={Briefcase}
      queryKey="team-members"
      initialPath="/api/businesses/team-members/"
      title="Miembros de equipo"
      description="TeamMember por negocio — usa ?business= en la API para filtrar."
      columns={[
        { key: "id", header: "ID", render: (r) => String(r.id) },
        { key: "name", header: "Nombre", render: (r) => String(r.name ?? "") },
        {
          key: "business",
          header: "Negocio",
          render: (r) =>
            typeof r.business === "object" && r.business && "name" in r.business
              ? String((r.business as { name?: string }).name)
              : String(r.business ?? ""),
        },
        {
          key: "owner",
          header: "Dueño",
          render: (r) => (
            <ActiveBadge
              active={!!r.is_owner}
              trueLabel="Dueño"
              falseLabel="Miembro"
            />
          ),
        },
        {
          key: "active",
          header: "Activo",
          render: (r) => <ActiveBadge active={!!r.is_active} />,
        },
      ]}
    />
  );
}
