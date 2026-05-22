"use client";

import * as React from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiJson } from "@/lib/api-client";
import { fetchAllPages } from "@/lib/drf-helpers";

type OwnerDetail = {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  role?: string;
};

type BusinessHour = {
  id: number;
  day?: string;
  day_of_week?: string | number;
  is_open?: boolean;
  is_closed?: boolean;
  opening_time?: string | null;
  closing_time?: string | null;
  open_time?: string | null;
  close_time?: string | null;
  has_break?: boolean;
  break_start?: string | null;
  break_end?: string | null;
};

type ServiceItem = {
  id: number;
  name: string;
  description?: string | null;
  price?: string;
  duration_minutes?: number;
  is_active?: boolean;
};

type TeamMember = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  occupation_name?: string | null;
  is_owner?: boolean;
  is_active?: boolean;
};

type BizImage = {
  id: number;
  image_url?: string;
  is_primary?: boolean;
  order?: number;
};

type ProductItem = {
  id: number;
  name: string;
  price?: string;
  description?: string | null;
  is_active?: boolean;
};

type OnboardingProgress = {
  current_step?: string | number | null;
  current_step_display?: string | null;
  usage_type?: string | null;
  completed_steps?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

type ReviewsStats = {
  count: number;
  average_rating: number;
  verified_count: number;
};

type BusinessDetail = {
  id: number;
  slug?: string | null;
  owner: number;
  owner_detail?: OwnerDetail | null;
  name: string;
  category?: unknown;
  primary_category?: string | null;
  description?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  team_size?: string | null;
  amenities?: unknown;
  is_active?: boolean;
  onboarding_completed?: boolean;
  business_hours?: BusinessHour[];
  services?: ServiceItem[];
  team_members?: TeamMember[];
  images?: BizImage[];
  primary_image?: string | null;
  products?: ProductItem[];
  is_open_now?: boolean;
  onboarding_progress?: OnboardingProgress | null;
  reviews_stats?: ReviewsStats | null;
  created_at?: string;
  updated_at?: string;
};

type ReviewRow = {
  id: number;
  rating: number;
  comment?: string | null;
  is_verified?: boolean;
  guest_name?: string | null;
  booking?: number | null;
  created_at?: string;
};

function formatAmenities(a: unknown): string {
  if (a == null) return "—";
  if (Array.isArray(a)) return a.length ? a.join(", ") : "—";
  if (typeof a === "object") return JSON.stringify(a, null, 2);
  return String(a);
}

export default function NegocioDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");

  const { data: biz, isLoading, error } = useQuery({
    queryKey: ["business-detail", id],
    queryFn: () => apiJson<BusinessDetail>(`/api/businesses/${id}/`),
    enabled: !!id,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["business-reviews", id],
    queryFn: () =>
      fetchAllPages<ReviewRow>(
        `/api/reviews/?business=${encodeURIComponent(id)}`
      ),
    enabled: !!id && !!biz,
  });

  const sortedReviews = React.useMemo(() => {
    return [...reviews].sort(
      (a, b) =>
        String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
    );
  }, [reviews]);

  if (!id) {
    return (
      <p className="text-muted-foreground text-sm">ID de negocio no válido.</p>
    );
  }

  if (isLoading) {
    return (
      <p className="text-muted-foreground text-sm">Cargando negocio…</p>
    );
  }

  if (error || !biz) {
    return (
      <>
        <DetailPageHeader
          backHref="/dashboard/negocios"
          title="Negocio"
          description="No se pudo cargar el registro."
        />
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : "Error desconocido"}
        </p>
      </>
    );
  }

  const stats = biz.reviews_stats;
  const owner = biz.owner_detail;

  return (
    <>
      <DetailPageHeader
        backHref="/dashboard/negocios"
        title={biz.name}
        description={`#${biz.id}${biz.slug ? ` · ${biz.slug}` : ""} · ${
          biz.is_active ? "Activo" : "Inactivo"
        }${typeof biz.is_open_now === "boolean" ? ` · ${biz.is_open_now ? "Abierto ahora" : "Cerrado ahora"}` : ""}`}
      />

      <Tabs defaultValue="resumen" className="w-full">
        <TabsList variant="line" className="mb-4 h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="contacto">Contacto y ubicación</TabsTrigger>
          <TabsTrigger value="horarios">Horarios</TabsTrigger>
          <TabsTrigger value="servicios">Servicios</TabsTrigger>
          <TabsTrigger value="equipo">Equipo</TabsTrigger>
          <TabsTrigger value="productos">Productos</TabsTrigger>
          <TabsTrigger value="imagenes">Imágenes</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="resenas">Reseñas</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Identidad</CardTitle>
                <CardDescription>Categoría y descripción</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Categoría</span>
                  <span className="max-w-[60%] text-right">
                    {Array.isArray(biz.category)
                      ? biz.category.join(", ")
                      : String(biz.category ?? biz.primary_category ?? "—")}
                  </span>
                </div>
                {biz.primary_category ? (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Categoría principal
                    </span>
                    <span className="text-right">{biz.primary_category}</span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Onboarding app</span>
                  <span>
                    {biz.onboarding_completed ? "Completado" : "Pendiente"}
                  </span>
                </div>
                {biz.description ? (
                  <p className="border-border mt-2 border-t pt-3 whitespace-pre-wrap">
                    {biz.description}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dueño</CardTitle>
                <CardDescription>Cuenta vinculada al negocio</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {owner ? (
                  <>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">ID</span>
                      <Link
                        href={`/dashboard/usuarios/${owner.id}`}
                        className="text-primary font-mono text-xs hover:underline"
                      >
                        #{owner.id}
                      </Link>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Email</span>
                      <span className="text-right">{owner.email ?? "—"}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Nombre</span>
                      <span className="text-right">
                        {[owner.first_name, owner.last_name]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Rol</span>
                      <span>{owner.role ?? "—"}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Owner ID:{" "}
                    <Link
                      href={`/dashboard/usuarios/${biz.owner}`}
                      className="text-primary hover:underline"
                    >
                      #{biz.owner}
                    </Link>
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Comodidades</CardTitle>
              <CardDescription>Datos del onboarding (amenities)</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted/50 max-h-48 overflow-auto rounded-lg p-3 text-xs wrap-break-word whitespace-pre-wrap">
                {formatAmenities(biz.amenities)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacto">
          <Card>
            <CardHeader>
              <CardTitle>Contacto y ubicación</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm md:max-w-xl">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Teléfono</span>
                <span>{biz.phone ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Email</span>
                <span className="break-all">{biz.email ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Web</span>
                <span className="break-all">{biz.website ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tamaño equipo</span>
                <span>{biz.team_size ?? "—"}</span>
              </div>
              <div className="border-border mt-2 border-t pt-2">
                <span className="text-muted-foreground text-xs">Dirección</span>
                <p className="mt-1">{biz.address ?? "—"}</p>
              </div>
              <div className="flex gap-6 text-xs">
                <span>
                  Lat:{" "}
                  {biz.latitude != null ? String(biz.latitude) : "—"}
                </span>
                <span>
                  Lng:{" "}
                  {biz.longitude != null ? String(biz.longitude) : "—"}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="horarios">
          <Card>
            <CardHeader>
              <CardTitle>Horarios</CardTitle>
              <CardDescription>
                Igual que en la app negocio (días, descansos)
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {!biz.business_hours?.length ? (
                <p className="text-muted-foreground px-4 py-6 text-sm">
                  Sin horarios registrados.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Día</TableHead>
                      <TableHead>Abierto</TableHead>
                      <TableHead>Apertura</TableHead>
                      <TableHead>Cierre</TableHead>
                      <TableHead>Descanso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {biz.business_hours.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>
                          {h.day_of_week != null
                            ? String(h.day_of_week)
                            : h.day ?? "—"}
                        </TableCell>
                        <TableCell>
                          {h.is_closed
                            ? "Cerrado"
                            : h.is_open
                              ? "Sí"
                              : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {h.opening_time ?? h.open_time ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {h.closing_time ?? h.close_time ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {h.has_break
                            ? `${h.break_start ?? ""}–${h.break_end ?? ""}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="servicios">
          <Card>
            <CardHeader>
              <CardTitle>Servicios activos</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {!biz.services?.length ? (
                <p className="text-muted-foreground px-4 py-6 text-sm">
                  Sin servicios.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Duración (min)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {biz.services.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">
                          {s.id}
                        </TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>{s.price ?? "—"}</TableCell>
                        <TableCell>{s.duration_minutes ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipo">
          <Card>
            <CardHeader>
              <CardTitle>Equipo</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {!biz.team_members?.length ? (
                <p className="text-muted-foreground px-4 py-6 text-sm">
                  Sin miembros.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Ocupación</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Rol</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {biz.team_members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.name}</TableCell>
                        <TableCell>{m.occupation_name ?? "—"}</TableCell>
                        <TableCell className="max-w-[140px] truncate">
                          {m.email ?? "—"}
                        </TableCell>
                        <TableCell>{m.phone ?? "—"}</TableCell>
                        <TableCell>
                          {m.is_owner ? "Dueño" : "—"}{" "}
                          {!m.is_active ? "(inactivo)" : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="productos">
          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
              <CardDescription>Catálogo ligado al negocio</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {!biz.products?.length ? (
                <p className="text-muted-foreground px-4 py-6 text-sm">
                  Sin productos.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Activo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {biz.products.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">
                          {p.id}
                        </TableCell>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{p.price ?? "—"}</TableCell>
                        <TableCell>
                          {p.is_active !== false ? "Sí" : "No"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="imagenes">
          <Card>
            <CardHeader>
              <CardTitle>Galería</CardTitle>
              <CardDescription>
                Imagen principal:{" "}
                {biz.primary_image ? (
                  <a
                    href={biz.primary_image}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary"
                  >
                    abrir
                  </a>
                ) : (
                  "—"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!biz.images?.length ? (
                <p className="text-muted-foreground text-sm">Sin imágenes.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {biz.images.map((img) =>
                    img.image_url ? (
                      <div
                        key={img.id}
                        className="border-border relative aspect-square overflow-hidden rounded-lg border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.image_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {img.is_primary ? (
                          <span className="bg-background/90 absolute top-1 left-1 rounded px-1.5 py-0.5 text-[10px]">
                            Principal
                          </span>
                        ) : null}
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onboarding">
          <Card>
            <CardHeader>
              <CardTitle>Progreso onboarding (dueño)</CardTitle>
              <CardDescription>
                Solo visible para staff — mismos datos que la app negocios
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!biz.onboarding_progress ? (
                <p className="text-muted-foreground text-sm">
                  Sin registro de progreso (o no aplica).
                </p>
              ) : (
                <pre className="bg-muted/50 max-h-96 overflow-auto rounded-lg p-4 text-xs">
                  {JSON.stringify(biz.onboarding_progress, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resenas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estadísticas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Total</span>
                <p className="text-lg font-medium">{stats?.count ?? 0}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Media</span>
                <p className="text-lg font-medium">
                  {stats?.average_rating != null
                    ? stats.average_rating.toFixed(2)
                    : "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Verificadas</span>
                <p className="text-lg font-medium">
                  {stats?.verified_count ?? 0}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Listado de reseñas</CardTitle>
              <CardDescription>
                {sortedReviews.length} reseña
                {sortedReviews.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {sortedReviews.length === 0 ? (
                <p className="text-muted-foreground px-4 py-6 text-sm">
                  Sin reseñas.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Verif.</TableHead>
                      <TableHead>Comentario</TableHead>
                      <TableHead>Reserva</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedReviews.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">
                          {r.id}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {r.created_at?.slice(0, 19) ?? "—"}
                        </TableCell>
                        <TableCell>{r.rating}</TableCell>
                        <TableCell>{r.is_verified ? "Sí" : "No"}</TableCell>
                        <TableCell className="max-w-[280px] truncate">
                          {r.comment ?? "—"}
                        </TableCell>
                        <TableCell>
                          {r.booking ? (
                            <Link
                              href={`/dashboard/reservas/${r.booking}`}
                              className="text-primary text-xs hover:underline"
                            >
                              #{r.booking}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-muted-foreground mt-6 text-xs">
        Creado: {biz.created_at?.slice(0, 19) ?? "—"} · Actualizado:{" "}
        {biz.updated_at?.slice(0, 19) ?? "—"}
      </p>
    </>
  );
}
