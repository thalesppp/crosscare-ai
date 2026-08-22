import { lt, sql } from "drizzle-orm";
import { mutationRateLimits } from "@/db/schema";

type MutationGuardOptions = {
  scope: string;
  limit: number;
  windowSeconds?: number;
};

type MemoryBucket = {
  count: number;
  expiresAt: number;
};

const DEFAULT_WINDOW_SECONDS = 60;
const FALLBACK_BUCKET_LIMIT = 512;
const fallbackBuckets = new Map<string, MemoryBucket>();

export async function guardPublicMutation(
  request: Request,
  options: MutationGuardOptions,
): Promise<Response | null> {
  const originRejection = rejectInvalidOrigin(request);
  if (originRejection) return originRejection;

  const windowSeconds = Math.max(
    1,
    Math.floor(options.windowSeconds ?? DEFAULT_WINDOW_SECONDS),
  );
  const limit = Math.max(1, Math.floor(options.limit));
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = nowSeconds - (nowSeconds % windowSeconds);
  const clientKey = await getClientKey(request);

  let count: number;
  try {
    count = await consumeD1Bucket(
      clientKey,
      options.scope,
      windowStart,
      nowSeconds,
    );
  } catch {
    count = consumeMemoryBucket(
      clientKey,
      options.scope,
      windowStart,
      windowSeconds,
      nowSeconds,
    );
  }

  if (count <= limit) return null;

  const retryAfter = Math.max(1, windowStart + windowSeconds - nowSeconds);
  return Response.json(
    {
      error: "操作过于频繁，请稍后再试。",
      code: "rate_limit_exceeded",
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfter),
        Vary: "Origin",
      },
    },
  );
}

function rejectInvalidOrigin(request: Request): Response | null {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!origin && isLocalPreview(requestUrl)) return null;

  let isSameOrigin = false;
  if (origin) {
    try {
      isSameOrigin = new URL(origin).origin === requestUrl.origin;
    } catch {
      isSameOrigin = false;
    }
  }

  if (isSameOrigin && (!fetchSite || fetchSite === "same-origin")) return null;

  return Response.json(
    {
      error: "请求来源无效，请从 CrossCare 页面内操作。",
      code: "invalid_request_origin",
    },
    {
      status: 403,
      headers: {
        "Cache-Control": "no-store",
        Vary: "Origin",
      },
    },
  );
}

function isLocalPreview(url: URL): boolean {
  return (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]"
  );
}

async function getClientKey(request: Request): Promise<string> {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0];
  const networkIdentity =
    request.headers.get("cf-connecting-ip") ??
    forwardedFor?.trim() ??
    "local-preview";
  const userAgent = request.headers.get("user-agent")?.slice(0, 256) ?? "unknown";
  const source = `${networkIdentity}\u0000${userAgent}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .slice(0, 32);
}

async function consumeD1Bucket(
  clientKey: string,
  scope: string,
  windowStart: number,
  nowSeconds: number,
): Promise<number> {
  // Load the platform binding only for an accepted request. This keeps origin
  // rejection and local preview usable when Cloudflare bindings are absent.
  const { getDb } = await import("@/db");
  const db = getDb();
  const [bucket] = await db
    .insert(mutationRateLimits)
    .values({ clientKey, scope, windowStart, requestCount: 1 })
    .onConflictDoUpdate({
      target: [
        mutationRateLimits.clientKey,
        mutationRateLimits.scope,
        mutationRateLimits.windowStart,
      ],
      set: {
        requestCount: sql`${mutationRateLimits.requestCount} + 1`,
      },
    })
    .returning({ requestCount: mutationRateLimits.requestCount });

  // Keep only recent counters. Cleanup failure must not disable a valid limit.
  try {
    await db
      .delete(mutationRateLimits)
      .where(lt(mutationRateLimits.windowStart, nowSeconds - 86_400));
  } catch {
    // A request counter was already recorded, so continue with that result.
  }

  if (!bucket) throw new Error("Rate-limit counter was not returned");
  return Number(bucket.requestCount);
}

function consumeMemoryBucket(
  clientKey: string,
  scope: string,
  windowStart: number,
  windowSeconds: number,
  nowSeconds: number,
): number {
  pruneFallbackBuckets(nowSeconds);
  const key = `${clientKey}:${scope}:${windowStart}`;
  const existing = fallbackBuckets.get(key);
  const next: MemoryBucket = {
    count: (existing?.count ?? 0) + 1,
    expiresAt: windowStart + windowSeconds,
  };
  fallbackBuckets.set(key, next);
  return next.count;
}

function pruneFallbackBuckets(nowSeconds: number) {
  for (const [key, bucket] of fallbackBuckets) {
    if (bucket.expiresAt <= nowSeconds) fallbackBuckets.delete(key);
  }

  while (fallbackBuckets.size > FALLBACK_BUCKET_LIMIT) {
    const oldestKey = fallbackBuckets.keys().next().value;
    if (typeof oldestKey !== "string") break;
    fallbackBuckets.delete(oldestKey);
  }
}
