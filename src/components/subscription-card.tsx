"use client";

import { useQuery } from "@tanstack/react-query";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiJson } from "@/lib/api-client";

type Billing = {
  enabled: boolean;
  plan: string;
  plan_name?: string;
  status: string;
  amount: string;
  due_date_display: string;
  store_name: string;
  revenuecat_app_user_id: string;
};

const STATUS_LABEL: Record<string, string> = {
  none: "Sin suscripción",
  trialing: "Prueba",
  active: "Al día",
  past_due: "Pago fallido",
  grace_period: "Gracia",
  suspended: "Pausado",
};

export function SubscriptionCard({ businessId }: { businessId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["subscription", businessId],
    queryFn: () => apiJson<Billing>(`/api/businesses/${businessId}/subscription/`),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suscripción</CardTitle>
        <CardDescription>
          Apple o Google cobran la mensualidad dentro de la app. Se cancela desde la tienda del dueño.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
        {data ? (
          <>
            <p className="text-sm">
              {data.plan_name || "Gratis"}
              {" · "}
              {STATUS_LABEL[data.status] || data.status}
              {data.enabled ? ` · RD$${Number(data.amount).toLocaleString("es-DO")}` : ""}
              {data.due_date_display ? ` · renueva ${data.due_date_display}` : ""}
              {data.store_name ? ` · ${data.store_name}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              RevenueCat: {data.revenuecat_app_user_id}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
