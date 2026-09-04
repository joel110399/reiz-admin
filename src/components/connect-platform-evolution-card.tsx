"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Smartphone } from "lucide-react";

import { apiJson } from "@/lib/api-client";
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

export type PlatformChannel = {
  connect_status?: string;
  session_ready?: boolean;
  instance?: string;
  pairing_phone?: string;
  pairing_code?: string;
  whapi_phone?: string;
  connected_at?: string | null;
  detail?: string;
  ok?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  connected: "Conectado",
  waiting: "Esperando código",
  preparing: "Preparando",
  idle: "Sin vincular",
};

function staffPost<T>(path: string, body: object = {}) {
  return apiJson<T>(`/api/notifications/staff/evolution-ops/${path}/`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function ConnectPlatformEvolutionCard({
  initial,
}: {
  initial?: PlatformChannel | null;
}) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = React.useState(
    initial?.whapi_phone || initial?.pairing_phone || ""
  );
  const [force, setForce] = React.useState(false);
  const [pairing, setPairing] = React.useState<PlatformChannel | null>(
    initial ?? null
  );
  const announcedRef = React.useRef(false);

  React.useEffect(() => {
    if (!initial) return;
    setPairing((prev) => prev ?? initial);
    if (!phone) setPhone(initial.whapi_phone || initial.pairing_phone || "");
  }, [initial, phone]);

  const connectMutation = useMutation({
    mutationFn: () =>
      staffPost<PlatformChannel>("connect-platform", { phone, force }),
    onSuccess: (payload) => {
      announcedRef.current = false;
      setPairing(payload);
      toast.success(payload.detail || "Vinculación iniciada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => staffPost<PlatformChannel>("disconnect-platform"),
    onSuccess: (payload) => {
      setPairing(payload);
      toast.success(payload.detail || "Desconectado");
      void queryClient.invalidateQueries({ queryKey: ["staff-evolution-ops"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const shouldPoll = Boolean(
    pairing &&
      !pairing.session_ready &&
      pairing.connect_status &&
      pairing.connect_status !== "connected" &&
      pairing.connect_status !== "idle"
  );

  const pollQuery = useQuery({
    queryKey: ["staff-evolution-refresh-platform"],
    queryFn: () => staffPost<PlatformChannel>("refresh-platform"),
    enabled: shouldPoll,
    refetchInterval: shouldPoll ? 3000 : false,
  });

  React.useEffect(() => {
    if (!pollQuery.data) return;
    setPairing(pollQuery.data);
    if (
      (pollQuery.data.session_ready ||
        pollQuery.data.connect_status === "connected") &&
      !announcedRef.current
    ) {
      announcedRef.current = true;
      toast.success("Número de Reiz conectado. Los recordatorios ya no usan Whapi.");
      void queryClient.invalidateQueries({ queryKey: ["staff-evolution-ops"] });
    }
  }, [pollQuery.data, queryClient]);

  const status = pairing?.connect_status || "";
  const code = pairing?.pairing_code || "";
  const connected = Boolean(pairing?.session_ready || status === "connected");

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
          <Smartphone className="size-4" />
          Número de Reiz (recordatorios)
        </CardTitle>
        <CardDescription>
          Este es el WhatsApp interno. Los mensajes que antes salían por Whapi
          salen por aquí cuando esté conectado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="platform-phone">Número de WhatsApp (con país)</Label>
          <Input
            id="platform-phone"
            placeholder="18495955771"
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={connectMutation.isPending || !phone.trim()}
            onClick={() => connectMutation.mutate()}
          >
            {connectMutation.isPending ? "Preparando…" : "Generar código"}
          </Button>
          {connected || pairing?.instance ? (
            <Button
              type="button"
              variant="outline"
              disabled={disconnectMutation.isPending}
              onClick={() => disconnectMutation.mutate()}
            >
              {disconnectMutation.isPending ? "Cerrando…" : "Desconectar"}
            </Button>
          ) : null}
        </div>

        {pairing ? (
          <div className="space-y-3 rounded-lg border border-foreground/10 px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={connected ? "default" : "secondary"}>
                {STATUS_LABEL[status] || status || "En curso"}
              </Badge>
              {pairing.instance ? (
                <span className="text-muted-foreground font-mono text-xs">
                  {pairing.instance}
                </span>
              ) : null}
              {pollQuery.isFetching ? (
                <span className="text-muted-foreground text-xs">Consultando…</span>
              ) : null}
            </div>
            {code ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">
                  En el teléfono de Reiz: WhatsApp → Dispositivos vinculados →
                  Vincular con el número de teléfono.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-2xl font-semibold tracking-widest">
                    {code}
                  </p>
                  <Button type="button" size="xs" variant="outline" onClick={() => void copyCode()}>
                    <Copy className="size-3.5" />
                    Copiar
                  </Button>
                </div>
              </div>
            ) : connected ? (
              <p className="text-sm">
                Conectado{pairing.whapi_phone ? ` · ${pairing.whapi_phone}` : ""}.
                Los recordatorios salen por Evolution.
              </p>
            ) : status && status !== "idle" ? (
              <p className="text-muted-foreground text-sm">
                El código aparece en unos segundos.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
