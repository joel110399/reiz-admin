"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Link2 } from "lucide-react";

import { apiJson } from "@/lib/api-client";
import type { Paginated } from "@/types/drf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type BusinessHit = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
};

type PairingPayload = {
  ok?: boolean;
  detail?: string;
  connect_status?: string;
  session_ready?: boolean;
  pairing_code?: string;
  pairing_phone?: string;
  whapi_phone?: string;
};

const STATUS_LABEL: Record<string, string> = {
  connected: "Conectado",
  waiting: "Esperando código",
  preparing: "Preparando",
  idle: "Sin vincular",
};

function staffPost<T>(path: string, body: object) {
  return apiJson<T>(`/api/notifications/staff/evolution-ops/${path}/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function ConnectEvolutionCard({
  businessId,
  businessName,
  defaultPhone = "",
}: {
  businessId?: number;
  businessName?: string;
  defaultPhone?: string;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [picked, setPicked] = React.useState<BusinessHit | null>(
    businessId
      ? { id: businessId, name: businessName || `Negocio ${businessId}`, phone: defaultPhone }
      : null
  );
  const [phone, setPhone] = React.useState(defaultPhone);
  const [force, setForce] = React.useState(false);
  const [pairing, setPairing] = React.useState<PairingPayload | null>(null);
  const announcedRef = React.useRef(false);

  React.useEffect(() => {
    if (businessId) {
      setPicked({
        id: businessId,
        name: businessName || `Negocio ${businessId}`,
        phone: defaultPhone,
      });
      if (defaultPhone && !phone) setPhone(defaultPhone);
    }
  }, [businessId, businessName, defaultPhone, phone]);

  const searchQuery = useQuery({
    queryKey: ["staff-business-search", search],
    queryFn: () =>
      apiJson<Paginated<BusinessHit> | BusinessHit[]>(
        `/api/businesses/?search=${encodeURIComponent(search)}&limit=8`
      ),
    enabled: !businessId && search.trim().length >= 2,
  });

  const hits: BusinessHit[] = React.useMemo(() => {
    const data = searchQuery.data;
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return data.results ?? [];
  }, [searchQuery.data]);

  const connectMutation = useMutation({
    mutationFn: () => {
      if (!picked) throw new Error("Elige un negocio.");
      return staffPost<PairingPayload>("connect", {
        business_id: picked.id,
        phone,
        force,
      });
    },
    onSuccess: (payload) => {
      announcedRef.current = false;
      setPairing(payload);
      toast.success(payload.detail || "Vinculación iniciada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const pairingId = picked?.id;
  const shouldPoll = Boolean(
    pairingId &&
      pairing &&
      !pairing.session_ready &&
      pairing.connect_status !== "connected"
  );

  const pollQuery = useQuery({
    queryKey: ["staff-evolution-refresh-pairing", pairingId],
    queryFn: () =>
      staffPost<PairingPayload>("refresh-pairing", { business_id: pairingId }),
    enabled: shouldPoll,
    refetchInterval: shouldPoll ? 3000 : false,
  });

  React.useEffect(() => {
    if (!pollQuery.data) return;
    setPairing((prev) => ({ ...prev, ...pollQuery.data }));
    if (
      (pollQuery.data.session_ready || pollQuery.data.connect_status === "connected") &&
      !announcedRef.current
    ) {
      announcedRef.current = true;
      toast.success("WhatsApp conectado por Evolution. Ya no usa Whapi.");
      void queryClient.invalidateQueries({ queryKey: ["staff-evolution-ops"] });
    }
  }, [pollQuery.data, queryClient]);

  const status = pairing?.connect_status || "";
  const code = pairing?.pairing_code || "";

  function pickBusiness(row: BusinessHit) {
    setPicked(row);
    setSearch("");
    setPairing(null);
    if (row.phone && !phone) setPhone(row.phone);
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.replace("-", ""));
      toast.success("Código copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="size-4" />
          Conectar número del negocio
        </CardTitle>
        <CardDescription>
          Vincula el WhatsApp del negocio a Evolution. Los mensajes salen con su
          número, no con el de Reiz (Whapi).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!businessId ? (
          <div className="space-y-1.5">
            <Label htmlFor="evo-biz-search">Negocio</Label>
            {picked ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{picked.name}</p>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setPicked(null);
                    setPairing(null);
                  }}
                >
                  Cambiar
                </Button>
              </div>
            ) : (
              <>
                <Input
                  id="evo-biz-search"
                  placeholder="Nombre, teléfono o email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {hits.length > 0 ? (
                  <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/10">
                    {hits.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
                          onClick={() => pickBusiness(row)}
                        >
                          <span className="font-medium">{row.name}</span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            {[row.phone, row.email].filter(Boolean).join(" · ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <p className="text-sm font-medium">{businessName || `Negocio ${businessId}`}</p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="evo-phone">Número de WhatsApp (con país)</Label>
          <Input
            id="evo-phone"
            placeholder="+1 809 000 0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
          />
          Si ya está conectado, reemplazar el número
        </label>

        <Button
          type="button"
          disabled={connectMutation.isPending || !picked || !phone.trim()}
          onClick={() => connectMutation.mutate()}
        >
          {connectMutation.isPending ? "Preparando…" : "Generar código"}
        </Button>

        {pairing ? (
          <div className="space-y-3 rounded-lg border border-foreground/10 px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  pairing.session_ready || status === "connected"
                    ? "default"
                    : "secondary"
                }
              >
                {STATUS_LABEL[status] || status || "En curso"}
              </Badge>
              {pollQuery.isFetching ? (
                <span className="text-muted-foreground text-xs">Consultando…</span>
              ) : null}
            </div>
            {code ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  En el teléfono del negocio: WhatsApp → Dispositivos vinculados →
                  Vincular con el número de teléfono. Pega este código:
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "font-mono text-2xl font-semibold tracking-widest"
                    )}
                  >
                    {code}
                  </p>
                  <Button type="button" size="xs" variant="outline" onClick={() => void copyCode()}>
                    <Copy className="size-3.5" />
                    Copiar
                  </Button>
                </div>
              </div>
            ) : pairing.session_ready ? (
              <p className="text-sm">
                Conectado
                {pairing.whapi_phone ? ` · ${pairing.whapi_phone}` : ""}.
                Los envíos ya no pasan por Whapi.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                El código aparece en unos segundos. Si no sale, pulsa Generar de
                nuevo.
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
