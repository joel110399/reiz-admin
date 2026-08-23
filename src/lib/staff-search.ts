import { apiFetch, apiJson } from "./api-client";
import type { Paginated } from "@/types/drf";
import type { CaseKind } from "./recent-cases";

export type SearchHit = {
  kind: CaseKind;
  id: number;
  title: string;
  subtitle: string;
  href: string;
};

export type BookingHit = {
  id: number;
  date?: string;
  start_time?: string;
  status?: string;
  notes?: string | null;
  business?: number | { id: number; name?: string };
  client?: number | { id: number; name?: string } | null;
};

export type BusinessHit = {
  id: number;
  name: string;
  slug?: string | null;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean;
};

export type UserHit = {
  id: number;
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  is_staff?: boolean;
  is_active?: boolean;
};

export type ClientHit = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  business?: number;
  business_name?: string;
};

export async function tryJson<T>(path: string): Promise<T | null> {
  try {
    const res = await apiFetch(path);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function searchPage<T>(path: string): Promise<T[]> {
  try {
    const data = await apiJson<Paginated<T>>(path);
    return data.results ?? [];
  } catch {
    return [];
  }
}

function bizName(v: number | { id: number; name?: string } | null | undefined) {
  if (v == null) return "";
  if (typeof v === "object") return v.name ?? `#${v.id}`;
  return `#${v}`;
}

function clientName(v: number | { id: number; name?: string } | null | undefined) {
  if (v == null) return "sin cliente";
  if (typeof v === "object") return v.name ?? `#${v.id}`;
  return `#${v}`;
}

export function bookingToHit(b: BookingHit): SearchHit {
  return {
    kind: "booking",
    id: b.id,
    title: `Reserva #${b.id}`,
    subtitle: [b.date, clientName(b.client), bizName(b.business), b.status]
      .filter(Boolean)
      .join(" · "),
    href: `/dashboard/reservas/${b.id}`,
  };
}

export function businessToHit(b: BusinessHit): SearchHit {
  return {
    kind: "business",
    id: b.id,
    title: b.name,
    subtitle: [b.slug, b.email, b.phone].filter(Boolean).join(" · ") || `#${b.id}`,
    href: `/dashboard/negocios/${b.id}`,
  };
}

export function userToHit(u: UserHit): SearchHit {
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
  return {
    kind: "user",
    id: u.id,
    title: name || u.email || u.username || `Usuario #${u.id}`,
    subtitle: [u.email, u.role].filter(Boolean).join(" · "),
    href: `/dashboard/usuarios/${u.id}`,
  };
}

export function clientToHit(c: ClientHit): SearchHit {
  return {
    kind: "client",
    id: c.id,
    title: c.name,
    subtitle: [c.email, c.phone, c.business_name].filter(Boolean).join(" · ") || `#${c.id}`,
    href: `/dashboard/clientes/${c.id}`,
  };
}

export async function resolveStaffQuery(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  const add = (hit: SearchHit) => {
    const key = `${hit.kind}:${hit.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    hits.push(hit);
  };

  const isId = /^\d+$/.test(q);
  const encoded = encodeURIComponent(q);

  const lookups: Promise<void>[] = [];

  if (isId) {
    lookups.push(
      tryJson<BookingHit>(`/api/bookings/${q}/`).then((b) => {
        if (b) add(bookingToHit(b));
      }),
      tryJson<BusinessHit>(`/api/businesses/${q}/`).then((b) => {
        if (b) add(businessToHit(b));
      }),
      tryJson<UserHit>(`/api/auth/staff/users/${q}/`).then((u) => {
        if (u) add(userToHit(u));
      }),
      tryJson<ClientHit>(`/api/bookings/clients/${q}/`).then((c) => {
        if (c) add(clientToHit(c));
      })
    );
  }

  lookups.push(
    searchPage<BookingHit>(`/api/bookings/?search=${encoded}&page_size=5`).then(
      (rows) => rows.forEach((r) => add(bookingToHit(r)))
    ),
    searchPage<BusinessHit>(`/api/businesses/?search=${encoded}&limit=5`).then(
      (rows) => rows.forEach((r) => add(businessToHit(r)))
    ),
    searchPage<UserHit>(
      `/api/auth/staff/users/?search=${encoded}&page_size=5`
    ).then((rows) => rows.forEach((r) => add(userToHit(r)))),
    searchPage<ClientHit>(
      `/api/bookings/clients/?search=${encoded}&page_size=5`
    ).then((rows) => rows.forEach((r) => add(clientToHit(r))))
  );

  await Promise.all(lookups);
  return hits;
}
