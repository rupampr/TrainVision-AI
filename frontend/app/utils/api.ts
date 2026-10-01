// API and WebSocket connection utilities with Next.js proxy and loopback fallback

export async function fetchBackend(path: string, options?: RequestInit): Promise<Response> {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, options);
  }

  // 1. Try same-origin Next.js reverse proxy (/api/backend/...)
  try {
    const res = await fetch(`/api/backend${path}`, options);
    if (res.status !== 404) {
      return res;
    }
  } catch {
    // Proxy not available or failed, fallback to direct below
  }

  // 2. Direct backend fallback
  const host = typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "localhost"
    : "127.0.0.1";
  return fetch(`http://${host}:8000${path}`, options);
}

export function getWebSocketUrl(path: string = "/ws"): string {
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return `${process.env.NEXT_PUBLIC_WS_URL}${path}`;
  }
  const host = typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "localhost"
    : "127.0.0.1";
  return `ws://${host}:8000${path}`;
}
