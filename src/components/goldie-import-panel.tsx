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
import { apiFetch, formatApiErrorBody } from "@/lib/api-client";

type TeamMemberOption = { id: number; name: string };

type PhaseStatus = {
  clients_completed: boolean;
  services_completed: boolean;
  appointments_completed: boolean;
  appointments_next_offset: number;
  appointments_total_rows: number;
};

type ImportProgress = {
  offset: number;
  batch_size: number;
  total_rows: number;
  processed_rows: number;
  done: boolean;
  percent: number;
};

type PhaseResponse = {
  session_id?: string;
  phase?: string;
  stats: Record<string, number>;
  cumulative_stats?: Record<string, number>;
  warnings: string[];
  warnings_truncated?: boolean;
  staff_detected?: string[];
  progress?: ImportProgress;
  phase_status?: PhaseStatus;
  appointments_row_count?: number;
  appointments_batch_size?: number;
  clients_row_count?: number;
  services_row_count?: number;
};

type WizardStep =
  | "setup"
  | "clients"
  | "services"
  | "appointments"
  | "done";

type GoldieImportPanelProps = {
  businessId: number;
  teamMembers: TeamMemberOption[];
};

const STAT_LABELS: Record<string, string> = {
  clients_created: "Clientes nuevos",
  clients_reused: "Clientes reutilizados",
  clients_skipped_mapped: "Clientes omitidos (ya importados)",
  services_created: "Servicios nuevos",
  services_reused: "Servicios reutilizados",
  services_skipped_mapped: "Servicios omitidos",
  bookings_created: "Reservas creadas (lote)",
  bookings_skipped_mapped: "Reservas omitidas (lote)",
  time_blocks_created: "Bloqueos creados (lote)",
  time_blocks_skipped_mapped: "Bloqueos omitidos (lote)",
};

async function parseJsonResponse(res: Response): Promise<PhaseResponse> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatApiErrorBody(text, res.statusText));
  }
  return JSON.parse(text) as PhaseResponse;
}

function staffMappingToJson(
  staffMapping: Record<string, string>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [name, val] of Object.entries(staffMapping)) {
    if (val && val !== "_none") out[name] = Number(val);
  }
  return out;
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

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const p = Math.min(100, Math.max(0, percent));
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{p}%</span>
      </div>
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

