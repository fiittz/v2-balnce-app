/**
 * In-memory rate limiter for Supabase Edge Functions.
 * Uses a sliding window counter per user.
 *
 * Note: Deno Deploy reuses isolates, so this works well for
 * catching burst abuse. On cold starts the map resets, which
 * is acceptable — it's a first line of defence, not the only one.
 */

interface RateEntry {
  timestamps: number[];
}

const store = new Map<string, RateEntry>();

// Clean up stale entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

/**
 * Check if a user has exceeded their rate limit.
 *
 * @param userId    The authenticated user's ID
 * @param endpoint  A label for the endpoint (e.g. "chat", "receipt")
 * @param maxRequests  Max requests allowed in the window
 * @param windowMs     Window size in milliseconds (default 60s)
 * @returns { allowed: boolean, retryAfterMs?: number }
 */
export function checkRateLimit(
  userId: string,
  endpoint: string,
  maxRequests: number,
  windowMs = 60_000
): { allowed: boolean; retryAfterMs?: number } {
  cleanup(windowMs);

  const key = `${endpoint}:${userId}`;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = windowMs - (now - oldest);
    return { allowed: false, retryAfterMs };
  }

  entry.timestamps.push(now);
  return { allowed: true };
}

/**
 * Helper to return a 429 Response with proper headers.
 */
export function rateLimitResponse(
  retryAfterMs: number,
  corsHeaders: Record<string, string>
): Response {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again shortly.",
      retryAfterSeconds: retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}
