"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Search,
  Smartphone,
  Sparkles,
  Star,
  UserCircle2,
  Users,
  Wrench,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-provider";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { ReizMark } from "@/components/reiz-mark";
import { initialsFrom } from "@/lib/labels";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Principal",
    items: [
      { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
      { href: "/dashboard/buscar", label: "Resolver casos", icon: Search },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { href: "/dashboard/reservas", label: "Reservas", icon: CalendarDays },
      { href: "/dashboard/clientes", label: "Clientes", icon: UserCircle2 },
      { href: "/dashboard/negocios", label: "Negocios", icon: Building2 },
      { href: "/dashboard/usuarios", label: "Usuarios", icon: Users },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/dashboard/servicios", label: "Servicios", icon: Wrench },
      { href: "/dashboard/equipo", label: "Equipo", icon: Briefcase },
      { href: "/dashboard/resenas", label: "Reseñas", icon: Star },
    ],
  },
  {
    label: "Comunicación",
    items: [
      { href: "/dashboard/novedades", label: "Novedades", icon: Sparkles },
      { href: "/dashboard/notificaciones", label: "Notificaciones", icon: Bell },
      { href: "/dashboard/evolution", label: "WhatsApp", icon: MessageCircle },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/dashboard/favoritos", label: "Favoritos", icon: Heart },
      { href: "/dashboard/tokens", label: "Device tokens", icon: Smartphone },
    ],
  },
];

const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

function isActivePath(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`))
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { open, setOpen } = useCommandPalette();

  const current = ALL_NAV.find((n) => isActivePath(pathname, n.href));
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    user?.email ||
    "Staff";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <ReizMark className="size-8" />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold tracking-tight">
                Reiz Admin
              </p>
              <p className="text-sidebar-foreground/55 truncate text-[11px]">
                Operaciones internas
              </p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {NAV_GROUPS.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActivePath(pathname, item.href)}
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
          ))}
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="hover:bg-sidebar-accent flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none"
                >
                  <Avatar size="sm" className="size-8">
                    <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-[11px]">
                      {initialsFrom(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <span className="block truncate text-sm font-medium">
                      {displayName}
                    </span>
                    <span className="text-sidebar-foreground/55 block truncate text-[11px]">
                      {user?.email}
                    </span>
                  </span>
                </button>
              }
            />
            <DropdownMenuContent
              side="top"
              align="start"
              className="w-56 min-w-56"
            >
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {user?.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => logout()}
              >
                <LogOut />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="bg-background/80 supports-backdrop-filter:bg-background/60 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-md">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <div className="hidden min-w-0 flex-1 md:block">
            <p className="text-muted-foreground text-xs">Panel interno</p>
            <p className="truncate text-sm font-medium">
              {current?.label ?? "Reiz Admin"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "text-muted-foreground hidden h-9 max-w-sm flex-1 justify-start gap-2 px-3 font-normal md:inline-flex"
            )}
          >
            <Search className="size-3.5" />
            Resolver un caso…
            <kbd className="bg-muted text-muted-foreground pointer-events-none ml-auto hidden rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium select-none lg:inline">
              ⌘K
            </kbd>
          </button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Buscar"
          >
            <Search className="size-4" />
          </Button>
          <ThemeToggle />
        </header>
        <div className="admin-canvas flex flex-1 flex-col gap-4 p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </SidebarProvider>
  );
}
