"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch, apiJson, formatApiErrorBody } from "@/lib/api-client";

type TeamMemberOption = { id: number; name: string };

type ClientsUploadPreview = {
  total_rows: number;
  valid_rows: number;
  existing_count: number;
  new_count: number;
  already_imported_goldie?: number;
  matched_existing_contact?: number;
  duplicate_phone_in_csv?: number;
  invalid_rows?: number;
};

type AppointmentsUploadPreview = {
  total_rows: number;
  cita_rows: number;
  existing_count: number;
  new_count: number;
  existing_reservas: number;
  new_reservas: number;
  existing_time_blocks?: number;
  new_time_blocks?: number;
  rows_unresolved_client?: number;
  reservas_unresolvable_service?: number;
  invalid_rows?: number;
  has_clients_csv?: boolean;
};

type PhaseUploadPreview = ClientsUploadPreview | AppointmentsUploadPreview;

type PhaseInfo = {
  file_uploaded: boolean;
  total_rows: number;
  next_offset: number;
  processed_rows: number;
  completed: boolean;
  percent: number;
  can_resume: boolean;
  upload_preview?: PhaseUploadPreview | null;
};

type SessionStatus = {
  session_id: string;
  business_id: number;
  current_step: "services" | "clients" | "appointments" | "done";
  staff_mapping: Record<string, number>;
  staff_detected: string[];
  batch_sizes: { services: number; clients: number; appointments: number };
  services: PhaseInfo;
  clients: PhaseInfo;
  appointments: PhaseInfo;
  cumulative_stats: Record<string, number>;
};

type BatchResponse = SessionStatus & {
  phase: string;
  stats: Record<string, number>;
  warnings: string[];
  warnings_truncated?: boolean;
};

type GoldieImportPanelProps = {
  businessId: number;
  teamMembers: TeamMemberOption[];
};

const STORAGE_KEY = (businessId: number) => `goldie-import-session-${businessId}`;

const STAT_LABELS: Record<string, string> = {
  clients_created: "Clientes nuevos",
  clients_reused: "Clientes reutilizados",
  clients_skipped_mapped: "Clientes omitidos",
  services_created: "Servicios nuevos",
  services_reused: "Servicios reutilizados",
  services_skipped_mapped: "Servicios omitidos",
  bookings_created: "Reservas (lote)",
  bookings_skipped_mapped: "Reservas omitidas",
  time_blocks_created: "Bloqueos (lote)",
  time_blocks_skipped_mapped: "Bloqueos omitidos",
};

const EMPTY_PHASE: PhaseInfo = {
  file_uploaded: false,
  total_rows: 0,
  next_offset: 0,
  processed_rows: 0,
  completed: false,
  percent: 0,
  can_resume: false,
};

const PHASE_META = {
  services: {
    title: "Servicios (opcional)",
    fileLabel: "Services.csv",
    uploadHint: "Opcional si ya tienes el catálogo en Reiz. Subir CSV → Importar.",
  },
  clients: {
    title: "Clientes",
    fileLabel: "Clients.csv",
    uploadHint: "Independiente de servicios. Subir CSV → Importar.",
  },
  appointments: {
    title: "Citas",
    fileLabel: "Appointments.csv",
    uploadHint:
      "Importa clientes antes (en esta u otra sesión). Servicios: CSV o los que ya existan en el negocio.",
  },
} as const;

function staffMappingToJson(
  staffMapping: Record<string, string>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, val] of Object.entries(staffMapping)) {
    if (val && val !== "_none") out[name] = Number(val);
  }
  return out;
}

