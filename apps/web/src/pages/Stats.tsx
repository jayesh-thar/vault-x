import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { decrypt } from '../lib/crypto';
import { useVaultStore } from '../store/useVaultStore';
import type { VaultItem } from '../store/useVaultStore';
import type { ItemPayload } from './Dashboard';

function strengthLabel(bars: number) {
  return bars === 1
    ? 'Weak'
    : bars === 2
      ? 'Fair'
      : bars === 3
        ? 'Good'
        : 'Strong';
}
function strengthColor(bars: number) {
  return bars <= 2 ? '#EF4444' : bars === 3 ? '#F59E0B' : '#10B981';
}
function getStrengthBars(p: string): number {
  if (p.length < 8) return 1;
  let s = 0;
  if (/[A-Z]/.test(p)) s++;
  if (/[a-z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  if (p.length < 12) return Math.min(s, 2);
  return s <= 1 ? 2 : s === 2 ? 3 : 4;
}

interface Stats {
  total: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  byStrength: Record<string, number>;
  reused: number;
  avgPasswordLength: number;
  oldPasswords: number;
  withTotp: number;
  withTags: number;
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border)',
      }}
    >
      <p
        className="text-3xl font-bold"
        style={{ color: color ?? 'var(--accent)' }}
      >
        {value}
      </p>
      <p
        className="text-sm font-medium mt-0.5"
        style={{ color: 'var(--text-primary)' }}
      >
        {label}
      </p>
      {sub && (
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function BarRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-xs w-16 text-right flex-shrink-0"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </span>
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ background: 'var(--border)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: total > 0 ? `${(count / total) * 100}%` : '0%',
            background: color,
          }}
        />
      </div>
      <span
        className="text-xs w-6 text-right flex-shrink-0"
        style={{ color: 'var(--text-secondary)' }}
      >
        {count}
      </span>
    </div>
  );
}

