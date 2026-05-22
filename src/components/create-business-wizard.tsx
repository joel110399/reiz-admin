"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  DEFAULT_MAP_CENTER,
  LocationMapPicker,
} from "@/components/location-map-picker";
import { apiJson } from "@/lib/api-client";
import { fetchAllPages } from "@/lib/drf-helpers";
import { cn } from "@/lib/utils";

const TEAM_SIZE_OPTIONS = [
  { value: "solo", label: "Solo yo" },
  { value: "2-5", label: "2–5 personas" },
  { value: "6-10", label: "6–10 personas" },
  { value: "11-20", label: "11–20 personas" },
  { value: "20+", label: "Más de 20" },
] as const;

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type UserRow = { id: number; username: string; email: string; role: string };

type ServiceDraft = {
  name: string;
  price: string;
  duration_minutes: string;
  description: string;
};

type ProductDraft = {
  name: string;
  price: string;
  description: string;
};

function parseCategories(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseAmenities(s: string): string[] {
  return parseCategories(s);
}

function normalizeTime(t: string): string | null {
  const v = t.trim();
  if (!v) return null;
  if (v.length === 5 && v.includes(":")) return `${v}:00`;
  return v;
}

function buildBusinessHours(
  open: string,
  close: string,
  sundayClosed: boolean
): {
  day: string;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  has_break: boolean;
}[] {
  const ot = normalizeTime(open);
  const ct = normalizeTime(close);
  return DAYS.map((day) => {
    const closed = day === "sunday" && sundayClosed;
    return {
      day,
      is_open: !closed,
      open_time: closed ? null : ot,
      close_time: closed ? null : ct,
      has_break: false,
    };
  });
}

const STEPS = [
  "Datos básicos",
  "Ubicación",
  "Contacto",
  "Equipo",
  "Horarios",
  "Servicios",
] as const;

const TOTAL_STEPS = STEPS.length;

type CreateBusinessWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function CreateBusinessWizard({
  open,
  onOpenChange,
  onSuccess,
}: CreateBusinessWizardProps) {
  const [step, setStep] = React.useState(1);

  const [ownerId, setOwnerId] = React.useState("");
  const [name, setName] = React.useState("");
  const [categoryStr, setCategoryStr] = React.useState("barberia");
  const [description, setDescription] = React.useState("");

  const [address, setAddress] = React.useState("");
  const [latitude, setLatitude] = React.useState(
    String(DEFAULT_MAP_CENTER.lat)
  );
  const [longitude, setLongitude] = React.useState(
    String(DEFAULT_MAP_CENTER.lng)
  );
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [website, setWebsite] = React.useState("");

  const [teamSize, setTeamSize] = React.useState<string>("solo");
  const [amenitiesStr, setAmenitiesStr] = React.useState(
    "wifi, estacionamiento"
  );

  const [openTime, setOpenTime] = React.useState("09:00");
  const [closeTime, setCloseTime] = React.useState("18:00");
  const [sundayClosed, setSundayClosed] = React.useState(true);

  const [services, setServices] = React.useState<ServiceDraft[]>([
    { name: "", price: "500", duration_minutes: "30", description: "" },
  ]);

  const [products, setProducts] = React.useState<ProductDraft[]>([]);

  const { data: owners = [] } = useQuery({
    queryKey: ["users-business"],
    queryFn: async () => {
      const rows = await fetchAllPages<UserRow>("/api/auth/staff/users/");
      return rows.filter((u) => u.role === "business");
    },
    enabled: open,
  });

  React.useEffect(() => {
    if (open) {
      setStep(1);
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const oid = Number(ownerId);
      const cats = parseCategories(categoryStr);
      if (!name.trim() || !oid || cats.length === 0) {
        throw new Error("Nombre, dueño y al menos una categoría son obligatorios.");
      }
      const lat = parseFloat(latitude.replace(",", "."));
      const lng = parseFloat(longitude.replace(",", "."));
      if (!address.trim() || Number.isNaN(lat) || Number.isNaN(lng)) {
        throw new Error("Dirección y coordenadas válidas son obligatorias.");
      }
      const amenities = parseAmenities(amenitiesStr);
      if (!teamSize || amenities.length === 0) {
        throw new Error("Tamaño del equipo y al menos una amenidad son obligatorios.");
      }
      const validServices = services.filter((s) => s.name.trim());
      if (validServices.length === 0) {
        throw new Error("Añade al menos un servicio con nombre.");
      }
      for (const s of validServices) {
        const p = Number(s.price.replace(",", "."));
        const d = Number(s.duration_minutes);
        if (Number.isNaN(p) || p < 0) throw new Error(`Precio inválido: ${s.name}`);
        if (Number.isNaN(d) || d <= 0)
          throw new Error(`Duración inválida: ${s.name}`);
      }

      const businessBody: Record<string, unknown> = {
        name: name.trim(),
        owner: oid,
        category: cats,
        description: description.trim() || "",
        address: address.trim(),
        latitude: lat,
        longitude: lng,
        phone: phone.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
        team_size: teamSize,
        amenities,
      };

      const created = await apiJson<{ id: number }>("/api/businesses/", {
        method: "POST",
        body: JSON.stringify(businessBody),
      });

      for (const s of validServices) {
        await apiJson("/api/services/", {
          method: "POST",
          body: JSON.stringify({
            business: created.id,
            name: s.name.trim(),
            description: s.description.trim() || "",
            price: String(Number(s.price.replace(",", "."))),
            duration_minutes: Number(s.duration_minutes),
            is_active: true,
          }),
        });
      }

      const hoursPayload = buildBusinessHours(openTime, closeTime, sundayClosed);

      const patchBody: Record<string, unknown> = {
        business_hours: hoursPayload,
      };

      const productRows = products.filter((p) => p.name.trim() && p.price.trim());
      if (productRows.length > 0) {
        patchBody.products = productRows.map((p) => ({
          name: p.name.trim(),
          description: p.description.trim() || "",
          price: String(Number(p.price.replace(",", "."))),
          is_active: true,
        }));
      }

      await apiJson(`/api/businesses/${created.id}/update_onboarding/`, {
        method: "PATCH",
        body: JSON.stringify(patchBody),
      });

      return created.id;
    },
    onSuccess: () => {
      toast.success("Negocio creado con datos de onboarding.");
      onSuccess();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canGoNext = React.useMemo(() => {
    if (step === 1) {
      return (
        !!ownerId &&
        !!name.trim() &&
        parseCategories(categoryStr).length > 0
      );
    }
    if (step === 2) {
      const lat = parseFloat(latitude.replace(",", "."));
      const lng = parseFloat(longitude.replace(",", "."));
      return !!address.trim() && !Number.isNaN(lat) && !Number.isNaN(lng);
    }
    if (step === 3) {
      return true;
    }
    if (step === 4) {
      return (
        !!teamSize && parseAmenities(amenitiesStr).length > 0
      );
    }
    if (step === 5) {
      return !!normalizeTime(openTime) && !!normalizeTime(closeTime);
    }
    if (step === 6) {
      return services.some((s) => s.name.trim());
    }
    return true;
  }, [
    step,
    ownerId,
    name,
    categoryStr,
    address,
    latitude,
    longitude,
    teamSize,
    amenitiesStr,
    openTime,
    closeTime,
    services,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "flex max-h-[min(96dvh,960px)] w-[calc(100vw-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 lg:max-w-6xl"
        )}
      >
        <DialogHeader className="shrink-0 space-y-2 px-6 pt-2 pb-0 text-left sm:pt-4">
          <DialogTitle>Nuevo negocio (onboarding completo)</DialogTitle>
          <DialogDescription>
            Mismos requisitos que la app negocios: ubicación, equipo, horarios y
            al menos un servicio.
          </DialogDescription>
        </DialogHeader>

        <div className="text-muted-foreground px-6 text-xs">
          <span className="text-foreground font-medium">
            Paso {step} de {TOTAL_STEPS}
          </span>
          <span className="text-border mx-2">·</span>
          <span className="hidden sm:inline">
            {STEPS.map((label, i) => (
              <React.Fragment key={label}>
                {i > 0 ? <span className="text-border"> / </span> : null}
                <span
                  className={cn(
                    step === i + 1 && "text-foreground font-medium"
                  )}
                >
                  {label}
                </span>
              </React.Fragment>
            ))}
          </span>
          <span className="sm:hidden">{STEPS[step - 1]}</span>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-3">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Dueño (usuario negocio)</Label>
                <Select
                  value={ownerId}
                  onValueChange={(v) => setOwnerId(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.email} (#{u.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nombre del negocio</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Barbería Central"
                />
              </div>
              <div className="space-y-2">
                <Label>Categorías (separadas por coma)</Label>
                <Input
                  value={categoryStr}
                  onChange={(e) => setCategoryStr(e.target.value)}
                  placeholder="barberia, estetica"
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Dirección completa</Label>
                <Textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle, número, ciudad…"
                />
              </div>
              <div className="space-y-2">
                <Label>Mapa</Label>
                <p className="text-muted-foreground text-xs">
                  Haz clic en el mapa o arrastra el pin para fijar la ubicación.
                  Las coordenadas se rellenan solas; puedes ajustarlas abajo.
                </p>
                <LocationMapPicker
                  latitude={latitude}
                  longitude={longitude}
                  onPositionChange={(la, ln) => {
                    setLatitude(la);
                    setLongitude(ln);
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Latitud</Label>
                  <Input
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitud</Label>
                  <Input
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    inputMode="decimal"
                  />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Sitio web (opcional)</Label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                />
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="space-y-2">
                <Label>Tamaño del equipo</Label>
                <Select
                  value={teamSize}
                  onValueChange={(v) => setTeamSize(v ?? "solo")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_SIZE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amenidades (coma)</Label>
                <Textarea
                  rows={2}
                  value={amenitiesStr}
                  onChange={(e) => setAmenitiesStr(e.target.value)}
                  placeholder="wifi, aire acondicionado, estacionamiento"
                />
                <p className="text-muted-foreground text-xs">
                  Requerido para marcar onboarding completo en el backend.
                </p>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Apertura</Label>
                  <Input
                    type="time"
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cierre</Label>
                  <Input
                    type="time"
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                  />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sundayClosed}
                  onChange={(e) => setSundayClosed(e.target.checked)}
                  className="accent-foreground size-4"
                />
                Domingo cerrado
              </label>
              <p className="text-muted-foreground text-xs">
                Se aplicará Lun–Sáb el mismo horario; domingo según la casilla.
              </p>
            </>
          )}

          {step === 6 && (
            <>
              <div className="space-y-3">
                <Label>Servicios (al menos uno)</Label>
                {services.map((s, idx) => (
                  <div
                    key={idx}
                    className="border-border space-y-2 rounded-lg border p-3"
                  >
                    <Input
                      placeholder="Nombre del servicio"
                      value={s.name}
                      onChange={(e) => {
                        const next = [...services];
                        next[idx] = { ...s, name: e.target.value };
                        setServices(next);
                      }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Precio (DOP)"
                        value={s.price}
                        onChange={(e) => {
                          const next = [...services];
                          next[idx] = { ...s, price: e.target.value };
                          setServices(next);
                        }}
                      />
                      <Input
                        placeholder="Duración (min)"
                        type="number"
                        min={1}
                        value={s.duration_minutes}
                        onChange={(e) => {
                          const next = [...services];
                          next[idx] = {
                            ...s,
                            duration_minutes: e.target.value,
                          };
                          setServices(next);
                        }}
                      />
                    </div>
                    <Input
                      placeholder="Descripción (opcional)"
                      value={s.description}
                      onChange={(e) => {
                        const next = [...services];
                        next[idx] = { ...s, description: e.target.value };
                        setServices(next);
                      }}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setServices([
                      ...services,
                      {
                        name: "",
                        price: "",
                        duration_minutes: "30",
                        description: "",
                      },
                    ])
                  }
                >
                  + Añadir servicio
                </Button>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <Label>Productos (opcional)</Label>
                {products.map((p, idx) => (
                  <div
                    key={idx}
                    className="border-border flex flex-wrap gap-2 rounded-lg border p-3"
                  >
                    <Input
                      className="min-w-[120px] flex-1"
                      placeholder="Nombre"
                      value={p.name}
                      onChange={(e) => {
                        const next = [...products];
                        next[idx] = { ...p, name: e.target.value };
                        setProducts(next);
                      }}
                    />
                    <Input
                      className="w-28"
                      placeholder="Precio"
                      value={p.price}
                      onChange={(e) => {
                        const next = [...products];
                        next[idx] = { ...p, price: e.target.value };
                        setProducts(next);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setProducts(products.filter((_, i) => i !== idx))
                      }
                    >
                      Quitar
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setProducts([
                      ...products,
                      { name: "", price: "", description: "" },
                    ])
                  }
                >
                  + Añadir producto
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="border-border bg-muted/20 flex shrink-0 flex-col gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
            {step > 1 ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
              >
                Atrás
              </Button>
            ) : null}
            {step < TOTAL_STEPS ? (
              <Button
                type="button"
                disabled={!canGoNext}
                onClick={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
              >
                Siguiente
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!canGoNext || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "Creando…" : "Crear negocio"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
