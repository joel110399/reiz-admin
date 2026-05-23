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

type PhaseInfo = {
  file_uploaded: boolean;
  total_rows: number;
  next_offset: number;
  processed_rows: number;
  completed: boolean;
  percent: number;
  can_resume: boolean;
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
    title: "1. Servicios",
    fileLabel: "Services.csv",
    uploadHint: "Paso 1: elige el archivo y pulsa «Subir CSV», luego «Importar».",
  },
  clients: {
    title: "2. Clientes",
    fileLabel: "Clients.csv",
    uploadHint: "Paso 2: cuando termines servicios, sube Clients.csv aquí.",
  },
  appointments: {
    title: "3. Citas",
    fileLabel: "Appointments.csv",
    uploadHint: "Paso 3: cuando termines clientes, sube Appointments.csv aquí.",
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
  const locked =
    (phaseKey === "clients" && !status.services.completed) ||
    (phaseKey === "appointments" && !status.clients.completed);

  const [file, setFile] = React.useState<File | null>(null);

  if (locked) {
    return (
      <div className="rounded-lg border border-dashed p-4 opacity-60">
        <p className="text-sm font-medium">{meta.title}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Completa la fase anterior para desbloquear.
        </p>
      </div>
    );
  }

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

      {phase.file_uploaded ? (
        <ProgressBar
          percent={phase.percent}
          label={
            isDone
              ? `Importado: ${phase.processed_rows.toLocaleString()} / ${phase.total_rows.toLocaleString()} filas`
              : `Progreso: ${phase.processed_rows.toLocaleString()} / ${phase.total_rows.toLocaleString()} filas`
          }
        />
      ) : null}

      {!isDone ? (
        <div className="border-muted-foreground/30 space-y-3 rounded-lg border border-dashed bg-muted/20 p-4">
          <div>
            <Label className="text-base">{meta.fileLabel}</Label>
            <p className="text-muted-foreground mt-1 text-xs">{meta.uploadHint}</p>
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            className="border-input file:bg-primary file:text-primary-foreground w-full cursor-pointer rounded-md border-2 bg-background text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:font-medium"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <p className="text-muted-foreground text-xs">
              Archivo seleccionado: <span className="text-foreground">{file.name}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!file || busy}
              onClick={() => file && onUpload(phaseKey, file)}
            >
              Subir CSV
            </Button>
            {phase.file_uploaded ? (
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
      ) : null}

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
      toast.success(`${PHASE_META[phase].title}: archivo guardado`);
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
          Orden: servicios → clientes → citas. Cada fase con su CSV, progreso en %
          y reanudación si falla un lote (no empiezas desde cero).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/30 rounded-lg border px-4 py-3 text-sm">
          <p className="font-medium">Cómo funciona</p>
          <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5 text-xs">
            <li>En cada paso: elige el CSV → <strong className="text-foreground">Subir CSV</strong> → <strong className="text-foreground">Importar</strong>.</li>
            <li>La sesión se crea sola al subir el primer archivo (no hace falta otro botón).</li>
            <li>Si falla un lote, usa <strong className="text-foreground">Continuar importación</strong> en ese mismo paso.</li>
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
