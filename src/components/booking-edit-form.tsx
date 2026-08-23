"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, formatApiErrorBody } from "@/lib/api-client";
import { BOOKING_STATUSES, bookingStatusLabel } from "@/lib/labels";

export type BookingEditValues = {
  id: number;
  status: string;
  date: string;
  start_time: string;
  end_time: string;
  notes?: string | null;
};

export function BookingEditForm({
  booking,
  onSaved,
  onCancel,
}: {
  booking: BookingEditValues;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const qc = useQueryClient();
  const [status, setStatus] = React.useState(booking.status);
  const [date, setDate] = React.useState(String(booking.date ?? ""));
  const [startTime, setStartTime] = React.useState(
    String(booking.start_time ?? "").slice(0, 8)
  );
  const [endTime, setEndTime] = React.useState(
    String(booking.end_time ?? "").slice(0, 8)
  );
  const [notes, setNotes] = React.useState(booking.notes ?? "");

  React.useEffect(() => {
    setStatus(booking.status);
    setDate(String(booking.date ?? ""));
    setStartTime(String(booking.start_time ?? "").slice(0, 8));
    setEndTime(String(booking.end_time ?? "").slice(0, 8));
    setNotes(booking.notes ?? "");
  }, [booking]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        status,
        notes: notes.trim() || null,
        date,
        start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
        end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
      };
      const res = await apiFetch(`/api/bookings/${booking.id}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      toast.success("Reserva actualizada");
      void qc.invalidateQueries({ queryKey: ["bookings"] });
      void qc.invalidateQueries({ queryKey: ["booking-detail", String(booking.id)] });
      void qc.invalidateQueries({ queryKey: ["staff-summary"] });
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-3">
      <div className="space-y-2">
        <Label>Estado</Label>
        <Select value={status} onValueChange={(v) => setStatus(v ?? "pending")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BOOKING_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {bookingStatusLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Fecha</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>Inicio</Label>
          <Input
            type="time"
            value={startTime.length > 5 ? startTime.slice(0, 5) : startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Fin</Label>
          <Input
            type="time"
            value={endTime.length > 5 ? endTime.slice(0, 5) : endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
