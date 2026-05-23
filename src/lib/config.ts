/** Base del backend Django (sin barra final). Ej: http://127.0.0.1:8000 */
export function getApiOrigin(): string {
  if (typeof window !== "undefined") {
    return (process.env.NEXT_PUBLIC_API_URL || "https://reiz-backend.onrender.com").replace(
      /\/$/,
      ""
    );
  }
  return (process.env.NEXT_PUBLIC_API_URL || "https://reiz-backend.onrender.com").replace(
    /\/$/,
    ""
  );
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getApiOrigin()}${p}`;
}
