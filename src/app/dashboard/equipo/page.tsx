"use client";

import { PaginatedTable } from "@/components/paginated-table";

export default function EquipoPage() {
  return (
    <PaginatedTable
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
          render: (r) => (r.is_owner ? "Sí" : "No"),
        },
        {
          key: "active",
          header: "Activo",
          render: (r) => (r.is_active ? "Sí" : "No"),
        },
      ]}
    />
  );
}
