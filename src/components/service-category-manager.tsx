"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Check,
  FolderPlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, formatApiErrorBody } from "@/lib/api-client";
import { fetchAllPages } from "@/lib/drf-helpers";
import { cn } from "@/lib/utils";

export type ServiceCategory = {
  id: number;
  business: number;
  name: string;
  sort_order?: number;
  is_active?: boolean;
};

export type CatalogService = {
  id: number;
  business: number;
  name: string;
  description?: string | null;
  price?: string;
  duration_minutes?: number;
  is_active?: boolean;
  category?: number | null;
  category_detail?: {
    id: number;
    name: string;
    sort_order?: number;
    is_active?: boolean;
  } | null;
};

const UNCATEGORIZED = "__none__";

function serviceCategoryId(service: CatalogService): number | null {
  return service.category ?? service.category_detail?.id ?? null;
}

function sortCategories(categories: ServiceCategory[]) {
  return [...categories].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      a.name.localeCompare(b.name, "es")
  );
}

type ServiceCategoryManagerProps = {
  businessId: number;
};

export function ServiceCategoryManager({
  businessId,
}: ServiceCategoryManagerProps) {
  const qc = useQueryClient();

  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [editingCategoryId, setEditingCategoryId] = React.useState<number | null>(
    null
  );
  const [editingCategoryName, setEditingCategoryName] = React.useState("");

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorTarget, setEditorTarget] = React.useState<ServiceCategory | null>(
    null
  );
  const [editorName, setEditorName] = React.useState("");
  const [editorSelectedIds, setEditorSelectedIds] = React.useState<number[]>(
    []
  );

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["service-categories", businessId],
    queryFn: () =>
      fetchAllPages<ServiceCategory>(
        `/api/service-categories/?business=${businessId}`
      ),
  });

  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ["business-services-catalog", businessId],
    queryFn: () =>
      fetchAllPages<CatalogService>(`/api/services/?business=${businessId}`),
  });

  const orderedCategories = React.useMemo(
    () => sortCategories(categories),
    [categories]
  );

  const invalidate = React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["service-categories", businessId] });
    void qc.invalidateQueries({
      queryKey: ["business-services-catalog", businessId],
    });
    void qc.invalidateQueries({
      queryKey: ["business-detail", String(businessId)],
    });
    void qc.invalidateQueries({ queryKey: ["services"] });
  }, [businessId, qc]);

  const openCreateEditor = () => {
    setEditorTarget(null);
    setEditorName(newCategoryName.trim());
    setEditorSelectedIds([]);
    setEditorOpen(true);
  };

  const openEditEditor = (category: ServiceCategory) => {
    setEditorTarget(category);
    setEditorName(category.name);
    setEditorSelectedIds(
      services
        .filter((s) => serviceCategoryId(s) === category.id)
        .map((s) => s.id)
    );
    setEditorOpen(true);
  };

  const toggleEditorService = (serviceId: number) => {
    setEditorSelectedIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiFetch("/api/service-categories/", {
        method: "POST",
        body: JSON.stringify({
          business: businessId,
          name,
          is_active: true,
        }),
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
      return JSON.parse(t) as ServiceCategory;
    },
    onSuccess: () => {
      toast.success("Categoría creada");
      setNewCategoryName("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiFetch(`/api/service-categories/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      toast.success("Categoría renombrada");
      setEditingCategoryId(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiFetch(`/api/service-categories/${id}/`, {
        method: "DELETE",
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      toast.success("Categoría eliminada");
      setEditorOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async (categoryIds: number[]) => {
      const res = await apiFetch("/api/service-categories/reorder/", {
        method: "POST",
        body: JSON.stringify({
          business: businessId,
          category_ids: categoryIds,
        }),
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEditorMutation = useMutation({
    mutationFn: async () => {
      const name = editorName.trim();
      if (!name) throw new Error("Escribe un nombre para la categoría.");

      let categoryId = editorTarget?.id ?? null;

      if (editorTarget) {
        if (name !== editorTarget.name) {
          const res = await apiFetch(
            `/api/service-categories/${editorTarget.id}/`,
            {
              method: "PATCH",
              body: JSON.stringify({ name }),
            }
          );
          const t = await res.text();
          if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
        }
        categoryId = editorTarget.id;
      } else {
        const res = await apiFetch("/api/service-categories/", {
          method: "POST",
          body: JSON.stringify({
            business: businessId,
            name,
            is_active: true,
          }),
        });
        const t = await res.text();
        if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
        const created = JSON.parse(t) as ServiceCategory;
        categoryId = created.id;
      }

      if (categoryId == null) throw new Error("No se pudo guardar la categoría.");

      const selected = new Set(editorSelectedIds);
      const updates: Promise<void>[] = [];

      for (const service of services) {
        const currentCat = serviceCategoryId(service);
        const shouldBelong = selected.has(service.id);

        if (shouldBelong && currentCat !== categoryId) {
          updates.push(
            (async () => {
              const res = await apiFetch(`/api/services/${service.id}/`, {
                method: "PATCH",
                body: JSON.stringify({ category: categoryId }),
              });
              const t = await res.text();
              if (!res.ok)
                throw new Error(formatApiErrorBody(t, res.statusText));
            })()
          );
        } else if (!shouldBelong && currentCat === categoryId) {
          updates.push(
            (async () => {
              const res = await apiFetch(`/api/services/${service.id}/`, {
                method: "PATCH",
                body: JSON.stringify({ category: null }),
              });
              const t = await res.text();
              if (!res.ok)
                throw new Error(formatApiErrorBody(t, res.statusText));
            })()
          );
        }
      }

      if (updates.length) await Promise.all(updates);
    },
    onSuccess: () => {
      toast.success(
        editorTarget ? "Categoría actualizada" : "Categoría creada"
      );
      setEditorOpen(false);
      setNewCategoryName("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignServiceMutation = useMutation({
    mutationFn: async ({
      serviceId,
      category,
    }: {
      serviceId: number;
      category: number | null;
    }) => {
      const res = await apiFetch(`/api/services/${serviceId}/`, {
        method: "PATCH",
        body: JSON.stringify({ category }),
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      toast.success("Servicio actualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveCategory = (category: ServiceCategory, dir: -1 | 1) => {
    const ordered = sortCategories(categories);
    const index = ordered.findIndex((c) => c.id === category.id);
    const next = index + dir;
    if (index < 0 || next < 0 || next >= ordered.length) return;
    const copy = [...ordered];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item!);
    reorderMutation.mutate(copy.map((c) => c.id));
  };

  const busy =
    createCategoryMutation.isPending ||
    renameCategoryMutation.isPending ||
    deleteCategoryMutation.isPending ||
    reorderMutation.isPending ||
    saveEditorMutation.isPending ||
    assignServiceMutation.isPending;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Categorías del menú</CardTitle>
            <CardDescription>
              Organiza servicios en secciones (Cortes, Lavados…). Igual que en
              Reiz Business.
            </CardDescription>
          </div>
          <div className="flex w-full max-w-md gap-2 sm:w-auto">
            <Input
              placeholder="Nueva categoría"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const name = newCategoryName.trim();
                  if (!name) return;
                  createCategoryMutation.mutate(name);
                }
              }}
              disabled={busy}
            />
            <Button
              size="sm"
              disabled={busy || !newCategoryName.trim()}
              onClick={() => {
                const name = newCategoryName.trim();
                if (!name) return;
                createCategoryMutation.mutate(name);
              }}
            >
              <Plus className="size-4" />
              Añadir
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={openCreateEditor}
              title="Crear y asignar servicios"
            >
              <FolderPlus className="size-4" />
              Con servicios
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingCategories ? (
            <p className="text-muted-foreground px-4 py-6 text-sm">
              Cargando categorías…
            </p>
          ) : orderedCategories.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-sm">
              Aún no hay categorías. Crea la primera para agrupar el menú.
            </p>
          ) : (
            <ul className="divide-y">
              {orderedCategories.map((category, index) => {
                const count = services.filter(
                  (s) => serviceCategoryId(s) === category.id
                ).length;
                return (
                  <li
                    key={category.id}
                    className="flex flex-wrap items-center gap-2 px-4 py-3"
                  >
                    {editingCategoryId === category.id ? (
                      <Input
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        className="h-9 max-w-xs"
                        autoFocus
                        disabled={busy}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const name = editingCategoryName.trim();
                            if (!name) return;
                            renameCategoryMutation.mutate({
                              id: category.id,
                              name,
                            });
                          }
                          if (e.key === "Escape") setEditingCategoryId(null);
                        }}
                      />
                    ) : (
                      <p className="min-w-0 flex-1 text-sm font-medium">
                        {category.name}
                      </p>
                    )}
                    <span className="text-muted-foreground text-xs">
                      {count} servicio{count === 1 ? "" : "s"}
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={busy || index === 0}
                        onClick={() => moveCategory(category, -1)}
                        title="Subir"
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={
                          busy || index === orderedCategories.length - 1
                        }
                        onClick={() => moveCategory(category, 1)}
                        title="Bajar"
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      {editingCategoryId === category.id ? (
                        <Button
                          size="sm"
                          disabled={busy || !editingCategoryName.trim()}
                          onClick={() => {
                            const name = editingCategoryName.trim();
                            if (!name) return;
                            renameCategoryMutation.mutate({
                              id: category.id,
                              name,
                            });
                          }}
                        >
                          Guardar
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            disabled={busy}
                            title="Renombrar"
                            onClick={() => {
                              setEditingCategoryId(category.id);
                              setEditingCategoryName(category.name);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => openEditEditor(category)}
                          >
                            Asignar
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive size-8"
                        disabled={busy}
                        title="Eliminar"
                        onClick={() => {
                          if (
                            !confirm(
                              `¿Eliminar «${category.name}»?\n\nLos servicios quedarán sin categoría.`
                            )
                          ) {
                            return;
                          }
                          deleteCategoryMutation.mutate(category.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Servicios del negocio</CardTitle>
          <CardDescription>
            Asigna cada servicio a una categoría del menú.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loadingServices ? (
            <p className="text-muted-foreground px-4 py-6 text-sm">
              Cargando servicios…
            </p>
          ) : !services.length ? (
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
                  <TableHead>Min</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="min-w-[180px]">Categoría</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s) => {
                  const catId = serviceCategoryId(s);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.id}</TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.price ?? "—"}</TableCell>
                      <TableCell>{s.duration_minutes ?? "—"}</TableCell>
                      <TableCell>{s.is_active ? "Sí" : "No"}</TableCell>
                      <TableCell>
                        <Select
                          value={catId != null ? String(catId) : UNCATEGORIZED}
                          disabled={busy}
                          onValueChange={(v) => {
                            const next =
                              !v || v === UNCATEGORIZED ? null : Number(v);
                            assignServiceMutation.mutate({
                              serviceId: s.id,
                              category: next,
                            });
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Sin categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNCATEGORIZED}>
                              Sin categoría
                            </SelectItem>
                            {orderedCategories.map((c) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editorTarget ? "Editar categoría" : "Nueva categoría"}
            </DialogTitle>
            <DialogDescription>
              Elige qué servicios pertenecen a esta sección del menú.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={editorName}
                onChange={(e) => setEditorName(e.target.value)}
                placeholder="Ej. Cortes"
                disabled={saveEditorMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>Servicios</Label>
              {!services.length ? (
                <p className="text-muted-foreground text-sm">
                  Este negocio aún no tiene servicios.
                </p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {services.map((service) => {
                    const selected = editorSelectedIds.includes(service.id);
                    const currentCat = serviceCategoryId(service);
                    const otherCat =
                      currentCat != null &&
                      currentCat !== editorTarget?.id
                        ? orderedCategories.find((c) => c.id === currentCat)
                        : null;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        disabled={saveEditorMutation.isPending}
                        onClick={() => toggleEditorService(service.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors",
                          selected ? "bg-primary/10" : "hover:bg-muted"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded border",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          )}
                        >
                          {selected ? <Check className="size-3" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {service.name}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {service.price != null ? `RD$${service.price}` : ""}
                            {otherCat ? ` · ahora en ${otherCat.name}` : ""}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {editorTarget ? (
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  if (
                    !confirm(
                      `¿Eliminar «${editorTarget.name}»?\n\nLos servicios quedarán sin categoría.`
                    )
                  ) {
                    return;
                  }
                  deleteCategoryMutation.mutate(editorTarget.id);
                }}
              >
                Eliminar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditorOpen(false)}
                disabled={saveEditorMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                disabled={
                  saveEditorMutation.isPending || !editorName.trim()
                }
                onClick={() => saveEditorMutation.mutate()}
              >
                {saveEditorMutation.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
