"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, formatApiErrorBody } from "@/lib/api-client";

export type BankAccount = {
  id: number;
  bank_name: string;
  account_type: "savings" | "checking" | string;
  account_type_display?: string;
  account_number: string;
  account_holder: string;
  document_id?: string;
  notes?: string;
  is_active?: boolean;
  sort_order?: number;
};

type FormState = {
  bank_name: string;
  account_type: "savings" | "checking";
  account_number: string;
  account_holder: string;
  document_id: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  bank_name: "",
  account_type: "savings",
  account_number: "",
  account_holder: "",
  document_id: "",
  notes: "",
};

export function AdvancePaymentCard({
  id,
  requiresAdvancePayment,
  amount,
  notifyPhone,
  accounts,
}: {
  id: number;
  requiresAdvancePayment: boolean;
  amount?: string | number | null;
  notifyPhone?: string | null;
  accounts: BankAccount[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [whatsappPhone, setWhatsappPhone] = React.useState(notifyPhone ?? "");
  const [paymentAmount, setPaymentAmount] = React.useState(
    amount == null || amount === "" ? "" : String(amount)
  );

  React.useEffect(() => {
    setWhatsappPhone(notifyPhone ?? "");
  }, [notifyPhone]);

  React.useEffect(() => {
    setPaymentAmount(amount == null || amount === "" ? "" : String(amount));
  }, [amount]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["business-detail", String(id)] });
  };

  const toggleMutation = useMutation({
    mutationFn: async (next: boolean) => {
      const res = await apiFetch(`/api/businesses/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ requires_advance_payment: next }),
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      invalidate();
      toast.success("Pago anticipado actualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settingsMutation = useMutation({
    mutationFn: async () => {
      const parsed = Number(String(paymentAmount).replace(",", "."));
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("El monto debe ser un número mayor o igual a 0");
      }
      const res = await apiFetch(`/api/businesses/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          advance_payment_amount: parsed.toFixed(2),
          advance_payment_notify_phone: whatsappPhone.trim(),
        }),
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      invalidate();
      toast.success("Configuración de pago anticipado guardada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        bank_name: form.bank_name.trim(),
        account_type: form.account_type,
        account_number: form.account_number.trim(),
        account_holder: form.account_holder.trim(),
        document_id: form.document_id.trim(),
        notes: form.notes.trim(),
        is_active: true,
      };
      const path = editingId
        ? `/api/businesses/${id}/bank-accounts/${editingId}/`
        : `/api/businesses/${id}/bank-accounts/`;
      const res = await apiFetch(path, {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setEditingId(null);
      invalidate();
      toast.success(editingId ? "Cuenta actualizada" : "Cuenta agregada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (accountId: number) => {
      const res = await apiFetch(
        `/api/businesses/${id}/bank-accounts/${accountId}/`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(formatApiErrorBody(t, res.statusText));
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Cuenta eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (account: BankAccount) => {
    setEditingId(account.id);
    setForm({
      bank_name: account.bank_name,
      account_type: account.account_type === "checking" ? "checking" : "savings",
      account_number: account.account_number,
      account_holder: account.account_holder,
      document_id: account.document_id ?? "",
      notes: account.notes ?? "",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pago anticipado (web)</CardTitle>
        <CardDescription>
          Si está activo, el cliente debe transferir el monto que indiques aquí y
          subir el comprobante para agendar desde la web. El comprobante se envía
          al correo del negocio (y WhatsApp). La app no cambia por ahora.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">
            {requiresAdvancePayment
              ? "Requerido para agendar en la web"
              : "No requerido"}
          </span>
          <Button
            size="sm"
            variant={requiresAdvancePayment ? "destructive" : "default"}
            disabled={toggleMutation.isPending}
            onClick={() => toggleMutation.mutate(!requiresAdvancePayment)}
          >
            {requiresAdvancePayment ? "Desactivar" : "Activar"}
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="advance_payment_amount">Monto a transferir (RD$)</Label>
            <Input
              id="advance_payment_amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="500.00"
            />
            <p className="text-muted-foreground text-xs">
              Este es el monto que ve el cliente, no el total de la cita.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="advance_payment_notify_phone">
              WhatsApp donde llega el comprobante
            </Label>
            <Input
              id="advance_payment_notify_phone"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="8095551234"
            />
            <p className="text-muted-foreground text-xs">
              Reiz lo envía desde su número de Whapi. Si lo dejas vacío, se usa
              el teléfono del negocio o del dueño.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              disabled={settingsMutation.isPending}
              onClick={() => settingsMutation.mutate()}
            >
              Guardar monto y WhatsApp
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {!accounts.length ? (
            <p className="text-muted-foreground text-sm">
              Sin cuentas. Agrégalas abajo para que el cliente vea a dónde
              transferir.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banco</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id} className={a.is_active === false ? "opacity-50" : ""}>
                    <TableCell>{a.bank_name}</TableCell>
                    <TableCell>
                      {a.account_type_display ??
                        (a.account_type === "checking" ? "Corriente" : "Ahorro")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {a.account_number}
                    </TableCell>
                    <TableCell>{a.account_holder}</TableCell>
                    <TableCell>{a.document_id || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(a)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (confirm("¿Eliminar esta cuenta?")) {
                            deleteMutation.mutate(a.id);
                          }
                        }}
                      >
                        Borrar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="bank_name">Banco</Label>
            <Input
              id="bank_name"
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              placeholder="Banreservas, Popular, BHD…"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de cuenta</Label>
            <Select
              value={form.account_type}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  account_type: v === "checking" ? "checking" : "savings",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="savings">Ahorro</SelectItem>
                <SelectItem value="checking">Corriente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account_number">Número de cuenta</Label>
            <Input
              id="account_number"
              value={form.account_number}
              onChange={(e) =>
                setForm({ ...form, account_number: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account_holder">Titular</Label>
            <Input
              id="account_holder"
              value={form.account_holder}
              onChange={(e) =>
                setForm({ ...form, account_holder: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="document_id">Cédula / RNC (opcional)</Label>
            <Input
              id="document_id"
              value={form.document_id}
              onChange={(e) => setForm({ ...form, document_id: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account_notes">Nota para el cliente (opcional)</Label>
            <Input
              id="account_notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {editingId ? "Guardar cuenta" : "Agregar cuenta"}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
