/**
 * fetch с таймаутом через AbortController.
 *
 * Отличие от нативного fetch: зависший сервис не вешает запрос навсегда —
 * по истечении timeoutMs промис реджектится ошибкой с name === 'TimeoutError'.
 */
const DEFAULT_TIMEOUT_MS = 5_000;

export interface FetchTimeoutError extends Error {
  name: 'TimeoutError';
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      const timeoutError = new Error(
        `Timeout (${timeoutMs}ms): ${init.method ?? 'GET'} ${url}`,
      ) as FetchTimeoutError;
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
