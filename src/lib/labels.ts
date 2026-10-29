export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  no_show: "No se presentó",
  cancelled: "Cancelada",
};

export const ROLE_LABEL: Record<string, string> = {
  business: "Negocio",
  client: "Cliente",
  staff: "Staff",
  admin: "Admin",
};

export function bookingStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return BOOKING_STATUS_LABEL[status] ?? status;
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABEL[role] ?? role;
}

export const BUSINESS_CATEGORIES: { value: string; label: string }[] = [
  { value: "salon_belleza", label: "Salón" },
  { value: "barberia", label: "Barbería" },
  { value: "spa", label: "Spa" },
  { value: "estetica", label: "Estética" },
  { value: "uñas", label: "Uñas" },
  { value: "Makeup", label: "Maquillaje" },
  { value: "brows_lashes", label: "Cejas y pestañas" },
  { value: "trenzas", label: "Trenzas" },
  { value: "dentista", label: "Dentista" },
  { value: "tatuajes", label: "Tatuajes" },
  { value: "otros", label: "Otros" },
];

const BUSINESS_CATEGORY_LABEL: Record<string, string> = {
  ...Object.fromEntries(BUSINESS_CATEGORIES.map((c) => [c.value, c.label])),
  other: "Otros",
  nails: "Uñas",
  makeup: "Maquillaje",
};

export function businessCategoryLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (!trimmed) return "—";
  return (
    BUSINESS_CATEGORY_LABEL[trimmed] ??
    BUSINESS_CATEGORY_LABEL[trimmed.toLowerCase()] ??
    trimmed.replace(/_/g, " ")
  );
}

export function formatBusinessCategories(category: unknown): string {
  const values = Array.isArray(category)
    ? category.map((item) => String(item))
    : category
      ? [String(category)]
      : [];
  const labels = values.map((value) => businessCategoryLabel(value)).filter((label) => label !== "—");
  return labels.length > 0 ? labels.join(", ") : "—";
}

export function timeShort(t: string | undefined | null): string {
  if (!t) return "—";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export function initialsFrom(name: string | null | undefined): string {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "R";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
