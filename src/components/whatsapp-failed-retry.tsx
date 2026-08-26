"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";

import { apiJson } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export type RetryMessageRow = {
  id: number;
  status: string;
  can_retry?: boolean;
};

export type RetryBusinessResult = {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
  detail: string;
};

const OPS_KEY = ["staff-evolution-ops"] as const;
const MESSAGES_KEY = "staff-evolution-messages";

export function invalidateWhatsAppQueries(
  qc: ReturnType<typeof useQueryClient>,
  businessId?: number
) {
  void qc.invalidateQueries({ queryKey: OPS_KEY });
  void qc.invalidateQueries({
    queryKey: businessId
      ? [MESSAGES_KEY, businessId]
      : [MESSAGES_KEY],
  });
}

export function useRetryFailedMessage(businessId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (logId: number) =>
      apiJson<RetryMessageRow>(
        "/api/notifications/staff/evolution-ops/messages/retry/",
        {
          method: "POST",
          body: JSON.stringify({ log_id: logId }),
        }
      ),
    onSuccess: () => {
      toast.success("Mensaje reenviado");
      invalidateWhatsAppQueries(qc, businessId);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRetryFailedBusiness(businessId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hours?: number) =>
      apiJson<RetryBusinessResult>(
        "/api/notifications/staff/evolution-ops/messages/retry-business/",
        {
          method: "POST",
          body: JSON.stringify({
            business_id: businessId,
            ...(hours ? { hours } : {}),
          }),
        }
      ),
    onSuccess: (payload) => {
      toast.success(payload.detail || "Reenvío completado");
      invalidateWhatsAppQueries(qc, businessId);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function RetryMessageButton({
  logId,
  businessId,
  disabled,
}: {
  logId: number;
  businessId?: number;
  disabled?: boolean;
}) {
  const retry = useRetryFailedMessage(businessId);
  return (
    <Button
      type="button"
      size="xs"
      variant="outline"
      disabled={disabled || retry.isPending}
      onClick={(event) => {
        event.stopPropagation();
        retry.mutate(logId);
      }}
    >
      <Send className="size-3" />
      {retry.isPending ? "Enviando…" : "Reenviar"}
    </Button>
  );
}

export function RetryBusinessButton({
  businessId,
  failedCount,
  hours,
  size = "xs",
  variant = "outline",
}: {
  businessId: number;
  failedCount?: number;
  hours?: number;
  size?: "xs" | "sm";
  variant?: "outline" | "default";
}) {
  const retry = useRetryFailedBusiness(businessId);
  const [confirm, setConfirm] = React.useState(false);
  const label =
    failedCount === 1
      ? "Reenviar 1 fallido"
      : failedCount && failedCount > 1
        ? `Reenviar ${failedCount} fallidos`
        : "Reenviar fallidos";

  if (!confirm) {
    return (
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={retry.isPending || failedCount === 0}
        onClick={(event) => {
          event.stopPropagation();
          setConfirm(true);
        }}
      >
        <RotateCcw className="size-3" />
        {label}
      </Button>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      onClick={(event) => event.stopPropagation()}
    >
      <p className="text-muted-foreground text-xs">
        {hours
          ? `Reenvía los fallidos de las últimas ${hours} h por el WhatsApp de Reiz.`
          : "Reenvía los fallidos de este negocio por el WhatsApp de Reiz."}
      </p>
      <Button
        type="button"
        size={size}
        variant="outline"
        disabled={retry.isPending}
        onClick={() => setConfirm(false)}
      >
        Cancelar
      </Button>
      <Button
        type="button"
        size={size}
        disabled={retry.isPending}
        onClick={() =>
          retry.mutate(hours, {
            onSuccess: () => setConfirm(false),
          })
        }
      >
        <RotateCcw className="size-3" />
        {retry.isPending ? "Reenviando…" : "Sí, reenviar"}
      </Button>
    </div>
  );
}
