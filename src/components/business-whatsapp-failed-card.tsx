"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiJson } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RetryBusinessButton,
  RetryMessageButton,
  SkipInvalidBusinessButton,
  SkipMessageButton,
} from "@/components/whatsapp-failed-retry";
import { cn } from "@/lib/utils";

type FailedRow = {
  id: number;
  template_label: string;
  recipient_name: string;
  recipient_phone: string;
  error_message: string;
  created_at: string | null;
  status: string;
  can_retry?: boolean;
  can_skip?: boolean;
};

type FailedPayload = {
  count: number;
  results: FailedRow[];
  counts: { all: number; sent: number; failed: number; skipped: number };
};

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}

export function BusinessWhatsAppFailedCard({
  businessId,
}: {
  businessId: number;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["staff-evolution-messages", businessId, "failed", 1],
    queryFn: () => {
      const params = new URLSearchParams({
        business_id: String(businessId),
        status: "failed",
        page: "1",
        page_size: "8",
      });
      return apiJson<FailedPayload>(
        `/api/notifications/staff/evolution-ops/messages/?${params.toString()}`
      );
    },
    placeholderData: keepPreviousData,
  });

  const failedCount = data?.counts.failed ?? data?.count ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle>Mensajes WhatsApp fallidos</CardTitle>
          <CardDescription>
            Reenvío individual o de todos los fallidos de este negocio. Usa el
            WhatsApp del salón si está conectado.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {failedCount > 0 ? (
            <>
              <RetryBusinessButton
                businessId={businessId}
                failedCount={failedCount}
                size="sm"
              />
              <SkipInvalidBusinessButton businessId={businessId} size="sm" />
            </>
          ) : null}
          <Link
            href="/dashboard/evolution"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Ver WhatsApp
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Cargando mensajes…</p>
        ) : error ? (
          <p className="text-destructive text-sm">
            {error instanceof Error
              ? error.message
              : "No se pudo cargar el historial."}
          </p>
        ) : !data || data.results.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No hay mensajes fallidos para este negocio.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.results.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium">{row.template_label}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="destructive">Fallido</Badge>
                    {row.can_retry ? (
                      <RetryMessageButton
                        logId={row.id}
                        businessId={businessId}
                      />
                    ) : null}
                    {row.can_skip ? (
                      <SkipMessageButton
                        logId={row.id}
                        businessId={businessId}
                      />
                    ) : null}
                  </div>
                </div>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {[row.recipient_name, row.recipient_phone]
                    .filter(Boolean)
                    .join(" · ") || "Sin destinatario"}
                  {row.created_at ? ` · ${fmtWhen(row.created_at)}` : ""}
                </p>
                {row.error_message ? (
                  <p className="text-destructive mt-2 text-sm leading-snug">
                    {row.error_message}
                  </p>
                ) : null}
              </li>
            ))}
            {failedCount > data.results.length ? (
              <p className="text-muted-foreground text-xs">
                Mostrando {data.results.length} de {failedCount}. El resto se
                reenvía con el botón del negocio o en WhatsApp Evolution.
              </p>
            ) : null}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
