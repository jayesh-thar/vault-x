// Fetch wrapper for VaultX Express API
// All API calls go through the service worker — never directly from content script

const API_BASE = 'http://localhost:5000';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // sends httpOnly refresh token cookie
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  // Auto-refresh on 401 — try once
  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Update session with new token
      const sessionRes = await chrome.storage.session.get('session');
      if (sessionRes.session) {
        await chrome.storage.session.set({
          session: { ...sessionRes.session, accessToken: newToken },
        });
      }
      // Retry original request with new token
      const retry = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
        },
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!retry.ok) {
        const err = await retry
          .json()
          .catch(() => ({ message: retry.statusText }));
        throw new Error(err.message || `API error ${retry.status}`);
      }
      return retry.json() as Promise<T>;
    } else {
      // Refresh failed — session truly expired, clear it
      await chrome.storage.session.remove('session');
      throw new Error('SESSION_EXPIRED');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}
