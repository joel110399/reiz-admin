"use client";

import * as React from "react";
import { apiJson } from "@/lib/api-client";
import { apiUrl } from "@/lib/config";
import { clearTokens, setTokens } from "@/lib/auth-storage";

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_staff: boolean;
  is_active: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refreshMe = React.useCallback(async () => {
    try {
      const u = await apiJson<AuthUser>("/api/auth/me/");
      setUser(u);
    } catch {
      setUser(null);
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        await refreshMe();
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshMe]);

  const login = React.useCallback(async (username: string, password: string) => {
    const res = await fetch(apiUrl("/api/token/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || "Credenciales inválidas");
    }
    const data = (await res.json()) as { access: string; refresh: string };
    setTokens(data.access, data.refresh);
    const u = await apiJson<AuthUser>("/api/auth/me/");
    setUser(u);
    if (!u.is_staff) {
      clearTokens();
      setUser(null);
      throw new Error(
        "Tu cuenta no tiene permisos de equipo (is_staff). Contacta a un administrador."
      );
    }
  }, []);

  const logout = React.useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const value = React.useMemo(
    () => ({ user, loading, login, logout, refreshMe }),
    [user, loading, login, logout, refreshMe]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
