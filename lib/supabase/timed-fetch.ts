const INTERACTIVE_TIMEOUT_MS = 8_000;
const SLOW_REQUEST_MS = 1_500;

function getMethod(input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
  return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
}

function getSafeTarget(input: Parameters<typeof fetch>[0]) {
  const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input.url;

  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "supabase";
  }
}

export function createTimedFetch(timeoutMs: number = INTERACTIVE_TIMEOUT_MS): typeof fetch {
  return async (input, init) => {
    const method = getMethod(input, init);
    const maxAttempts = method === "GET" ? 2 : 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const startedAt = performance.now();
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const signal = init?.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;

      try {
        return await fetch(input, { ...init, signal });
      } catch (error) {
        lastError = error;

        if (init?.signal?.aborted || attempt === maxAttempts) {
          throw error;
        }
      } finally {
        const durationMs = performance.now() - startedAt;

        if (durationMs >= SLOW_REQUEST_MS) {
          console.warn("Slow Supabase request", {
            method,
            target: getSafeTarget(input),
            durationMs: Math.round(durationMs),
            attempt
          });
        }
      }
    }

    throw lastError;
  };
}
