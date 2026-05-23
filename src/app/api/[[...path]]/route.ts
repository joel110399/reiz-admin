import { NextRequest, NextResponse } from "next/server";

import { getApiOrigin } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function upstreamUrl(pathSegments: string[], search: string): string {
  const base = getApiOrigin().replace(/\/$/, "");
  const rest = pathSegments.length ? `/${pathSegments.join("/")}/` : "";
  return `${base}${rest}${search}`;
}

function forwardHeaders(request: NextRequest): Headers {
  const h = new Headers();
  const accept = request.headers.get("accept");
  if (accept) h.set("Accept", accept);
  const auth = request.headers.get("authorization");
  if (auth) h.set("Authorization", auth);
  const ct = request.headers.get("content-type");
  if (ct) h.set("Content-Type", ct);
  return h;
}

async function proxy(request: NextRequest, pathSegments: string[]) {
  const url = upstreamUrl(pathSegments, request.nextUrl.search);
  const method = request.method;

  const init: RequestInit = {
    method,
    headers: forwardHeaders(request),
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 0) {
      init.body = buf;
    }
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upstream error";
    return NextResponse.json(
      { detail: `No se pudo conectar con el backend: ${msg}` },
      { status: 502 }
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.arrayBuffer();

  const out = new NextResponse(body, { status: res.status });
  if (contentType) out.headers.set("Content-Type", contentType);
  return out;
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function getPath(ctx: RouteCtx): Promise<string[]> {
  const p = await ctx.params;
  return p.path ?? [];
}

export async function GET(request: NextRequest, ctx: RouteCtx) {
  return proxy(request, await getPath(ctx));
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  return proxy(request, await getPath(ctx));
}

export async function PUT(request: NextRequest, ctx: RouteCtx) {
  return proxy(request, await getPath(ctx));
}

export async function PATCH(request: NextRequest, ctx: RouteCtx) {
  return proxy(request, await getPath(ctx));
}

export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  return proxy(request, await getPath(ctx));
}

export async function OPTIONS(request: NextRequest, ctx: RouteCtx) {
  return proxy(request, await getPath(ctx));
}
