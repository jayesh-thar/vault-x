import { useEffect, useRef, useState } from 'react';
import { MSG } from '../../lib/messages';
import type {
  GetVaultItemsResponse,
  CheckSessionResponse,
} from '../../lib/messages';
import type { DecryptedItem } from '../../types';
import VaultItem from '../components/VaultItem';

interface Props {
  onLogout: () => void;
}
type Filter = 'all' | 'login' | 'note' | 'card';

export default function Vault({ onLogout }: Props) {
  const [items, setItems] = useState<DecryptedItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [email, setEmail] = useState('');
  const loadedRef = useRef(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadItems();
    // Get email from session
    chrome.runtime
      .sendMessage<object, CheckSessionResponse>({ type: MSG.CHECK_SESSION })
      .then((res) => {
        if (res.email) setEmail(res.email);
      });
  }, []);

  // Close profile popup on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setShowProfile(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function loadItems() {
    setLoading(true);
    try {
      const res = await chrome.runtime.sendMessage<
        object,
        GetVaultItemsResponse
      >({
        type: MSG.GET_VAULT_ITEMS,
      });
      setLoading(false);
      if (res.success && res.items) {
        const seen = new Set<string>();
        const unique = res.items.filter((i) => {
          if (seen.has(i.id)) return false;
          seen.add(i.id);
          return true;
        });
        setItems(unique);
      } else if (res.error === 'SESSION_EXPIRED') {
        onLogout();
      } else {
        setError(res.error ?? 'Failed to load vault');
      }
    } catch {
      setLoading(false);
      setError('Network error');
    }
  }

  async function handleLogout() {
    await chrome.runtime.sendMessage({ type: MSG.LOGOUT });
    onLogout();
  }

  const counts = {
    all: items.length,
    login: items.filter((i) => i.type === 'login').length,
    note: items.filter((i) => i.type === 'note').length,
    card: items.filter((i) => i.type === 'card').length,
  };

  const filtered = items.filter((item) => {
    const matchFilter = filter === 'all' || item.type === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      item.payload.title.toLowerCase().includes(q) ||
      item.payload.username?.toLowerCase().includes(q) ||
      item.payload.url?.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  // Avatar initials from email
  const initials = email ? email.slice(0, 2).toUpperCase() : 'VX';
  const displayName = email ? email.split('@')[0] : 'User';

  return (
    <div style={s.page}>
      {/* Topbar */}
      <div style={s.topbar}>
        <div style={s.logo}>
          🔐 <span style={s.logoText}>VaultX</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button style={s.iconBtn} onClick={loadItems} title="Refresh">
            ↻
          </button>

          {/* Profile button */}
          <div style={{ position: 'relative' }} ref={profileRef}>
            <button
              style={s.avatarBtn}
              onClick={() => setShowProfile((p) => !p)}
              title="Profile"
            >
              {initials}
            </button>

            {/* Profile dropdown */}
            {showProfile && (
              <div style={s.profilePopup}>
                {/* Avatar + info */}
                <div style={s.profileHeader}>
                  <div style={s.avatarLarge}>{initials}</div>
                  <div style={{ overflow: 'hidden' }}>
                    <p style={s.profileName}>{displayName}</p>
                    <p style={s.profileEmail}>{email}</p>
                  </div>
                </div>

                <div style={s.profileDivider} />

                {/* Info rows */}
                <div style={s.profileRows}>
                  <div style={s.profileRow}>
                    <span style={s.profileRowLabel}>Encryption</span>
                    <span style={s.profileRowValue}>AES-256-GCM</span>
                  </div>
                  <div style={s.profileRow}>
                    <span style={s.profileRowLabel}>Items</span>
                    <span style={s.profileRowValue}>{counts.all}</span>
                  </div>
                  <div style={s.profileRow}>
                    <span style={s.profileRowLabel}>Status</span>
                    <span style={{ ...s.profileRowValue, color: '#10b981' }}>
                      ● Encrypted
                    </span>
                  </div>
                </div>

                <div style={s.profileDivider} />

                {/* Actions */}
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                >
                  <button
                    style={s.profileAction}
                    onClick={() => {
                      chrome.tabs.create({
                        url: 'http://localhost:5173/settings',
                      });
                      setShowProfile(false);
                    }}
                  >
                    ⚙️ Settings & Card PIN
                  </button>
                  <button
                    style={{ ...s.profileAction, ...s.profileActionDanger }}
                    onClick={handleLogout}
                  >
                    🔒 Lock & Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={s.searchWrap}>
        <span style={s.searchIcon}>⌕</span>
        <input
          style={s.search}
          placeholder="Search vault..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button style={s.clearBtn} onClick={() => setSearch('')}>
            ✕
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div style={s.tabs}>
        {(['all', 'login', 'note', 'card'] as Filter[]).map((f) => (
          <button
            key={f}
            style={{ ...s.tab, ...(filter === f ? s.tabActive : {}) }}
            onClick={() => setFilter(f)}
          >
            {f === 'all'
              ? '🔒'
              : f === 'login'
                ? '🔑'
                : f === 'note'
                  ? '📝'
                  : '💳'}{' '}
            {f}
            {counts[f] > 0 && <span style={s.badge}>{counts[f]}</span>}
          </button>
        ))}
      </div>

      {/* Items list */}
      <div style={s.list}>
        {loading && <p style={s.center}>Decrypting vault...</p>}
        {error && <p style={s.errText}>{error}</p>}
        {!loading && filtered.length === 0 && !error && (
          <div style={s.empty}>
            <p style={{ fontSize: 28 }}>🔍</p>
            <p>{search ? 'No results found' : 'No items yet'}</p>
            <p style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
              Add items from the web app
            </p>
          </div>
        )}
        {filtered.map((item) => (
          <VaultItem
            key={item.id}
            item={item}
            onDeleted={(id) =>
              setItems((prev) => prev.filter((i) => i.id !== id))
            }
          />
        ))}
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <span>
          {counts.all} item{counts.all !== 1 ? 's' : ''}
        </span>
        <span style={{ color: '#10b981' }}>● Zero-knowledge</span>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: 600,
    background: '#0f172a',
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #1e293b',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 },
  logoText: { fontWeight: 800, color: '#10b981', fontSize: 16 },
  iconBtn: {
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid #1e293b',
    background: 'transparent',
    color: '#64748b',
    fontSize: 15,
    cursor: 'pointer',
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '2px solid #10b981',
    background: '#10b98122',
    color: '#10b981',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePopup: {
    position: 'absolute',
    right: 0,
    top: 40,
    width: 240,
    background: '#1e293b',
    borderRadius: 12,
    border: '1px solid #334155',
    padding: 14,
    zIndex: 100,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  avatarLarge: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: '#10b98122',
    border: '2px solid #10b981',
    color: '#10b981',
    fontSize: 14,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profileName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#f1f5f9',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  profileEmail: {
    fontSize: 11,
    color: '#64748b',
    margin: '2px 0 0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  profileDivider: { height: 1, background: '#334155', margin: '10px 0' },
  profileRows: { display: 'flex', flexDirection: 'column', gap: 6 },
  profileRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileRowLabel: { fontSize: 12, color: '#64748b' },
  profileRowValue: { fontSize: 12, color: '#94a3b8' },
  profileAction: {
    padding: '8px 10px',
    borderRadius: 8,
    border: 'none',
    background: '#0f172a',
    color: '#94a3b8',
    fontSize: 12,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  profileActionDanger: { color: '#f87171', marginTop: 2 },
  searchWrap: {
    position: 'relative',
    margin: '12px 16px 0',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    color: '#475569',
    fontSize: 18,
  },
  search: {
    width: '100%',
    padding: '9px 36px',
    borderRadius: 8,
    border: '1px solid #1e293b',
    background: '#1e293b',
    color: '#f1f5f9',
    fontSize: 13,
    outline: 'none',
  },
  clearBtn: {
    position: 'absolute',
    right: 10,
    background: 'none',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    fontSize: 13,
  },
  tabs: {
    display: 'flex',
    gap: 4,
    padding: '10px 16px',
    borderBottom: '1px solid #1e293b',
  },
  tab: {
    flex: 1,
    padding: '6px 4px',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabActive: { background: '#1e293b', color: '#10b981', fontWeight: 600 },
  badge: {
    background: '#10b981',
    color: '#000',
    borderRadius: 10,
    padding: '0 5px',
    fontSize: 10,
    fontWeight: 700,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  center: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 13,
    margin: 'auto',
  },
  errText: { color: '#f87171', fontSize: 12, textAlign: 'center' },
  empty: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 13,
    margin: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderTop: '1px solid #1e293b',
    fontSize: 11,
    color: '#475569',
  },
};
