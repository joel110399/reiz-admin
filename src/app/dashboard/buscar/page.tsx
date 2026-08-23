"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Clock,
  Loader2,
  Search,
  UserCircle2,
  Users,
} from "lucide-react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CASE_KIND_LABEL, getRecentCases, pushRecentCase } from "@/lib/recent-cases";
import {
  resolveStaffQuery,
  type SearchHit,
} from "@/lib/staff-search";
import { cn } from "@/lib/utils";

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

export default function BuscarPage() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [recent, setRecent] = React.useState(() => getRecentCases());
  const debounced = useDebounced(query, 280);

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
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const openHit = (hit: SearchHit) => {
    if (hit.id > 0) {
      pushRecentCase({
        kind: hit.kind,
        id: hit.id,
        label: hit.title,
        href: hit.href,
      });
      setRecent(getRecentCases());
    }
    router.push(hit.href);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="space-y-2">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Mesa de soporte
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Resolver un caso
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Busca por ID, email, teléfono o nombre. Abre la ficha y confirma,
          reprograma, fusiona clientes o ajusta el negocio.
        </p>
      </header>

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ej. 1842, 809…, ana@salon.com, Studio Glow"
          className="bg-card h-12 pl-10 text-base shadow-sm"
          autoFocus
          autoComplete="off"
        />
        {loading ? (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin" />
        ) : null}
      </div>

      {query.trim() ? (
        <section className="space-y-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Resultados
          </p>
          {hits.length === 0 && !loading ? (
            <Card className="shadow-none">
              <CardContent className="text-muted-foreground py-10 text-center text-sm">
                Sin coincidencias. Prueba el ID numérico o un email exacto.
              </CardContent>
            </Card>
          ) : (
            <ul className="grid gap-2">
              {hits.map((hit) => {
                const Icon = KIND_ICON[hit.kind];
                return (
                  <li key={`${hit.kind}-${hit.id}`}>
                    <button
                      type="button"
                      onClick={() => openHit(hit)}
                      className="bg-card hover:bg-accent/50 ring-foreground/8 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left shadow-sm ring-1 transition-colors"
                    >
                      <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {hit.title}
                        </span>
                        <span className="text-muted-foreground block truncate text-sm">
                          {hit.subtitle}
                        </span>
                      </span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {CASE_KIND_LABEL[hit.kind]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <>
          {recent.length > 0 ? (
            <section className="space-y-3">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <Clock className="size-3.5" />
                Recientes
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {recent.map((c) => (
                  <li key={`${c.kind}-${c.id}`}>
                    <Link
                      href={c.href}
                      className="bg-card hover:bg-accent/40 ring-foreground/8 block rounded-xl px-4 py-3 no-underline shadow-sm ring-1"
                    >
                      <p className="truncate text-sm font-medium">{c.label}</p>
                      <p className="text-muted-foreground text-xs">
                        {CASE_KIND_LABEL[c.kind]} #{c.id}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2">
            {[
              {
                href: "/dashboard/reservas?status=pending",
                title: "Reservas pendientes",
                desc: "Confirmar, reprogramar o cancelar",
                icon: CalendarDays,
              },
              {
                href: "/dashboard/clientes",
                title: "Fusionar clientes",
                desc: "Duplicados por teléfono o email",
                icon: UserCircle2,
              },
              {
                href: "/dashboard/negocios",
                title: "Negocio o POS",
                desc: "Activar caja, adelantos o Goldie",
                icon: Building2,
              },
              {
                href: "/dashboard/usuarios",
                title: "Cuenta de usuario",
                desc: "Dueño, staff o acceso",
                icon: Users,
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "bg-card hover:bg-accent/40 ring-foreground/8 flex items-start gap-3 rounded-xl p-4 no-underline shadow-sm ring-1"
                )}
              >
                <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                  <item.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {item.desc}
                  </span>
                </span>
              </Link>
            ))}
          </section>
        </>
      )}

      <p className="text-muted-foreground text-center text-xs">
        También puedes abrir la búsqueda global con{" "}
        <kbd className="rounded border px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </p>
    </div>
  );
}
