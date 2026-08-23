export type CaseKind = "booking" | "business" | "user" | "client";

export type RecentCase = {
  kind: CaseKind;
  id: number;
  label: string;
  href: string;
  at: number;
};

const KEY = "reiz-admin-recent-cases";
const MAX = 8;

export function getRecentCases(): RecentCase[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentCase[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecentCase(item: Omit<RecentCase, "at">) {
  if (typeof window === "undefined") return;
  const next: RecentCase = { ...item, at: Date.now() };
  const prev = getRecentCases().filter(
    (c) => !(c.kind === next.kind && c.id === next.id)
  );
  window.localStorage.setItem(KEY, JSON.stringify([next, ...prev].slice(0, MAX)));
}

export const CASE_KIND_LABEL: Record<CaseKind, string> = {
  booking: "Reserva",
  business: "Negocio",
  user: "Usuario",
  client: "Cliente",
};
