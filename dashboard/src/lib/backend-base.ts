/**
 * Railway Express API base (same host as Twilio webhooks), e.g. https://xxx.up.railway.app
 * Used by the /api/backend proxy and SSR fetches. On Vercel you MUST set one of these.
 */
export function getBackendApiBase(): string {
  const raw =
    process.env.BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_BACKEND_URL?.trim() ||
    '';
  return raw.replace(/\/+$/, '');
}

/**
 * For the Next.js proxy: in production (Vercel) return null if unset so we 503 with a clear message
 * instead of calling http://localhost (which always fails on Vercel).
 */
export function resolveBackendBaseForProxy(): string | null {
  const b = getBackendApiBase();
  if (b) return b;
  if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    return null;
  }
  return (process.env.LOCAL_BACKEND_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
}
