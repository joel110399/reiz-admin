"use client";

import { Heart } from "lucide-react";
import { PaginatedTable } from "@/components/paginated-table";
import { formatDateTime } from "@/lib/format";

export default function FavoritosPage() {
  return (
    <PaginatedTable
      icon={Heart}
      queryKey="favorites"
      initialPath="/api/businesses/favorites/"
      title="Favoritos"
      description="Relación usuario ↔ negocio favorito."
      columns={[
        { key: "id", header: "ID", render: (r) => String(r.id) },
        {
          key: "user",
          header: "Usuario",
          render: (r) =>
            typeof r.user === "object" && r.user && "email" in r.user
              ? String((r.user as { email?: string }).email)
              : String(r.user ?? ""),
        },
        {
          key: "business",
          header: "Negocio",
          render: (r) =>
            typeof r.business === "object" && r.business && "name" in r.business
              ? String((r.business as { name?: string }).name)
              : String(r.business ?? ""),
        },
        {
          key: "created",
          header: "Creado",
          render: (r) => formatDateTime(r.created_at as string | undefined),
        },
      ]}
    />
  );
}
