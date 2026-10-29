"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReizMark } from "@/components/reiz-mark";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!loading && user?.is_staff) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await login(username.trim(), password);
      toast.success("Sesión iniciada");
      router.replace("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="admin-canvas relative flex min-h-screen items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <ReizMark className="mb-5 size-12 rounded-xl" />
          <span className="border-primary/15 bg-accent text-accent-foreground mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-medium">
            <span className="bg-brand size-1.5 rounded-full" />
            Equipo interno
          </span>
          <h1 className="font-heading text-[2rem] leading-tight font-semibold tracking-[-0.035em]">
            Reiz <span className="text-muted-foreground font-normal">Admin</span>
          </h1>
          <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-relaxed">
            Acceso del equipo interno para resolver reservas, negocios y
            cuentas.
          </p>
        </div>
        <div className="bg-card rounded-[1.5rem] p-6 shadow-[0_20px_40px_-24px_rgb(0_0_0/0.25)] ring-1 ring-black/[0.06] sm:p-7 dark:ring-white/[0.08]">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="user">Usuario</Label>
              <Input
                id="user"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pass">Contraseña</Label>
              <Input
                id="pass"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
              {pending ? "Entrando…" : "Entrar al panel"}
            </Button>
          </form>
        </div>
        <p className="text-muted-foreground mt-6 text-center text-xs">
          Solo cuentas con permiso de staff.
        </p>
      </div>
    </div>
  );
}
