/**
 * Normalized API origin for Vercel same-origin (empty = relative /api/...) or full URL.
 *
 * If EXPO_PUBLIC_BACKEND_URL points at another origin than the page (e.g. *.vercel.app
 * while users open a custom domain), browsers often fail with "Failed to fetch" (CORS/network).
 * In that case we clear the base so requests stay same-origin (unified Vercel /api route).
 */

function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

export function getApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      if (!/^https?:\/\//i.test(trimmed)) {
        return trimmed;
      }
      const envOrigin = new URL(trimmed).origin;
      const pageOrigin = window.location.origin;
      if (envOrigin === pageOrigin) {
        return trimmed;
      }

      const envHost = new URL(trimmed).hostname;
      const pageHost = new URL(pageOrigin).hostname;
      if (envHost === pageHost) {
        return trimmed;
      }
      if (isLoopbackOrigin(envOrigin) || isLoopbackOrigin(pageOrigin)) {
        return trimmed;
      }

      console.warn(
        `[api] EXPO_PUBLIC_BACKEND_URL (${envOrigin}) does not match page (${pageOrigin}); using same-origin /api`
      );
      return '';
    } catch {
      /* bad URL */
    }
  }

  return trimmed;
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${p}` : p;
}

export async function parseApiError(res: Response): Promise<string> {
  const text = await res.text().catch(String);
  try {
    const data = text ? JSON.parse(text) : {};
    const d = data?.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d))
      return d.map((x: { msg?: string }) => x?.msg || JSON.stringify(x)).join('; ');
    if (d != null && typeof d === 'object') return JSON.stringify(d);
    if (data?.message && typeof data.message === 'string') return data.message;
    return text.slice(0, 200) || res.statusText || `HTTP ${res.status}`;
  } catch {
    return text.slice(0, 200) || res.statusText || `HTTP ${res.status}`;
  }
}

/** User-visible hint when fetch() rejects (often CORS, wrong API host, or mixed content). */
export function mapFetchFailureMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return (
      'Could not reach the API (network). If you use a custom domain, clear EXPO_PUBLIC_BACKEND_URL ' +
      'in Vercel or set it to this site’s exact URL, then redeploy. You can also open DevTools → Network ' +
      'and check the /api/invoices request.'
    );
  }
  return msg;
}
