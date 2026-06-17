import { useState } from 'react';
import { MSG } from '../../lib/messages';
import type { LoginResponse } from '../../lib/messages';

interface Props {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail || !password) {
      setError('Both fields required');
      return;
    }
    setError('');
    setLoading(true);
    const res = await chrome.runtime.sendMessage<object, LoginResponse>({
      type: MSG.LOGIN,
      payload: { email: normalizedEmail, password },
    });
    setLoading(false);
    if (res.success) onLoginSuccess();
    else
      setError(
        res.error?.includes('Invalid')
          ? 'Wrong email or password. New here? Create an account below.'
          : (res.error ?? 'Login failed')
      );
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={{ fontSize: 32 }}>🔐</div>
        <h1 style={s.title}>VaultX</h1>
        <p style={s.sub}>Zero-knowledge password manager</p>
      </div>
      <div style={s.card}>
        <div style={s.field}>
          <label style={s.label}>Email</label>
          <input
            style={s.input}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
        </div>
        <div style={s.field}>
          <label style={s.label}>Master Password</label>
          <input
            style={s.input}
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>
        {error && <div style={s.errorBox}>⚠ {error}</div>}
        <button
          style={{ ...s.btn, opacity: loading ? 0.75 : 1 }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Unlocking... (~2s)' : 'Unlock Vault'}
        </button>

        <button
          style={s.backBtn}
          onClick={() =>
            chrome.tabs.create({
              url: `${import.meta.env.VITE_WEB_URL}/forgot-password`,
            })
          }
        >
          Forgot password?
        </button>

        <div style={s.divider}>
          <div style={s.divLine} />
          <span style={s.divText}>new here?</span>
          <div style={s.divLine} />
        </div>
        <button
          style={s.registerBtn}
          onClick={() =>
            chrome.tabs.create({
              url: `${import.meta.env.VITE_WEB_URL}/register`,
            })
          }
        >
          Create account →
        </button>
        <p style={s.hint}>PBKDF2 · 600k iterations · ~2s intentionally</p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: '20px 18px',
    gap: 16,
    minHeight: 520,
    background: '#0f172a',
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  title: { fontSize: 22, fontWeight: 800, color: '#10b981', margin: 0 },
  sub: { fontSize: 11, color: '#64748b', margin: 0 },
  card: {
    background: '#1e293b',
    borderRadius: 12,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    border: '1px solid #334155',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: {
    fontSize: 10,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    padding: '9px 11px',
    borderRadius: 7,
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#f1f5f9',
    fontSize: 13,
    outline: 'none',
  },
  btn: {
    padding: '10px 0',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg,#10b981,#059669)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  registerBtn: {
    padding: '9px 0',
    borderRadius: 8,
    border: '1px solid #334155',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: 12,
    cursor: 'pointer',
  },
  divider: { display: 'flex', alignItems: 'center', gap: 8 },
  divLine: { flex: 1, height: 1, background: '#334155' },
  divText: { fontSize: 10, color: '#475569' },
  errorBox: {
    padding: '8px 10px',
    borderRadius: 7,
    background: '#450a0a',
    border: '1px solid #7f1d1d',
    color: '#fca5a5',
    fontSize: 12,
  },
  hint: { textAlign: 'center', fontSize: 10, color: '#334155' },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: 11,
    cursor: 'pointer',
    textAlign: 'center',
  },
};