export function GoldieImportPanel({
  businessId,
  teamMembers,
}: GoldieImportPanelProps) {
  const [step, setStep] = React.useState<WizardStep>("setup");
  const [clientsFile, setClientsFile] = React.useState<File | null>(null);
  const [servicesFile, setServicesFile] = React.useState<File | null>(null);
  const [appointmentsFile, setAppointmentsFile] = React.useState<File | null>(
    null
  );
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [staffDetected, setStaffDetected] = React.useState<string[]>([]);
  const [staffMapping, setStaffMapping] = React.useState<
    Record<string, string>
  >({});
  const [phaseStatus, setPhaseStatus] = React.useState<PhaseStatus | null>(
    null
  );
  const [cumulativeStats, setCumulativeStats] = React.useState<
    Record<string, number>
  >({});
  const [lastBatchStats, setLastBatchStats] = React.useState<
    Record<string, number>
  >({});
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [appointmentsProgress, setAppointmentsProgress] =
    React.useState<ImportProgress | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [busyLabel, setBusyLabel] = React.useState("");

  const filesReady =
    clientsFile && servicesFile && appointmentsFile;

  const applyStaffDetected = React.useCallback(
    (names: string[]) => {
      setStaffDetected(names);
      setStaffMapping((prev) => {
        const next = { ...prev };
        for (const name of names) {
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
    },
    [teamMembers]
  );

  const applyResponse = (data: PhaseResponse) => {
    if (data.cumulative_stats) setCumulativeStats(data.cumulative_stats);
    if (data.stats) setLastBatchStats(data.stats);
    if (data.warnings?.length) setWarnings(data.warnings);
    if (data.phase_status) setPhaseStatus(data.phase_status);
    if (data.progress) setAppointmentsProgress(data.progress);
  };

  const createSession = async () => {
    if (!filesReady) throw new Error("Sube los tres archivos CSV.");
    const fd = new FormData();
    fd.append("business_id", String(businessId));
    fd.append("staff_mapping", JSON.stringify(staffMappingToJson(staffMapping)));
    fd.append("clients", clientsFile);
    fd.append("services", servicesFile);
    fd.append("appointments", appointmentsFile);

    const res = await apiFetch("/api/bookings/goldie-import/session/", {
      method: "POST",
      body: fd,
    });
    const data = await parseJsonResponse(res);
    setSessionId(data.session_id ?? null);
    if (data.staff_detected) applyStaffDetected(data.staff_detected);
    setPhaseStatus(
      data.phase_status ?? {
        clients_completed: false,
        services_completed: false,
        appointments_completed: false,
        appointments_next_offset: 0,
        appointments_total_rows: data.appointments_row_count ?? 0,
      }
    );
    setStep("clients");
    toast.success("Archivos listos. Importa los clientes cuando quieras.");
  };

  const runClients = async (sid: string) => {
    const res = await apiFetch(
      `/api/bookings/goldie-import/session/${sid}/clients/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_mapping: staffMappingToJson(staffMapping),
        }),
      }
    );
    const data = await parseJsonResponse(res);
    applyResponse(data);
    setStep("services");
    toast.success("Clientes importados");
  };

  const runServices = async (sid: string) => {
    const res = await apiFetch(
      `/api/bookings/goldie-import/session/${sid}/services/`,
      { method: "POST" }
    );
    const data = await parseJsonResponse(res);
    applyResponse(data);
    setStep("appointments");
    toast.success("Servicios importados");
  };

  const runAppointmentsBatches = async (sid: string) => {
    let done = false;
    let batchNum = 0;
    while (!done) {
      batchNum += 1;
      setBusyLabel(`Citas: lote ${batchNum}…`);
      const res = await apiFetch(
        `/api/bookings/goldie-import/session/${sid}/appointments/`,
        { method: "POST" }
      );
      const data = await parseJsonResponse(res);
      applyResponse(data);
      done = data.progress?.done ?? true;
      if (data.progress) {
        setAppointmentsProgress(data.progress);
      }
    }
    setStep("done");
    toast.success("Importación de citas completada");
  };

  const runStep = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error en la importación");
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  };

  const resetWizard = () => {
    setStep("setup");
    setSessionId(null);
    setPhaseStatus(null);
    setCumulativeStats({});
    setLastBatchStats({});
    setWarnings([]);
    setAppointmentsProgress(null);
    setClientsFile(null);
    setServicesFile(null);
    setAppointmentsFile(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar desde Goldie</CardTitle>
        <CardDescription>
          Importación por pasos: clientes → servicios → citas (en lotes de 500).
          Verás el progreso de cada fase sin esperar a que termine todo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Indicador de pasos */}
        <ol className="flex flex-wrap gap-2 text-xs">
          {(
            [
              ["setup", "1. Archivos"],
              ["clients", "2. Clientes"],
              ["services", "3. Servicios"],
              ["appointments", "4. Citas"],
              ["done", "Listo"],
            ] as const
          ).map(([key, label]) => (
            <li
              key={key}
              className={
                step === key
                  ? "bg-primary text-primary-foreground rounded-full px-3 py-1 font-medium"
                  : "bg-muted text-muted-foreground rounded-full px-3 py-1"
              }
            >
              {label}
            </li>
          ))}
        </ol>

        {step === "setup" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="goldie-clients">Clients.csv</Label>
                <input
                  id="goldie-clients"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={busy}
                  className="border-input file:bg-muted w-full rounded-md border text-sm file:mr-2 file:rounded file:border-0 file:px-2 file:py-1"
                  onChange={(e) =>
                    setClientsFile(e.target.files?.[0] ?? null)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goldie-services">Services.csv</Label>
                <input
                  id="goldie-services"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={busy}
                  className="border-input file:bg-muted w-full rounded-md border text-sm file:mr-2 file:rounded file:border-0 file:px-2 file:py-1"
                  onChange={(e) =>
                    setServicesFile(e.target.files?.[0] ?? null)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goldie-appointments">Appointments.csv</Label>
                <input
                  id="goldie-appointments"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={busy}
                  className="border-input file:bg-muted w-full rounded-md border text-sm file:mr-2 file:rounded file:border-0 file:px-2 file:py-1"
                  onChange={(e) =>
                    setAppointmentsFile(e.target.files?.[0] ?? null)
                  }
                />
              </div>
            </div>
            <Button
              type="button"
              disabled={!filesReady || busy}
              onClick={() => runStep(createSession)}
            >
              {busy ? busyLabel || "Subiendo archivos…" : "Subir archivos al servidor"}
            </Button>
          </>
        ) : null}

        {sessionId && staffDetected.length > 0 && step !== "done" ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Personal Goldie → equipo Reiz</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {staffDetected.map((goldieName) => (
                <div
                  key={goldieName}
                  className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-muted-foreground text-sm">
                    {goldieName}
                  </span>
                  <Select
                    value={staffMapping[goldieName] ?? "_none"}
                    disabled={busy || step === "appointments"}
                    onValueChange={(v) => {
                      if (!v) return;
                      setStaffMapping((prev) => ({
                        ...prev,
                        [goldieName]: v,
                      }));
                    }}
                  >
                    <SelectTrigger className="w-full sm:max-w-[220px]">
                      <SelectValue placeholder="Sin asignar" />
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
            {step === "clients" ? (
              <p className="text-muted-foreground text-xs">
                Ajusta el mapeo antes de importar clientes. No podrás cambiarlo
                después sin crear una sesión nueva.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === "clients" && sessionId ? (
          <div className="space-y-4">
            <p className="text-sm">
              {phaseStatus?.appointments_total_rows
                ? `En esta sesión hay ${phaseStatus.appointments_total_rows.toLocaleString()} filas en el CSV de citas (se importarán después en lotes de 500).`
                : null}
            </p>
            <Button
              type="button"
              disabled={busy}
              onClick={() => runStep(() => runClients(sessionId))}
            >
              {busy ? busyLabel || "Importando clientes…" : "Importar clientes"}
            </Button>
          </div>
        ) : null}

        {step === "services" && sessionId ? (
          <div className="space-y-4">
            <StatsList stats={cumulativeStats} title="Resumen clientes" />
            <Button
              type="button"
              disabled={busy}
              onClick={() => runStep(() => runServices(sessionId))}
            >
              {busy
                ? busyLabel || "Importando servicios…"
                : "Confirmar e importar servicios"}
            </Button>
          </div>
        ) : null}

        {step === "appointments" && sessionId ? (
          <div className="space-y-4">
            <StatsList stats={cumulativeStats} title="Total acumulado hasta ahora" />
            <Button
              type="button"
              disabled={busy}
              onClick={() => runStep(() => runAppointmentsBatches(sessionId))}
            >
              {busy
                ? busyLabel || "Importando citas…"
                : "Importar citas (lotes de 500)"}
            </Button>
            {appointmentsProgress ? (
              <ProgressBar
                percent={appointmentsProgress.percent}
                label={`Filas CSV procesadas: ${appointmentsProgress.processed_rows.toLocaleString()} / ${appointmentsProgress.total_rows.toLocaleString()}`}
              />
            ) : null}
            {busy && lastBatchStats ? (
              <StatsList stats={lastBatchStats} title="Último lote" />
            ) : null}
          </div>
        ) : null}

        {step === "done" ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Importación completada para este negocio.
            </p>
            <StatsList stats={cumulativeStats} title="Totales finales" />
            <Button type="button" variant="outline" onClick={resetWizard}>
              Nueva importación
            </Button>
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
            <p className="text-muted-foreground mb-1 font-medium">
              Advertencias ({warnings.length})
            </p>
            <ul className="list-inside list-disc space-y-0.5">
              {warnings.slice(0, 50).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
