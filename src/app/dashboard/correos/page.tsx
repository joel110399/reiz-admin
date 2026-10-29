"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Loader2,
  Mail,
  Monitor,
  Moon,
  Search,
  Send,
  Smartphone,
  Sun,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { PaginatedTable } from "@/components/paginated-table";
import { RoleBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiJson } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { initialsFrom } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Paginated } from "@/types/drf";

type EmailTemplate = {
  key: string;
  name: string;
  description: string;
  category: string;
  subject: string;
};

type TemplatesResponse = {
  templates: EmailTemplate[];
  defaults: { fecha_limite: string };
  max_recipients: number;
};

type Recipient = {
  id: number;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
};

type EmailLogRow = {
  id: number;
  template_key: string;
  subject: string;
  recipient: number | null;
  recipient_email: string;
  sent_by_email: string | null;
  status: "sent" | "failed";
  error_message: string;
  created_at: string;
};

type SendResponse = { sent: number; failed: number; results: EmailLogRow[] };

function recipientName(u: Recipient) {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || u.email;
}

function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2.5 text-base">
      <span className="bg-accent text-accent-foreground flex size-6 items-center justify-center rounded-full text-xs font-semibold">
        {n}
      </span>
      {children}
    </CardTitle>
  );
}

export default function CorreosPage() {
  return (
    <React.Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <CorreosContent />
    </React.Suspense>
  );
}

function CorreosContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const presetUserId = searchParams.get("user");

  const [tab, setTab] = React.useState("enviar");
  const [selectedKey, setTemplateKey] = React.useState<string | null>(null);
  const [recipients, setRecipients] = React.useState<Recipient[]>([]);
  const [deadlineInput, setDeadline] = React.useState<string | null>(null);
  const [previewUserId, setPreviewUserId] = React.useState<number | null>(null);
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const [scheme, setScheme] = React.useState<"light" | "dark">("light");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["staff-email-templates"],
    queryFn: () => apiJson<TemplatesResponse>("/api/auth/staff/email-templates/"),
  });

  const templateKey = selectedKey ?? catalog?.templates[0]?.key ?? null;
  const deadline = deadlineInput ?? catalog?.defaults.fecha_limite ?? "";

  // Abrir con un destinatario ya elegido: /dashboard/correos?user=12
  useQuery({
    queryKey: ["staff-email-preset-user", presetUserId],
    queryFn: async () => {
      const u = await apiJson<Recipient>(`/api/auth/staff/users/${presetUserId}/`);
      setRecipients((list) => (list.some((x) => x.id === u.id) ? list : [u, ...list]));
      return u;
    },
    enabled: !!presetUserId,
    staleTime: Infinity,
  });

  const effectivePreviewId =
    previewUserId && recipients.some((u) => u.id === previewUserId)
      ? previewUserId
      : recipients[0]?.id ?? null;

  const template = catalog?.templates.find((t) => t.key === templateKey);
  const maxRecipients = catalog?.max_recipients ?? 50;

  const preview = useQuery({
    queryKey: ["staff-email-preview", templateKey, effectivePreviewId, deadline],
    queryFn: () =>
      apiJson<{ subject: string; html: string }>(
        `/api/auth/staff/email-templates/${templateKey}/preview/`,
        {
          method: "POST",
          body: JSON.stringify({
            user_id: effectivePreviewId,
            variables: { fecha_limite: deadline },
          }),
        }
      ),
    enabled: !!templateKey && !!deadline,
    placeholderData: (prev) => prev,
  });

  const send = useMutation({
    mutationFn: () =>
      apiJson<SendResponse>(`/api/auth/staff/email-templates/${templateKey}/send/`, {
        method: "POST",
        body: JSON.stringify({
          user_ids: recipients.map((u) => u.id),
          variables: { fecha_limite: deadline },
        }),
      }),
    onSuccess: (res) => {
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["staff-email-log"] });
      if (res.sent) {
        toast.success(
          res.sent === 1 ? "Correo enviado" : `${res.sent} correos enviados`
        );
      }
      const failed = res.results.filter((r) => r.status === "failed");
      if (failed.length) {
        toast.error(`No se pudo enviar a ${failed.length}`, {
          description: failed.map((f) => f.recipient_email).join(", "),
        });
        const failedIds = new Set(failed.map((f) => f.recipient));
        setRecipients((list) => list.filter((u) => failedIds.has(u.id)));
      } else {
        setRecipients([]);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addRecipient(u: Recipient) {
    if (recipients.length >= maxRecipients) {
      toast.error(`Máximo ${maxRecipients} destinatarios por envío`);
      return;
    }
    setRecipients((list) => (list.some((x) => x.id === u.id) ? list : [...list, u]));
  }

  function removeRecipient(id: number) {
    setRecipients((list) => list.filter((u) => u.id !== id));
  }

  const canSend = !!template && recipients.length > 0 && !!deadline;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Mail}
        title="Correos"
        description="Envía plantillas de correo a los usuarios que elijas. Cada envío queda en el historial."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList className="mb-2">
          <TabsTrigger value="enviar">Enviar</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="enviar">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <StepTitle n={1}>Plantilla</StepTitle>
                </CardHeader>
                <CardContent className="grid gap-2" role="radiogroup" aria-label="Plantilla">
                  {catalogLoading
                    ? [0, 1].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)
                    : catalog?.templates.map((t) => {
                        const selected = t.key === templateKey;
                        return (
                          <button
                            key={t.key}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setTemplateKey(t.key)}
                            className={cn(
                              "group relative rounded-xl border p-3.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                              selected
                                ? "border-primary bg-accent/60 ring-1 ring-primary"
                                : "hover:border-black/15 dark:hover:border-white/20"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium">{t.name}</p>
                              <span
                                className={cn(
                                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                                  selected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border"
                                )}
                              >
                                {selected ? <Check className="size-3" /> : null}
                              </span>
                            </div>
                            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                              {t.description}
                            </p>
                            <Badge variant="secondary" className="mt-2">
                              {t.category}
                            </Badge>
                          </button>
                        );
                      })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <StepTitle n={2}>Destinatarios</StepTitle>
                  <CardDescription>
                    Busca por nombre o correo. Hasta {maxRecipients} por envío.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <RecipientSearch
                    selectedIds={recipients.map((u) => u.id)}
                    onAdd={addRecipient}
                  />
                  {recipients.length === 0 ? (
                    <p className="text-muted-foreground rounded-xl border border-dashed px-3 py-4 text-center text-sm">
                      Todavía no elegiste a nadie.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {recipients.length} seleccionado
                          {recipients.length === 1 ? "" : "s"}
                        </span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setRecipients([])}
                        >
                          Quitar todos
                        </button>
                      </div>
                      <ul className="flex flex-wrap gap-1.5">
                        {recipients.map((u) => (
                          <li
                            key={u.id}
                            className="bg-secondary flex max-w-full items-center gap-1.5 rounded-full py-0.5 pr-1 pl-2.5 text-xs"
                          >
                            <span className="truncate" title={u.email}>
                              {recipientName(u)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeRecipient(u.id)}
                              className="text-muted-foreground hover:bg-background hover:text-foreground rounded-full p-0.5"
                              aria-label={`Quitar a ${recipientName(u)}`}
                            >
                              <X className="size-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <StepTitle n={3}>Datos del correo</StepTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  <Label htmlFor="fecha-limite">Fecha límite del regalo</Label>
                  <Input
                    id="fecha-limite"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    Último día para suscribirse con el mes extra gratis. El
                    nombre, el negocio y las cifras se llenan solos para cada
                    persona.
                  </p>
                </CardContent>
              </Card>

              <Button
                size="lg"
                className="w-full"
                disabled={!canSend}
                onClick={() => setConfirmOpen(true)}
              >
                <Send />
                {recipients.length
                  ? `Enviar a ${recipients.length} ${recipients.length === 1 ? "persona" : "personas"}`
                  : "Elige a quién enviarlo"}
              </Button>
            </div>

            <Card className="xl:sticky xl:top-20">
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">Vista previa</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Segmented
                      value={device}
                      onChange={setDevice}
                      options={[
                        ["desktop", Monitor, "Escritorio"],
                        ["mobile", Smartphone, "Móvil"],
                      ]}
                    />
                    <Segmented
                      value={scheme}
                      onChange={setScheme}
                      options={[
                        ["light", Sun, "Claro"],
                        ["dark", Moon, "Oscuro"],
                      ]}
                    />
                  </div>
                </div>
                <div className="bg-muted/60 grid gap-1 rounded-xl px-3.5 py-2.5 text-sm">
                  <p className="truncate">
                    <span className="text-muted-foreground">Asunto: </span>
                    <span className="font-medium">
                      {preview.data?.subject ?? template?.subject ?? "—"}
                    </span>
                  </p>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
                    <span>Con los datos de:</span>
                    {recipients.length > 1 ? (
                      <select
                        className="text-foreground bg-transparent font-medium outline-none"
                        value={effectivePreviewId ?? ""}
                        onChange={(e) => setPreviewUserId(Number(e.target.value))}
                      >
                        {recipients.map((u) => (
                          <option key={u.id} value={u.id}>
                            {recipientName(u)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-foreground font-medium">
                        {recipients[0] ? recipientName(recipients[0]) : "ejemplo genérico"}
                      </span>
                    )}
                    {preview.isFetching ? <Loader2 className="size-3 animate-spin" /> : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/60 flex justify-center overflow-hidden rounded-xl border">
                  {preview.data ? (
                    <iframe
                      title="Vista previa del correo"
                      srcDoc={preview.data.html}
                      sandbox=""
                      // El correo responde a prefers-color-scheme; el iframe lo hereda de aquí.
                      style={{ colorScheme: scheme }}
                      className={cn(
                        "h-[70vh] min-h-[520px] bg-white transition-[width] duration-300",
                        device === "mobile" ? "w-[375px] max-w-full border-x" : "w-full"
                      )}
                    />
                  ) : preview.error ? (
                    <p className="text-destructive p-6 text-sm">
                      {(preview.error as Error).message}
                    </p>
                  ) : (
                    <Skeleton className="h-[70vh] min-h-[520px] w-full rounded-none" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="historial">
          <PaginatedTable<EmailLogRow>
            queryKey="staff-email-log"
            initialPath="/api/auth/staff/email-log/"
            title="Historial de envíos"
            description="Cada correo enviado desde esta sección."
            showSearch={false}
            headingLevel={2}
            exportFileName="correos-enviados"
            columns={[
              {
                key: "created_at",
                header: "Fecha",
                render: (r) => (
                  <span className="whitespace-nowrap">{formatDateTime(r.created_at)}</span>
                ),
                csvValue: (r) => r.created_at,
              },
              {
                key: "recipient_email",
                header: "Para",
                render: (r) => r.recipient_email,
              },
              {
                key: "template_key",
                header: "Plantilla",
                render: (r) =>
                  catalog?.templates.find((t) => t.key === r.template_key)?.name ??
                  r.template_key,
              },
              {
                key: "status",
                header: "Estado",
                render: (r) =>
                  r.status === "sent" ? (
                    <Badge
                      variant="outline"
                      className="border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200"
                    >
                      Enviado
                    </Badge>
                  ) : (
                    <Badge variant="destructive" title={r.error_message}>
                      Fallido
                    </Badge>
                  ),
              },
              {
                key: "sent_by_email",
                header: "Enviado por",
                render: (r) => (
                  <span className="text-muted-foreground">{r.sent_by_email ?? "—"}</span>
                ),
              },
            ]}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Enviar este correo?</DialogTitle>
            <DialogDescription>
              «{template?.name}» le llegará a{" "}
              {recipients.length === 1
                ? recipients[0]?.email
                : `${recipients.length} personas`}
              . Esto no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {recipients.length > 1 ? (
            <ul className="bg-muted/50 max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2 text-sm">
              {recipients.map((u) => (
                <li key={u.id} className="flex justify-between gap-3">
                  <span className="truncate">{recipientName(u)}</span>
                  <span className="text-muted-foreground truncate text-xs">{u.email}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => send.mutate()} disabled={send.isPending}>
              {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
              Enviar ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Segmented<V extends string>({
  value,
  onChange,
  options,
}: {
  value: V;
  onChange: (v: V) => void;
  options: [V, React.ComponentType<{ className?: string }>, string][];
}) {
  return (
    <div className="bg-card flex rounded-full border border-black/[0.07] p-0.5 dark:border-white/10">
      {options.map(([v, Icon, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
            value === v
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

function RecipientSearch({
  selectedIds,
  onAdd,
}: {
  selectedIds: number[];
  onAdd: (u: Recipient) => void;
}) {
  const [term, setTerm] = React.useState("");
  const debounced = useDebounced(term.trim());

  const { data, isFetching } = useQuery({
    queryKey: ["staff-email-recipient-search", debounced],
    queryFn: () =>
      apiJson<Paginated<Recipient>>(
        `/api/auth/staff/users/?page_size=8&search=${encodeURIComponent(debounced)}`
      ),
    enabled: debounced.length >= 2,
  });

  const results = debounced.length >= 2 ? data?.results ?? [] : [];

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Nombre o correo…"
          className="pl-8"
          aria-label="Buscar usuarios"
        />
        {isFetching ? (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin" />
        ) : null}
      </div>
      {debounced.length >= 2 && !isFetching && results.length === 0 ? (
        <p className="text-muted-foreground px-1 text-xs">Nadie coincide con «{debounced}».</p>
      ) : null}
      {results.length > 0 ? (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {results.map((u) => {
            const added = selectedIds.includes(u.id);
            return (
              <li key={u.id}>
                <button
                  type="button"
                  disabled={added}
                  onClick={() => onAdd(u)}
                  className="hover:bg-muted/60 flex w-full items-center gap-2.5 px-3 py-2 text-left disabled:opacity-60"
                >
                  <Avatar size="sm" className="size-7">
                    <AvatarFallback className="text-[10px]">
                      {initialsFrom(recipientName(u))}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {recipientName(u)}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {u.email || "sin correo"}
                    </span>
                  </span>
                  {u.role ? <RoleBadge role={u.role} /> : null}
                  {added ? <Check className="text-primary size-4" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
