"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Heart,
  LayoutDashboard,
  LogOut,
  Search,
  Smartphone,
  Star,
  Users,
  Bell,
  Briefcase,
  UserCircle2,
  Wrench,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
  { href: "/dashboard/buscar", label: "Buscar / atajo", icon: Search },
  { href: "/dashboard/usuarios", label: "Usuarios", icon: Users },
  { href: "/dashboard/negocios", label: "Negocios", icon: Building2 },
  { href: "/dashboard/reservas", label: "Reservas", icon: CalendarDays },
  { href: "/dashboard/clientes", label: "Clientes", icon: UserCircle2 },
  { href: "/dashboard/servicios", label: "Servicios", icon: Wrench },
  { href: "/dashboard/resenas", label: "Reseñas", icon: Star },
  { href: "/dashboard/equipo", label: "Equipo", icon: Briefcase },
  { href: "/dashboard/favoritos", label: "Favoritos", icon: Heart },
  { href: "/dashboard/notificaciones", label: "Notificaciones", icon: Bell },
  { href: "/dashboard/tokens", label: "Device tokens", icon: Smartphone },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el?.closest("input, textarea, select, [contenteditable=true]")
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/dashboard/buscar");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex flex-col gap-0.5 px-2 py-1">
            <span className="font-semibold tracking-tight">Reiz Admin</span>
            <span className="text-muted-foreground text-xs truncate">
              {user?.email}
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Operaciones</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={
                        pathname === item.href ||
                        (item.href !== "/dashboard" &&
                          pathname.startsWith(`${item.href}/`))
                      }
                      tooltip={item.label}
                      onClick={() => router.push(item.href)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => logout()}
          >
            <LogOut className="size-4" />
            Salir
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="bg-background/80 supports-backdrop-filter:bg-background/60 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-md">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <div className="text-muted-foreground hidden min-w-0 flex-1 text-sm md:block">
            <span className="text-foreground/90 font-medium">Reiz Admin</span>
            <span className="mx-2 text-foreground/30">/</span>
            <span className="truncate">
              {pathname === "/dashboard"
                ? "Resumen"
                : nav.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))
                    ?.label ?? "Panel"}
            </span>
          </div>
          <Link
            href="/dashboard/buscar"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "text-muted-foreground hidden h-8 gap-2 px-3 font-normal no-underline md:inline-flex"
            )}
          >
            <Search className="size-3.5" />
            Buscar
            <kbd className="bg-muted text-muted-foreground pointer-events-none hidden rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium select-none lg:inline">
              ⌘K
            </kbd>
          </Link>
          <span className="text-muted-foreground flex-1 text-xs md:hidden">
            Panel interno
          </span>
          <ThemeToggle />
        </header>
        <div className={cn("flex flex-1 flex-col gap-4 p-4 md:p-6")}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
