"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { DetailPageHeader } from "@/components/detail-page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiJson } from "@/lib/api-client";
import { fetchAllPages } from "@/lib/drf-helpers";

type UserDetail = {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined?: string;
  created_at?: string;
};

type BusinessRow = { id: number; name: string; owner: number; is_active?: boolean };

export default function UsuarioDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["staff-user-detail", id],
    queryFn: () => apiJson<UserDetail>(`/api/auth/staff/users/${id}/`),
    enabled: !!id,
  });

  const { data: ownedBusinesses = [] } = useQuery({
    queryKey: ["businesses-by-owner", id],
    queryFn: async () => {
      const all = await fetchAllPages<BusinessRow>("/api/businesses/");
      const uid = Number(id);
      return all.filter((b) => b.owner === uid);
    },
    enabled: !!id && !!user && user.role === "business",
  });

  if (!id) {
    return (
      <p className="text-muted-foreground text-sm">ID de usuario no válido.</p>
    );
  }

  if (isLoading) {
    return (
      <p className="text-muted-foreground text-sm">Cargando usuario…</p>
    );
  }

  if (error || !user) {
    return (
      <>
        <DetailPageHeader
          backHref="/dashboard/usuarios"
          title="Usuario"
          description="No se pudo cargar el registro."
        />
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : "Error desconocido"}
        </p>
      </>
    );
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");

  return (
    <>
      <DetailPageHeader
        backHref="/dashboard/usuarios"
        title={fullName || user.username || user.email}
        description={`#${user.id} · ${user.email}`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cuenta</CardTitle>
            <CardDescription>Datos del modelo User</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Username</span>
              <span>{user.username}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Email</span>
              <span className="break-all text-right">{user.email}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Rol</span>
              <span>{user.role}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Staff</span>
              <span>{user.is_staff ? "Sí" : "No"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Activo</span>
              <span>{user.is_active ? "Sí" : "No"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Alta</span>
              <span className="text-xs">
                {user.date_joined?.slice(0, 19) ?? "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">created_at</span>
              <span className="text-xs">
                {user.created_at?.slice(0, 19) ?? "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Negocios como dueño</CardTitle>
            <CardDescription>
              Solo si el rol es «business»; enlaces al detalle admin
            </CardDescription>
          </CardHeader>
          <CardContent>
            {user.role !== "business" ? (
              <p className="text-muted-foreground text-sm">
                Este usuario no es cuenta negocio.
              </p>
            ) : ownedBusinesses.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No hay negocios cuyo dueño sea este usuario.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {ownedBusinesses.map((biz) => (
                  <li key={biz.id} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/dashboard/negocios/${biz.id}`}
                      className="text-primary hover:underline"
                    >
                      {biz.name}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {biz.is_active === false ? "inactivo" : "activo"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
