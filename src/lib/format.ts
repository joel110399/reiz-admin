const dateTime = new Intl.DateTimeFormat("es-DO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("es-DO", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** «27 oct 2026, 5:40 p. m.» o «—». */
export function formatDateTime(value: string | null | undefined): string {
  const d = toDate(value);
  return d ? dateTime.format(d) : "—";
}

/** «27 oct 2026» o «—». */
export function formatDate(value: string | null | undefined): string {
  const d = toDate(value);
  return d ? dateOnly.format(d) : "—";
}

/** «hace 3 días», «hace 2 h»… para fechas pasadas. */
export function formatRelative(value: string | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const diff = (d.getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secs] of steps) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  }
  return "ahora";
}

const money = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
  currencyDisplay: "symbol",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** «RD$2,000» o «—». Los montos de Reiz están en pesos dominicanos. */
export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? money.format(n) : String(value);
}
