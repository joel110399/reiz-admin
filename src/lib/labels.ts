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
