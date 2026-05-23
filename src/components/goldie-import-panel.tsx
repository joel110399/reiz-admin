"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
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

type GoldieImportResponse = {
  dry_run: boolean;
  stats: Record<string, number>;
  warnings: string[];
  warnings_truncated?: boolean;
  staff_detected: string[];
  already_imported: boolean;
  team_members?: TeamMemberOption[];
};

type GoldieImportPanelProps = {
  businessId: number;
  teamMembers: TeamMemberOption[];
};

function buildFormData(
  businessId: number,
  files: { clients: File; services: File; appointments: File },
  staffMapping: Record<string, number>,
  dryRun: boolean
): FormData {
  const fd = new FormData();
  fd.append("business_id", String(businessId));
  fd.append("dry_run", dryRun ? "true" : "false");
  fd.append("staff_mapping", JSON.stringify(staffMapping));
  fd.append("clients", files.clients);
  fd.append("services", files.services);
  fd.append("appointments", files.appointments);
  return fd;
}

export function GoldieImportPanel({
  businessId,
  teamMembers,
}: GoldieImportPanelProps) {
  const [clientsFile, setClientsFile] = React.useState<File | null>(null);
  const [servicesFile, setServicesFile] = React.useState<File | null>(null);
  const [appointmentsFile, setAppointmentsFile] = React.useState<File | null>(
    null
  );
  const [staffDetected, setStaffDetected] = React.useState<string[]>([]);
  const [staffMapping, setStaffMapping] = React.useState<
    Record<string, string>
  >({});
  const [preview, setPreview] = React.useState<GoldieImportResponse | null>(
    null
  );
  const [pendingAction, setPendingAction] = React.useState<
    "preview" | "import" | null
  >(null);

  const filesReady =
    clientsFile && servicesFile && appointmentsFile;

  const mutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      if (!filesReady) throw new Error("Sube los tres archivos CSV.");
      const mapping: Record<string, number> = {};
      for (const [name, val] of Object.entries(staffMapping)) {
        if (val && val !== "_none") mapping[name] = Number(val);
      }
      const fd = buildFormData(
        businessId,
        {
          clients: clientsFile,
          services: servicesFile,
          appointments: appointmentsFile,
        },
        mapping,
        dryRun
      );
      const res = await apiFetch("/api/bookings/goldie-import/", {
        method: "POST",
        body: fd,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(formatApiErrorBody(text, res.statusText));
      }
      return JSON.parse(text) as GoldieImportResponse;
    },
  });

  React.useEffect(() => {
    if (mutation.data?.staff_detected?.length) {
      setStaffDetected(mutation.data.staff_detected);
      setStaffMapping((prev) => {
        const next = { ...prev };
        for (const name of mutation.data!.staff_detected) {
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
  }, [mutation.data, teamMembers]);

  const onPreview = () => {
    setPendingAction("preview");
    mutation.mutate(true, {
      onSuccess: (data) => {
        setPreview(data);
        setPendingAction(null);
        toast.success("Vista previa lista");
      },
      onError: (e) => {
        setPendingAction(null);
        toast.error(e instanceof Error ? e.message : "Error en vista previa");
      },
    });
  };

  const onImport = () => {
    setPendingAction("import");
    mutation.mutate(false, {
      onSuccess: (data) => {
        setPreview(data);
        setPendingAction(null);
        toast.success("Importación completada");
      },
      onError: (e) => {
        setPendingAction(null);
        toast.error(e instanceof Error ? e.message : "Error al importar");
      },
    });
  };

  const statLabels: Record<string, string> = {
    clients_created: "Clientes nuevos",
    clients_reused: "Clientes existentes reutilizados",
    clients_skipped_mapped: "Clientes ya importados (omitidos)",
    services_created: "Servicios nuevos",
    services_reused: "Servicios existentes reutilizados",
    services_skipped_mapped: "Servicios ya importados (omitidos)",
    bookings_created: "Reservas creadas",
    bookings_skipped_mapped: "Reservas ya importadas (omitidas)",
    time_blocks_created: "Bloqueos de horario creados",
    time_blocks_skipped_mapped: "Bloqueos ya importados (omitidos)",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar desde Goldie</CardTitle>
        <CardDescription>
          Sube los CSV de clientes, servicios y citas exportados desde Goldie.
          Se asignarán a este negocio. Usa vista previa antes de importar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="goldie-clients">Clients.csv</Label>
            <input
              id="goldie-clients"
              type="file"
              accept=".csv,text/csv"
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
              className="border-input file:bg-muted w-full rounded-md border text-sm file:mr-2 file:rounded file:border-0 file:px-2 file:py-1"
              onChange={(e) =>
                setAppointmentsFile(e.target.files?.[0] ?? null)
              }
            />
          </div>
        </div>

        {staffDetected.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Mapeo de personal (Goldie → Reiz)</p>
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
                    onValueChange={(v) =>
                      setStaffMapping((prev) => ({
                        ...prev,
                        [goldieName]: v,
                      }))
                    }
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
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Tras la vista previa aparecerá el personal detectado en los CSV para
            vincularlo al equipo del negocio.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!filesReady || mutation.isPending}
            onClick={onPreview}
          >
            {mutation.isPending && pendingAction === "preview"
              ? "Simulando…"
              : "Vista previa"}
          </Button>
          <Button
            type="button"
            disabled={!filesReady || mutation.isPending || !preview}
            onClick={onImport}
          >
            {mutation.isPending && pendingAction === "import"
              ? "Importando…"
              : "Importar datos"}
          </Button>
        </div>

        {preview ? (
          <div className="space-y-3 rounded-lg border p-4 text-sm">
            <p className="font-medium">
              {preview.dry_run ? "Resultado (simulación)" : "Resultado (importación real)"}
              {preview.already_imported ? (
                <span className="text-muted-foreground ml-2 font-normal">
                  · Este negocio ya tenía una importación Goldie previa (registros
                  mapeados se omiten).
                </span>
              ) : null}
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {Object.entries(preview.stats).map(([key, val]) =>
                val > 0 ? (
                  <li key={key}>
                    <span className="text-muted-foreground">
                      {statLabels[key] ?? key}:{" "}
                    </span>
                    <span className="font-medium">{val}</span>
                  </li>
                ) : null
              )}
            </ul>
            {preview.warnings?.length ? (
              <div className="mt-2 max-h-48 overflow-auto rounded-md bg-muted/50 p-2 text-xs">
                <p className="text-muted-foreground mb-1 font-medium">
                  Advertencias ({preview.warnings.length}
                  {preview.warnings_truncated ? "+" : ""})
                </p>
                <ul className="list-inside list-disc space-y-0.5">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
