import axios from 'axios';

let _accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  _accessToken = token;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000', // ← was 3000, should be 5000
  withCredentials: true,
});

// Attach access token to every outgoing request
api.interceptors.request.use((config) => {
  if (_accessToken) {
    config.headers.Authorization = `Bearer ${_accessToken}`;
  }
  return config;
});

// Auto-refresh logic
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(undefined);
  });
  failedQueue = [];
};

// Multi-tab token sync via BroadcastChannel
try {
  const syncChannel = new BroadcastChannel('vaultx_auth');
  syncChannel.addEventListener('message', (e) => {
    if (e.data?.type === 'TOKEN_REFRESH' && e.data.accessToken) {
      // Another tab refreshed — use their new token
      setAccessToken(e.data.accessToken);
    }
  });
} catch {
  // BroadcastChannel not available in some environments (private mode, old browsers)
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      // Don't intercept auth endpoints — 401 there = wrong credentials
      if (original.url?.includes('/auth/')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(original))
          .catch((err) => Promise.reject(err));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const res = await api.post<{ accessToken: string }>(
          '/api/auth/refresh'
        );
        const newToken = res.data.accessToken;
        setAccessToken(newToken);

        // Broadcast new token to other open tabs
        try {
          new BroadcastChannel('vaultx_auth').postMessage({
            type: 'TOKEN_REFRESH',
            accessToken: newToken,
          });
        } catch {
          /* ignore if BroadcastChannel unavailable */
        }

        processQueue(null);
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError);
        const { useVaultStore } = await import('../store/useVaultStore');
        useVaultStore.getState().clearSession();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