export default function StatsPage() {
  const navigate = useNavigate();
  const { vaultKey } = useVaultStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!vaultKey) return;
      try {
        const { data } = await api.get('/api/vault/items');
        const raw: VaultItem[] = Array.isArray(data)
          ? data
          : (data.items ?? []);

        const byType: Record<string, number> = { login: 0, note: 0, card: 0 };
        const byCategory: Record<string, number> = {};
        const byStrength: Record<string, number> = {
          Strong: 0,
          Good: 0,
          Fair: 0,
          Weak: 0,
        };
        const passwords: string[] = [];
        let withTotp = 0,
          withTags = 0,
          oldPasswords = 0,
          totalPwLen = 0;

        for (const item of raw) {
          byType[item.type] = (byType[item.type] ?? 0) + 1;
          const cat = item.category?.trim() || 'Uncategorized';
          byCategory[cat] = (byCategory[cat] ?? 0) + 1;

          try {
            const plain = await decrypt(
              { ciphertext: item.encrypted_data, iv: item.iv },
              vaultKey
            );
            const payload = JSON.parse(plain) as ItemPayload;
            if (item.type === 'login' && payload.password) {
              const bars = getStrengthBars(payload.password);
              byStrength[strengthLabel(bars)]++;
              passwords.push(payload.password);
              totalPwLen += payload.password.length;
              if (payload.totpSecret) withTotp++;
              if (payload.passwordChangedAt) {
                const days = Math.floor(
                  (Date.now() - new Date(payload.passwordChangedAt).getTime()) /
                    86400000
                );
                if (days > 180) oldPasswords++;
              }
            }
            if ((payload.tags ?? []).length > 0) withTags++;
          } catch {
            /* skip */
          }
        }

        const passMap = new Map<string, number>();
        passwords.forEach((p) => passMap.set(p, (passMap.get(p) ?? 0) + 1));
        const reused = [...passMap.values()].filter((c) => c > 1).length;

        setStats({
          total: raw.length,
          byType,
          byCategory,
          byStrength,
          reused,
          avgPasswordLength:
            passwords.length > 0
              ? Math.round(totalPwLen / passwords.length)
              : 0,
          oldPasswords,
          withTotp,
          withTags,
        });
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [vaultKey]);

  const loginCount = stats?.byType.login ?? 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <header
        className="flex items-center gap-4 px-6 py-4 sticky top-0 z-10"
        style={{
          borderBottom: '0.5px solid var(--border)',
          background: 'var(--bg-surface)',
        }}
      >
        <button
          onClick={() => navigate('/dashboard')}
          aria-label="Back"
          className="flex items-center gap-2 text-sm vx-btn"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M19 12H5M5 12l7-7M5 12l7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Dashboard
        </button>
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--text-primary)' }}
        >
          Vault Statistics
        </span>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Analyzing vault...
            </p>
          </div>
        ) : !stats ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No data
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Overview */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total items" value={stats.total} />
              <StatCard
                label="Logins"
                value={stats.byType.login ?? 0}
                sub="password accounts"
              />
              <StatCard label="Secure notes" value={stats.byType.note ?? 0} />
              <StatCard label="Cards" value={stats.byType.card ?? 0} />
            </div>

            {/* Security metrics */}
            <div
              className="rounded-2xl p-5 flex flex-col gap-4"
              style={{
                background: 'var(--bg-surface)',
                border: '0.5px solid var(--border)',
              }}
            >
              <p
                className="text-xs font-semibold"
                style={{
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                Security Metrics
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label="Reused passwords"
                  value={stats.reused}
                  color={stats.reused > 0 ? '#EF4444' : '#10B981'}
                  sub={stats.reused > 0 ? 'Change these' : 'All unique ✓'}
                />
                <StatCard
                  label="Old passwords"
                  value={stats.oldPasswords}
                  color={stats.oldPasswords > 0 ? '#F59E0B' : '#10B981'}
                  sub="> 6 months old"
                />
                <StatCard
                  label="Avg password length"
                  value={`${stats.avgPasswordLength}c`}
                  color={
                    stats.avgPasswordLength >= 16
                      ? '#10B981'
                      : stats.avgPasswordLength >= 12
                        ? '#F59E0B'
                        : '#EF4444'
                  }
                  sub="chars"
                />
                <StatCard
                  label="With 2FA"
                  value={stats.withTotp}
                  sub={`of ${loginCount} logins`}
                />
              </div>
            </div>

            {/* Password strength distribution */}
            {loginCount > 0 && (
              <div
                className="rounded-2xl p-5 flex flex-col gap-4"
                style={{
                  background: 'var(--bg-surface)',
                  border: '0.5px solid var(--border)',
                }}
              >
                <p
                  className="text-xs font-semibold"
                  style={{
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Password Strength Distribution
                </p>
                <div className="flex flex-col gap-3">
                  {[
                    { label: 'Strong', bars: 4 },
                    { label: 'Good', bars: 3 },
                    { label: 'Fair', bars: 2 },
                    { label: 'Weak', bars: 1 },
                  ].map(({ label, bars }) => (
                    <BarRow
                      key={label}
                      label={label}
                      count={stats.byStrength[label] ?? 0}
                      total={loginCount}
                      color={strengthColor(bars)}
                    />
                  ))}
                </div>
                {/* Visual summary */}
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                  {[
                    { label: 'Strong', bars: 4 },
                    { label: 'Good', bars: 3 },
                    { label: 'Fair', bars: 2 },
                    { label: 'Weak', bars: 1 },
                  ].map(({ label, bars }) => {
                    const pct =
                      loginCount > 0
                        ? ((stats.byStrength[label] ?? 0) / loginCount) * 100
                        : 0;
                    return pct > 0 ? (
                      <div
                        key={label}
                        style={{
                          width: `${pct}%`,
                          background: strengthColor(bars),
                          minWidth: 2,
                        }}
                      />
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Categories breakdown */}
            {Object.keys(stats.byCategory).length > 0 && (
              <div
                className="rounded-2xl p-5 flex flex-col gap-3"
                style={{
                  background: 'var(--bg-surface)',
                  border: '0.5px solid var(--border)',
                }}
              >
                <p
                  className="text-xs font-semibold"
                  style={{
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Categories
                </p>
                <div className="flex flex-col gap-2">
                  {Object.entries(stats.byCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, count]) => (
                      <BarRow
                        key={cat}
                        label={cat}
                        count={count}
                        total={stats.total}
                        color="var(--accent)"
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Extra metrics */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Items with tags"
                value={stats.withTags}
                sub="organized items"
              />
              <StatCard
                label="2FA enabled"
                value={`${loginCount > 0 ? Math.round((stats.withTotp / loginCount) * 100) : 0}%`}
                sub="of login accounts"
                color={
                  stats.withTotp / loginCount > 0.5 ? '#10B981' : '#F59E0B'
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
