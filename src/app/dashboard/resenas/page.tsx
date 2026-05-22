"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { PaginatedTable } from "@/components/paginated-table";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

type ReviewRow = {
  id: number;
  rating: number;
  comment: string;
  business: number | { id: number; name?: string };
};

export default function ResenasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ReviewRow | null>(null);
  const [rating, setRating] = React.useState("5");
  const [comment, setComment] = React.useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["reviews"] });

  React.useEffect(() => {
    if (open && editing) {
      setRating(String(editing.rating));
      setComment(editing.comment ?? "");
    }
  }, [open, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const r = Number(rating);
      if (r < 1 || r > 5) throw new Error("Rating entre 1 y 5.");
      const body = { rating: r, comment: comment.trim() };
      const res = await apiFetch(`/api/reviews/${editing.id}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const t = await res.text();
      if (!res.ok) throw new Error(formatApiErrorBody(t, res.statusText));
    },
    onSuccess: () => {
      toast.success("Reseña actualizada");
      setOpen(false);
      setEditing(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PaginatedTable<ReviewRow>
        queryKey="reviews"
        initialPath="/api/reviews/"
        title="Reseñas"
        description="Editar calificación y comentario (moderación interna)."
        columns={[
          { key: "id", header: "ID", render: (r) => String(r.id) },
          {
            key: "rating",
            header: "★",
            render: (r) => String(r.rating ?? ""),
          },
          {
            key: "business",
            header: "Negocio",
            render: (r) =>
              typeof r.business === "object" && r.business && "name" in r.business
                ? String((r.business as { name?: string }).name)
                : String(r.business ?? ""),
          },
          {
            key: "comment",
            header: "Comentario",
            render: (r) => String(r.comment ?? "").slice(0, 80),
          },
        ]}
        renderRowActions={(row) => (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => {
              setEditing(row);
              setOpen(true);
            }}
          >
            <Pencil className="size-4" />
          </Button>
        )}
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Editar reseña #{editing?.id}</SheetTitle>
            <SheetDescription>
              Usa con cuidado: afecta la reputación del negocio.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4 py-2">
            <div className="space-y-2">
              <Label>Estrellas</Label>
              <Select
                value={rating}
                onValueChange={(v) => setRating(v ?? "5")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["1", "2", "3", "4", "5"].map((x) => (
                    <SelectItem key={x} value={x}>
                      {x}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Comentario</Label>
              <Textarea
                rows={5}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