function ProgressBar({
  percent,
  label,
}: {
  percent: number;
  label: string;
}) {
  const p = Math.min(100, Math.max(0, percent));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{p}%</span>
      </div>
      <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

function StatsList({
  stats,
  title,
}: {
  stats: Record<string, number>;
  title?: string;
}) {
  const entries = Object.entries(stats).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  return (
    <div className="space-y-1">
      {title ? <p className="text-muted-foreground text-xs">{title}</p> : null}
      <ul className="grid gap-1 sm:grid-cols-2">
        {entries.map(([key, val]) => (
          <li key={key} className="text-sm">
            <span className="text-muted-foreground">
              {STAT_LABELS[key] ?? key}:{" "}
            </span>
            <span className="font-medium">{val}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function parseResponse(res: Response): Promise<BatchResponse> {
  const text = await res.text();
  if (!res.ok) throw new Error(formatApiErrorBody(text, res.statusText));
  return JSON.parse(text) as BatchResponse;
}

function isClientsPreview(p: PhaseUploadPreview): p is ClientsUploadPreview {
  return "valid_rows" in p && !("cita_rows" in p);
}

function UploadPreviewBanner({
  phaseKey,
  preview,
}: {
  phaseKey: "clients" | "appointments";
  preview: PhaseUploadPreview;
}) {
  if (phaseKey === "clients" && isClientsPreview(preview)) {
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50/80 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/40">
        <p className="font-medium text-blue-900 dark:text-blue-100">
          Resumen del CSV (antes de importar)
        </p>
        <ul className="mt-2 space-y-1 text-blue-800 dark:text-blue-200">
          <li>
            <span className="font-semibold text-green-700 dark:text-green-400">
              {preview.new_count.toLocaleString()}
            </span>{" "}
            clientes nuevos
          </li>
          <li>
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              {preview.existing_count.toLocaleString()}
            </span>{" "}
            ya existen en Reiz (no se duplicarán)
          </li>
        </ul>
        {(preview.already_imported_goldie ?? 0) > 0 ||
        (preview.matched_existing_contact ?? 0) > 0 ||
        (preview.duplicate_phone_in_csv ?? 0) > 0 ? (
          <p className="text-muted-foreground mt-2 text-xs">
            {preview.already_imported_goldie
              ? `${preview.already_imported_goldie.toLocaleString()} importados antes · `
              : ""}
            {preview.matched_existing_contact
              ? `${preview.matched_existing_contact.toLocaleString()} coinciden por teléfono/email · `
              : ""}
            {preview.duplicate_phone_in_csv
              ? `${preview.duplicate_phone_in_csv.toLocaleString()} teléfono duplicado en CSV`
              : ""}
          </p>
        ) : null}
        {(preview.invalid_rows ?? 0) > 0 ? (
          <p className="text-muted-foreground mt-1 text-xs">
            {preview.invalid_rows} filas sin Id válido (se omiten)
          </p>
        ) : null}
      </div>
    );
  }

  const appt = preview as AppointmentsUploadPreview;
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50/80 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/40">
      <p className="font-medium text-blue-900 dark:text-blue-100">
        Resumen del CSV (antes de importar)
      </p>
      <ul className="mt-2 space-y-1 text-blue-800 dark:text-blue-200">
        <li>
          <span className="font-semibold text-green-700 dark:text-green-400">
            {appt.new_reservas.toLocaleString()}
          </span>{" "}
          reservas nuevas
          {(appt.new_time_blocks ?? 0) > 0
            ? ` · ${appt.new_time_blocks!.toLocaleString()} bloqueos nuevos`
            : ""}
        </li>
        <li>
          <span className="font-semibold text-amber-700 dark:text-amber-400">
            {appt.existing_reservas.toLocaleString()}
          </span>{" "}
          reservas ya importadas
          {(appt.existing_time_blocks ?? 0) > 0
            ? ` · ${appt.existing_time_blocks!.toLocaleString()} bloqueos ya importados`
            : ""}
        </li>
      </ul>
      <p className="text-muted-foreground mt-2 text-xs">
        {appt.cita_rows.toLocaleString()} filas tipo Cita en{" "}
        {appt.total_rows.toLocaleString()} filas del CSV. Citas con varios
        servicios generan varias reservas.
      </p>
      {!appt.has_clients_csv ? (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          No hay Clients.csv en esta sesión: el conteo de clientes no resueltos
          puede ser mayor. Sube clientes primero para un resumen más preciso.
        </p>
      ) : null}
      {(appt.rows_unresolved_client ?? 0) > 0 ? (
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          {appt.rows_unresolved_client!.toLocaleString()} citas sin cliente
          reconocido (importa clientes antes o revisa nombres).
        </p>
      ) : null}
      {(appt.reservas_unresolvable_service ?? 0) > 0 ? (
        <p className="text-muted-foreground mt-1 text-xs">
          {appt.reservas_unresolvable_service} reservas sin servicio resoluble
        </p>
      ) : null}
    </div>
  );
}

function uploadPreviewToast(
  phase: PhaseKey,
  preview: PhaseUploadPreview | null | undefined
): string {
  if (!preview) return `${PHASE_META[phase].title}: archivo guardado`;
  if (phase === "clients" && isClientsPreview(preview)) {
    return `Clientes: ${preview.new_count.toLocaleString()} nuevos, ${preview.existing_count.toLocaleString()} ya existen`;
  }
  if (phase === "appointments") {
    const appt = preview as AppointmentsUploadPreview;
    return `Citas: ${appt.new_reservas.toLocaleString()} reservas nuevas, ${appt.existing_reservas.toLocaleString()} ya importadas`;
  }
  return `${PHASE_META[phase].title}: archivo guardado`;
}

type PhaseKey = keyof typeof PHASE_META;

function PhaseCard({
  phaseKey,
  status,
  teamMembers,
  staffMapping,
  setStaffMapping,
  busy,
  onUpload,
  onImportBatches,
}: {
  phaseKey: PhaseKey;
  status: SessionStatus;
  teamMembers: TeamMemberOption[];
  staffMapping: Record<string, string>;
  setStaffMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  busy: boolean;
  onUpload: (phase: PhaseKey, file: File) => Promise<void>;
  onImportBatches: (phase: PhaseKey) => Promise<void>;
}) {
  const meta = PHASE_META[phaseKey];
  const phase = status[phaseKey];
  const isActive = status.current_step === phaseKey;
  const isDone = phase.completed;
  const isOptional = phaseKey === "services";

  const [file, setFile] = React.useState<File | null>(null);

  return (
    <div
      className={
        isActive
          ? "border-primary space-y-4 rounded-lg border-2 p-4"
          : "space-y-4 rounded-lg border p-4"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {meta.title}
          {isOptional ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              opcional
            </span>
          ) : null}
          {isDone ? (
            <span className="text-green-600 dark:text-green-400 ml-2 text-xs font-normal">
              Completado
            </span>
          ) : null}
        </p>
        {phase.file_uploaded ? (
          <span className="text-muted-foreground text-xs">
            {phase.total_rows.toLocaleString()} filas en CSV
          </span>
        ) : null}
      </div>

      {phase.file_uploaded &&
      phase.upload_preview &&
      (phaseKey === "clients" || phaseKey === "appointments") ? (
        <UploadPreviewBanner
          phaseKey={phaseKey}
          preview={phase.upload_preview}
        />
      ) : null}

      {phase.file_uploaded && !isDone ? (
        <ProgressBar
          percent={phase.percent}
          label={`Progreso: ${phase.processed_rows.toLocaleString()} / ${phase.total_rows.toLocaleString()} filas`}
        />
      ) : null}

      {isDone && phase.file_uploaded ? (
        <p className="text-muted-foreground text-xs">
          Importado: {phase.processed_rows.toLocaleString()} /{" "}
          {phase.total_rows.toLocaleString()} filas. Puedes subir otro CSV abajo.
        </p>
      ) : null}

      <div className="border-muted-foreground/30 space-y-3 rounded-lg border border-dashed bg-muted/20 p-4">
        {isDone ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Fase completada. Sube un CSV nuevo para reiniciar el progreso de esta
            sección (lo ya importado en Reiz no se duplica).
          </p>
        ) : null}
        <div>
          <Label className="text-base">{meta.fileLabel}</Label>
          <p className="text-muted-foreground mt-1 text-xs">
            {isDone
              ? "Selecciona otro archivo o el mismo actualizado y pulsa Subir nuevo CSV."
              : meta.uploadHint}
          </p>
        </div>
        <input
          key={`${phaseKey}-${isDone}-${phase.total_rows}`}
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          className="border-input file:bg-primary file:text-primary-foreground w-full cursor-pointer rounded-md border-2 bg-background text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:font-medium"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <p className="text-muted-foreground text-xs">
            Archivo seleccionado:{" "}
            <span className="text-foreground">{file.name}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!file || busy}
            onClick={async () => {
              if (!file) return;
              await onUpload(phaseKey, file);
              setFile(null);
            }}
          >
            {isDone ? "Subir nuevo CSV" : "Subir CSV"}
          </Button>
          {phase.file_uploaded && !isDone ? (
            <Button
              type="button"
              disabled={busy}
              onClick={() => onImportBatches(phaseKey)}
            >
              {phase.can_resume ? "Continuar importación" : "Importar"}
            </Button>
          ) : null}
        </div>
      </div>

      {phaseKey === "appointments" &&
      status.staff_detected.length > 0 &&
      phase.file_uploaded &&
      !isDone ? (
        <div className="space-y-2">
          <p className="text-xs font-medium">Personal en citas → equipo Reiz</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {status.staff_detected.map((name) => (
              <div key={name} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground truncate text-xs">
                  {name}
                </span>
                <Select
                  value={staffMapping[name] ?? "_none"}
                  disabled={busy}
                  onValueChange={(v) => {
                    if (!v) return;
                    setStaffMapping((prev) => ({ ...prev, [name]: v }));
                  }}
                >
                  <SelectTrigger className="h-8 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sin asignar</SelectItem>
                    {teamMembers.map((tm) => (
                      <SelectItem key={tm.id} value={String(tm.id)}>
                        {tm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {phase.can_resume && !busy && phase.file_uploaded && !isDone ? (
        <p className="text-muted-foreground text-xs">
          Puedes reanudar: el progreso guardado continúa en la fila{" "}
          {phase.next_offset + 1}. Si vuelves a subir el CSV, reinicias esta fase.
        </p>
      ) : null}
    </div>
  );
}

export function GoldieImportPanel({
  businessId,
  teamMembers,
}: GoldieImportPanelProps) {
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<SessionStatus | null>(null);
  const [staffMapping, setStaffMapping] = React.useState<
    Record<string, string>
  >({});
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [lastBatchStats, setLastBatchStats] = React.useState<
    Record<string, number>
  >({});
  const [busy, setBusy] = React.useState(false);
  const [busyLabel, setBusyLabel] = React.useState("");

  const applyStatus = React.useCallback((data: SessionStatus) => {
    setStatus(data);
    setSessionId(data.session_id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY(businessId), data.session_id);
    }
    if (data.staff_detected?.length) {
      setStaffMapping((prev) => {
        const next = { ...prev };
        for (const name of data.staff_detected) {
          if (next[name] === undefined) {
            const match = teamMembers.find(
              (tm) =>
                tm.name.trim().toLowerCase() === name.trim().toLowerCase()
            );
            next[name] = match ? String(match.id) : "_none";
          }
        }
        return next;
      });
    }
    const existing = data.staff_mapping || {};
    if (Object.keys(existing).length) {
      setStaffMapping((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(existing)) {
          next[k] = String(v);
        }
        return next;
      });
    }
  }, [businessId, teamMembers]);

  const refreshStatus = React.useCallback(
    async (sid: string) => {
      const data = await apiJson<SessionStatus>(
        `/api/bookings/goldie-import/session/${sid}/`
      );
      applyStatus(data);
      return data;
    },
    [applyStatus]
  );

  React.useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem(STORAGE_KEY(businessId))
        : null;
    if (stored) {
      refreshStatus(stored).catch(() => {
        localStorage.removeItem(STORAGE_KEY(businessId));
      });
    }
  }, [businessId, refreshStatus]);

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;
    const data = await apiJson<SessionStatus>(
      "/api/bookings/goldie-import/session/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          staff_mapping: staffMappingToJson(staffMapping),
        }),
      }
    );
    applyStatus(data);
    return data.session_id;
  };

  const runWithBusy = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    setBusyLabel(label);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
      throw e;
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  };

  const uploadPhase = async (phase: PhaseKey, file: File) => {
    await runWithBusy(`Subiendo ${phase}…`, async () => {
      const sid = await ensureSession();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("staff_mapping", JSON.stringify(staffMappingToJson(staffMapping)));
      const res = await apiFetch(
        `/api/bookings/goldie-import/session/${sid}/upload/${phase}/`,
        { method: "POST", body: fd }
      );
      const data = await parseResponse(res);
      applyStatus(data);
      const phaseInfo = data[phase];
      toast.success(
        uploadPreviewToast(phase, phaseInfo.upload_preview ?? undefined)
      );
    });
  };

  const importBatches = async (phase: PhaseKey) => {
    await runWithBusy(`Importando ${phase}…`, async () => {
      const sid = sessionId ?? (await ensureSession());
      let done = false;
      let batch = 0;

      while (!done) {
        batch += 1;
        setBusyLabel(
          `${PHASE_META[phase].title}: lote ${batch}…`
        );
        const res = await apiFetch(
          `/api/bookings/goldie-import/session/${sid}/import/${phase}/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              staff_mapping: staffMappingToJson(staffMapping),
            }),
          }
        );
        const data = await parseResponse(res);
        applyStatus(data);
        if (data.warnings?.length) setWarnings(data.warnings);
        if (data.stats) setLastBatchStats(data.stats);

        const phaseInfo = data[phase];
        done = phaseInfo.completed;
      }

      toast.success(`${PHASE_META[phase].title} completado`);
    });
  };

  const startNewSession = async () => {
    localStorage.removeItem(STORAGE_KEY(businessId));
    setSessionId(null);
    setStatus(null);
    setWarnings([]);
    setLastBatchStats({});
    const data = await apiJson<SessionStatus>(
      "/api/bookings/goldie-import/session/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          staff_mapping: staffMappingToJson(staffMapping),
        }),
      }
    );
    applyStatus(data);
    toast.success("Nueva sesión de importación");
  };

  const displayStatus: SessionStatus = status ?? {
    session_id: sessionId ?? "",
    business_id: businessId,
    current_step: "services",
    staff_mapping: {},
    staff_detected: [],
    batch_sizes: { services: 20, clients: 200, appointments: 500 },
    services: { ...EMPTY_PHASE },
    clients: { ...EMPTY_PHASE },
    appointments: { ...EMPTY_PHASE },
    cumulative_stats: {},
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar desde Goldie</CardTitle>
        <CardDescription>
          Cada sección es independiente: usa solo clientes, solo citas, o las tres.
          Reimportar el mismo CSV no duplica: omite lo ya importado (por ID Goldie).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/30 rounded-lg border px-4 py-3 text-sm">
          <p className="font-medium">Cómo funciona</p>
          <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5 text-xs">
            <li>Cada bloque es independiente: puedes saltar servicios si ya están en Reiz.</li>
            <li>Para citas: importa clientes antes (misma sesión u otra). Servicios del negocio o Services.csv.</li>
            <li>Mismo archivo otra vez: <strong className="text-foreground">no duplica</strong>; suma solo filas nuevas o muestra «omitidos».</li>
            <li>Vuelves a subir el CSV → reinicia el % de esa sección; lo ya guardado sigue omitiéndose.</li>
          </ol>
        </div>

        <div className="flex flex-wrap gap-2">
          {sessionId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => refreshStatus(sessionId).catch(() => {})}
            >
              Actualizar estado
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={startNewSession}
          >
            Nueva sesión
          </Button>
        </div>

        {sessionId && Object.keys(displayStatus.cumulative_stats).length > 0 ? (
          <StatsList
            stats={displayStatus.cumulative_stats}
            title="Totales acumulados en esta sesión"
          />
        ) : null}
        {lastBatchStats && busy ? (
          <StatsList stats={lastBatchStats} title="Último lote" />
        ) : null}

        <PhaseCard
          phaseKey="services"
          status={displayStatus}
          teamMembers={teamMembers}
          staffMapping={staffMapping}
          setStaffMapping={setStaffMapping}
          busy={busy}
          onUpload={uploadPhase}
          onImportBatches={importBatches}
        />
        <PhaseCard
          phaseKey="clients"
          status={displayStatus}
          teamMembers={teamMembers}
          staffMapping={staffMapping}
          setStaffMapping={setStaffMapping}
          busy={busy}
          onUpload={uploadPhase}
          onImportBatches={importBatches}
        />
        <PhaseCard
          phaseKey="appointments"
          status={displayStatus}
          teamMembers={teamMembers}
          staffMapping={staffMapping}
          setStaffMapping={setStaffMapping}
          busy={busy}
          onUpload={uploadPhase}
          onImportBatches={importBatches}
        />

        {displayStatus.current_step === "done" ? (
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Importación completa para esta sesión.
          </p>
        ) : null}

        {busy && busyLabel ? (
          <p className="text-muted-foreground text-center text-xs">{busyLabel}</p>
        ) : null}

        {warnings.length > 0 ? (
          <div className="max-h-36 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
            <p className="text-muted-foreground mb-1 font-medium">
              Advertencias recientes ({warnings.length})
            </p>
            <ul className="list-inside list-disc space-y-0.5">
              {warnings.slice(0, 40).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
