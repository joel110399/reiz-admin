"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  Search,
  Sparkles,
  UserCircle2,
  Users,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CASE_KIND_LABEL, getRecentCases, pushRecentCase } from "@/lib/recent-cases";
import { resolveStaffQuery, type SearchHit } from "@/lib/staff-search";
import { cn } from "@/lib/utils";

const NAV_HITS: SearchHit[] = [
  {
    kind: "booking",
    id: 0,
    title: "Resolver casos",
    subtitle: "Buscar reserva, negocio, usuario o cliente",
    href: "/dashboard/buscar",
  },
  {
    kind: "booking",
    id: 0,
    title: "Reservas",
    subtitle: "Confirmar, reprogramar o cancelar",
    href: "/dashboard/reservas",
  },
  {
    kind: "business",
    id: 0,
    title: "Negocios",
    subtitle: "Ficha, POS, adelantos e importación",
    href: "/dashboard/negocios",
  },
  {
    kind: "client",
    id: 0,
    title: "Clientes",
    subtitle: "Editar, fusionar o historial",
    href: "/dashboard/clientes",
  },
  {
    kind: "user",
    id: 0,
    title: "Usuarios",
    subtitle: "Cuentas y dueños",
    href: "/dashboard/usuarios",
  },
  {
    kind: "booking",
    id: 0,
    title: "Resumen",
    subtitle: "Métricas operativas",
    href: "/dashboard",
  },
  {
    kind: "booking",
    id: 0,
    title: "Novedades",
    subtitle: "Avisos in-app",
    href: "/dashboard/novedades",
  },
  {
    kind: "booking",
    id: 0,
    title: "WhatsApp Evolution",
    subtitle: "Instancias, fallos y reenvío",
    href: "/dashboard/evolution",
  },
];

const KIND_ICON = {
  booking: CalendarDays,
  business: Building2,
  user: Users,
  client: UserCircle2,
};

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [recent, setRecent] = React.useState(() => getRecentCases());
  const debounced = useDebounced(query, 280);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setHits([]);
      setActive(0);
      setRecent(getRecentCases());
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  React.useEffect(() => {
    let cancelled = false;
    const q = debounced.trim();
    if (!q) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void resolveStaffQuery(q).then((rows) => {
      if (cancelled) return;
      setHits(rows);
      setActive(0);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const items = React.useMemo(() => {
    if (query.trim()) return hits;
    const recents: SearchHit[] = recent.map((c) => ({
      kind: c.kind,
      id: c.id,
      title: c.label,
      subtitle: CASE_KIND_LABEL[c.kind],
      href: c.href,
    }));
    return [...recents, ...NAV_HITS];
  }, [hits, query, recent]);

  const go = React.useCallback(
    (hit: SearchHit) => {
      if (hit.id > 0) {
        pushRecentCase({
          kind: hit.kind,
          id: hit.id,
          label: hit.title,
          href: hit.href,
        });
      }
      onOpenChange(false);
      router.push(hit.href);
    },
    [onOpenChange, router]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      go(items[active]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
        onKeyDown={onKeyDown}
      >
        <DialogTitle className="sr-only">Buscar en Reiz Admin</DialogTitle>
        <DialogDescription className="sr-only">
          Busca reservas, negocios, usuarios o clientes por ID, nombre, email o
          teléfono.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ID, email, teléfono, nombre…"
            className="h-12 border-0 bg-transparent shadow-none focus-visible:ring-0"
            autoComplete="off"
          />
          {loading ? (
            <Loader2 className="text-muted-foreground size-4 animate-spin" />
          ) : (
            <kbd className="text-muted-foreground hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline">
              ESC
            </kbd>
          )}
        </div>
        <div className="max-h-[min(420px,55vh)] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              {loading
                ? "Buscando…"
                : query.trim()
                  ? "Sin coincidencias. Prueba un ID o un email."
                  : "Escribe para resolver un caso."}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {!query.trim() && recent.length > 0 ? (
                <li className="text-muted-foreground px-2 py-1.5 text-[11px] font-medium tracking-wide uppercase">
                  Recientes
                </li>
              ) : null}
              {items.map((hit, i) => {
                const Icon =
                  hit.id === 0
                    ? hit.href === "/dashboard"
                      ? LayoutDashboard
                      : hit.href.includes("novedades")
                        ? Sparkles
                        : hit.href.includes("evolution")
                          ? MessageCircle
                          : hit.href.includes("buscar")
                            ? Search
                            : KIND_ICON[hit.kind]
                    : KIND_ICON[hit.kind];
                const showNavLabel =
                  !query.trim() && i === recent.length && recent.length > 0;
                return (
                  <React.Fragment key={`${hit.href}-${hit.kind}-${hit.id}-${i}`}>
                    {showNavLabel ? (
                      <li className="text-muted-foreground px-2 pt-2 pb-1.5 text-[11px] font-medium tracking-wide uppercase">
                        Ir a
                      </li>
                    ) : null}
                    <li>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(hit)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm",
                          i === active
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-muted/70"
                        )}
                      >
                        <span className="bg-background text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md border">
                          <Icon className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {hit.title}
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {hit.subtitle}
                          </span>
                        </span>
                        {hit.id > 0 ? (
                          <span className="text-muted-foreground shrink-0 text-[10px] uppercase">
                            {CASE_KIND_LABEL[hit.kind]}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  </React.Fragment>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable=true]")) {
        if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return { open, setOpen };
}
