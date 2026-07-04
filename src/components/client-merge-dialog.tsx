"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitMerge } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, apiJson, formatApiErrorBody } from "@/lib/api-client";

export type ClientMergeTarget = {
  id: number;
  name: string;
  phone?: string | null;
  email?: string | null;
  business?: number;
  business_name?: string;
  total_bookings?: number;
};

type MergePreview = {
  keep: {
    id: number;
    name: string;
    phone?: string | null;
    email?: string | null;
    bookings: number;
    sales: number;
    receivables: number;
  };
  source: {
    id: number;
    name: string;
    phone?: string | null;
    email?: string | null;
    bookings: number;
    sales: number;
    receivables: number;
  };
};

type ClientMergeDialogProps = {
  keepClient: ClientMergeTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged?: (clientId: number) => void;
};

function contactLine(client: ClientMergeTarget | MergePreview["source"]) {
  const parts = [client.phone, client.email].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Sin teléfono ni email";
}

export function ClientMergeDialog({
  keepClient,
  open,
  onOpenChange,
  onMerged,
}: ClientMergeDialogProps) {
  const qc = useQueryClient();
  const [sourceId, setSourceId] = React.useState("");
  const [manualSourceId, setManualSourceId] = React.useState("");

  const effectiveSourceId = sourceId || manualSourceId.trim();

  React.useEffect(() => {
    if (!open) {
      setSourceId("");
      setManualSourceId("");
    }
  }, [open]);

  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ["client-merge-candidates", keepClient.id],
    queryFn: () =>
      apiJson<ClientMergeTarget[]>(
        `/api/bookings/clients/${keepClient.id}/merge-candidates/`
      ),
    enabled: open && !!keepClient.id,
  });

  const {
    data: preview,
    isLoading: loadingPreview,
    error: previewQueryError,
  } = useQuery({
    queryKey: ["client-merge-preview", keepClient.id, effectiveSourceId],
    queryFn: () =>
      apiJson<MergePreview>(
        `/api/bookings/clients/${keepClient.id}/merge-preview/?source_id=${effectiveSourceId}`
      ),
    enabled: open && !!effectiveSourceId,
    retry: false,
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(
        `/api/bookings/clients/${keepClient.id}/merge/`,
        {
          method: "POST",
          body: JSON.stringify({ source_id: Number(effectiveSourceId) }),
        }
      );
      const text = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(text, res.statusText));
    },
    onSuccess: () => {
      toast.success("Clientes fusionados correctamente");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client-detail"] });
      qc.invalidateQueries({ queryKey: ["client-bookings"] });
      onOpenChange(false);
      onMerged?.(keepClient.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const previewError =
    previewQueryError instanceof Error ? previewQueryError.message : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fusionar clientes</DialogTitle>
          <DialogDescription>
            Se conservará el cliente principal y se eliminará el duplicado. Las
            citas, ventas y demás registros se moverán al cliente principal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="bg-muted/40 rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Cliente principal (se conserva)
            </p>
            <p className="mt-1 font-medium">
              #{keepClient.id} · {keepClient.name}
            </p>
            <p className="text-muted-foreground mt-0.5">{contactLine(keepClient)}</p>
          </div>

          <div className="space-y-2">
            <Label>Cliente duplicado (se elimina)</Label>
            {loadingCandidates ? (
              <p className="text-muted-foreground text-sm">Buscando duplicados…</p>
            ) : candidates.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No se detectaron duplicados automáticos. Ingresa el ID del otro
                cliente manualmente.
              </p>
            ) : null}
            {candidates.length > 0 ? (
              <Select
                value={sourceId}
                onValueChange={(v) => {
                  setSourceId(v ?? "");
                  setManualSourceId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el duplicado" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      #{c.id} · {c.name}
                      {c.total_bookings != null
                        ? ` · ${c.total_bookings} citas`
                        : ""}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="merge-source-id">ID del duplicado</Label>
              <Input
                id="merge-source-id"
                inputMode="numeric"
                placeholder="Ej. 44"
                value={manualSourceId}
                onChange={(e) => {
                  setManualSourceId(e.target.value);
                  setSourceId("");
                }}
              />
            </div>
          </div>

          {loadingPreview && effectiveSourceId ? (
            <p className="text-muted-foreground text-sm">Calculando vista previa…</p>
          ) : null}

          {preview ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
              <p className="font-medium">Vista previa</p>
              <ul className="text-muted-foreground mt-2 space-y-1">
                <li>
                  Se moverán{" "}
                  <strong className="text-foreground">
                    {preview.source.bookings} cita
                    {preview.source.bookings === 1 ? "" : "s"}
                  </strong>{" "}
                  de #{preview.source.id} → #{preview.keep.id}
                </li>
                {preview.source.sales > 0 ? (
                  <li>
                    {preview.source.sales} venta
                    {preview.source.sales === 1 ? "" : "s"}
                  </li>
                ) : null}
                {preview.source.receivables > 0 ? (
                  <li>
                    {preview.source.receivables} cuenta
                    {preview.source.receivables === 1 ? "" : "s"} por cobrar
                  </li>
                ) : null}
                <li>
                  Se eliminará el cliente #{preview.source.id} (
                  {contactLine(preview.source)})
                </li>
              </ul>
            </div>
          ) : null}

          {previewError ? (
            <p className="text-destructive text-sm">{previewError}</p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={
              !effectiveSourceId ||
              !preview ||
              mergeMutation.isPending ||
              loadingPreview
            }
            onClick={() => mergeMutation.mutate()}
          >
            <GitMerge className="mr-1 size-4" />
            {mergeMutation.isPending ? "Fusionando…" : "Fusionar clientes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClientMergeButton({
  client,
  onMerged,
  variant = "outline",
  size = "sm",
}: {
  client: ClientMergeTarget;
  onMerged?: (clientId: number) => void;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "icon" | "default";
}) {
  const [open, setOpen] = React.useState(false);

  if (size === "icon") {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Fusionar cliente"
          onClick={() => setOpen(true)}
        >
          <GitMerge className="size-4" />
        </Button>
        <ClientMergeDialog
          keepClient={client}
          open={open}
          onOpenChange={setOpen}
          onMerged={onMerged}
        />
      </>
    );
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <GitMerge className="mr-1 size-4" />
        Fusionar
      </Button>
      <ClientMergeDialog
        keepClient={client}
        open={open}
        onOpenChange={setOpen}
        onMerged={onMerged}
      />
    </>
  );
}
