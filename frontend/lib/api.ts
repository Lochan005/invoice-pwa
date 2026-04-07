/**
 * Normalized API origin for Vercel same-origin (empty = relative /api/...) or full URL.
 */
export function getApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';
  return raw.trim().replace(/\/+$/, '');
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
