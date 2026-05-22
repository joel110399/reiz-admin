import { apiUrl } from "./config";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./auth-storage";

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const res = await fetch(apiUrl("/api/token/refresh/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    clearTokens();
    return false;
  }
  const data = (await res.json()) as { access: string; refresh?: string };
  const nextRefresh = data.refresh ?? getRefreshToken();
  if (nextRefresh) setTokens(data.access, nextRefresh);
  else clearTokens();
  return true;
}

export type ApiFetchOptions = RequestInit & { skipAuth?: boolean };

/**
 * Fetch al API Django con Bearer JWT y un reintento tras 401 + refresh.
 */
export async function apiFetch(
  path: string,
  init: ApiFetchOptions = {}
): Promise<Response> {
  const { skipAuth, ...rest } = init;
  const url = path.startsWith("http") ? path : apiUrl(path);
  const headers = new Headers(rest.headers);

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  if (
    rest.body &&
    typeof rest.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  let res = await fetch(url, { ...rest, headers });

  if (res.status === 401 && !skipAuth && getRefreshToken()) {
    const ok = await tryRefresh();
    if (ok) {
      const retryHeaders = new Headers(rest.headers);
      const t = getAccessToken();
      if (t) retryHeaders.set("Authorization", `Bearer ${t}`);
      res = await fetch(url, { ...rest, headers: retryHeaders });
    }
  }

  return res;
}

export function formatApiErrorBody(text: string, status: string): string {
  if (!text.trim()) return status;
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) return j.detail.map(String).join(", ");
    if (Array.isArray(j.non_field_errors))
      return (j.non_field_errors as string[]).join(", ");
    const parts: string[] = [];
    for (const [k, v] of Object.entries(j)) {
      if (v === undefined) continue;
      parts.push(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
    }
    return parts.join(" · ") || text;
  } catch {
    return text;
  }
}

export async function apiJson<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(formatApiErrorBody(text, res.statusText));
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
