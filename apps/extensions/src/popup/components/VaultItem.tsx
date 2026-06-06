import { useState } from 'react';
import type { DecryptedItem } from '../../types';

interface Props {
  item: DecryptedItem;
}

const TYPE_ICON: Record<string, string> = {
  login: '🔑',
  note: '📝',
  card: '💳',
};

// PIN for card reveal — stored per-session in component state
// Production note: this is "peek protection", not encryption
// The vault is already decrypted in memory; PIN just prevents casual shoulder-surfing
const CARD_PIN_KEY = 'vaultx_card_pin';

function getStoredPin(): string | null {
  return localStorage.getItem(CARD_PIN_KEY);
}

function savePin(pin: string) {
  localStorage.setItem(CARD_PIN_KEY, pin);
}

export default function VaultItem({ item }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false); // for notes
  const [cardUnlocked, setCardUnlocked] = useState(false); // for cards
  const [pinInput, setPinInput] = useState('');
  const [pinMode, setPinMode] = useState<'verify' | 'set' | null>(null);
  const [pinError, setPinError] = useState('');

  function copy(value: string, field: string) {
    navigator.clipboard.writeText(value);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  }

  function openUrl() {
    let url = item.payload.url ?? '';
    if (!url.startsWith('http')) url = 'https://' + url;
    chrome.tabs.create({ url });
  }

  function handleCardClick() {
    if (cardUnlocked) {
      setCardUnlocked(false);
      return;
    }
    const existing = getStoredPin();
    setPinMode(existing ? 'verify' : 'set');
    setPinInput('');
    setPinError('');
  }

  function handlePinSubmit() {
    const existing = getStoredPin();
    if (pinMode === 'set') {
      if (pinInput.length < 4) {
        setPinError('PIN must be 4 digits');
        return;
      }
      savePin(pinInput);
      setCardUnlocked(true);
      setPinMode(null);
    } else {
      if (pinInput === existing) {
        setCardUnlocked(true);
        setPinMode(null);
        setPinError('');
      } else {
        setPinError('Incorrect PIN');
        setPinInput('');
      }
    }
  }

  const { payload } = item;

  const domain = payload.url
    ? (() => {
        try {
          const u = payload.url.startsWith('http')
            ? payload.url
            : 'https://' + payload.url;
          return new URL(u).hostname;
        } catch {
          return payload.url;
        }
      })()
    : null;

  // ── LOGIN ITEM ──────────────────────────────────────────────────────────────
  if (item.type === 'login') {
    return (
      <div style={s.card}>
        <div style={s.left}>
          <div style={s.iconBox}>{TYPE_ICON.login}</div>
          <div style={s.info}>
            <p style={s.title}>{payload.title}</p>
            <p style={s.meta}>{payload.username || domain || '—'}</p>
          </div>
        </div>
        <div style={s.actions}>
          {payload.username && (
            <button
              style={s.btn}
              onClick={() => copy(payload.username!, 'user')}
            >
              {copied === 'user' ? '✓' : 'User'}
            </button>
          )}
          {payload.password && (
            <button
              style={s.btn}
              onClick={() => copy(payload.password!, 'pass')}
            >
              {copied === 'pass' ? '✓' : 'Pass'}
            </button>
          )}
          {payload.url && (
            <button
              style={{ ...s.btn, ...s.openBtn }}
              onClick={openUrl}
              title="Open site"
            >
              ↗
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── NOTE ITEM ───────────────────────────────────────────────────────────────
  if (item.type === 'note') {
    return (
      <div
        style={{
          ...s.card,
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 0,
        }}
      >
        <div
          style={{ ...s.left, justifyContent: 'space-between' }}
          onClick={() => setExpanded((e) => !e)}
        >
          <div style={{ ...s.left, cursor: 'pointer' }}>
            <div style={s.iconBox}>{TYPE_ICON.note}</div>
            <div style={s.info}>
              <p style={s.title}>{payload.title}</p>
              <p style={s.meta}>
                Secure note · click to {expanded ? 'collapse' : 'view'}
              </p>
            </div>
          </div>
          <div style={s.actions}>
            {payload.content && (
              <button
                style={s.btn}
                onClick={(e) => {
                  e.stopPropagation();
                  copy(payload.content!, 'note');
                }}
              >
                {copied === 'note' ? '✓' : 'Copy'}
              </button>
            )}
            <span style={{ color: '#475569', fontSize: 12, paddingRight: 4 }}>
              {expanded ? '▲' : '▼'}
            </span>
          </div>
        </div>
        {expanded && (
          <div style={s.noteBody}>
            {payload.content ? (
              <p style={s.noteText}>{payload.content}</p>
            ) : (
              <p style={{ color: '#475569', fontSize: 12 }}>No content</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── CARD ITEM ───────────────────────────────────────────────────────────────
  if (item.type === 'card') {
    // PIN entry overlay
    if (pinMode) {
      return (
        <div style={s.card}>
          <div style={{ width: '100%' }}>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
              {pinMode === 'set'
                ? '🔒 Set a 4-digit PIN to protect cards'
                : '🔒 Enter PIN to view card'}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...s.pinInput }}
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="• • • •"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/\D/g, ''));
                  setPinError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                autoFocus
              />
              <button
                style={{ ...s.btn, ...s.openBtn, padding: '6px 14px' }}
                onClick={handlePinSubmit}
              >
                {pinMode === 'set' ? 'Set' : 'Unlock'}
              </button>
              <button style={s.btn} onClick={() => setPinMode(null)}>
                ✕
              </button>
            </div>
            {pinError && (
              <p style={{ color: '#f87171', fontSize: 12, marginTop: 6 }}>
                {pinError}
              </p>
            )}
            {pinMode === 'verify' && (
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  fontSize: 11,
                  cursor: 'pointer',
                  marginTop: 6,
                }}
                onClick={() => {
                  localStorage.removeItem(CARD_PIN_KEY);
                  setPinMode('set');
                }}
              >
                Forgot PIN? Reset it
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          ...s.card,
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 0,
        }}
      >
        <div style={{ ...s.left, justifyContent: 'space-between' }}>
          <div style={s.left}>
            <div style={s.iconBox}>{TYPE_ICON.card}</div>
            <div style={s.info}>
              <p style={s.title}>{payload.title}</p>
              <p style={s.meta}>
                {cardUnlocked && payload.number
                  ? `•••• •••• •••• ${payload.number.slice(-4)}`
                  : payload.cardholder || 'Payment card'}
              </p>
            </div>
          </div>
          <div style={s.actions}>
            {!cardUnlocked ? (
              <button
                style={{ ...s.btn, ...s.openBtn }}
                onClick={handleCardClick}
              >
                🔓 View
              </button>
            ) : (
              <>
                {payload.number && (
                  <button
                    style={s.btn}
                    onClick={() => copy(payload.number!, 'num')}
                  >
                    {copied === 'num' ? '✓' : 'Num'}
                  </button>
                )}
                {payload.cvv && (
                  <button
                    style={s.btn}
                    onClick={() => copy(payload.cvv!, 'cvv')}
                  >
                    {copied === 'cvv' ? '✓' : 'CVV'}
                  </button>
                )}
                <button style={s.btn} onClick={() => setCardUnlocked(false)}>
                  🔒
                </button>
              </>
            )}
          </div>
        </div>
        {cardUnlocked && (
          <div style={s.cardDetails}>
            {payload.cardholder && (
              <span style={s.cardField}>{payload.cardholder}</span>
            )}
            {payload.expiry && (
              <span style={s.cardField}>Exp: {payload.expiry}</span>
            )}
            {payload.number && (
              <span
                style={{
                  ...s.cardField,
                  fontFamily: 'monospace',
                  letterSpacing: 2,
                }}
              >
                {payload.number.replace(/(.{4})/g, '$1 ').trim()}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}

const s: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderRadius: 10,
    background: '#0f172a',
    border: '1px solid #1e293b',
    gap: 10,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
    flex: 1,
  },
  iconBox: {
    fontSize: 18,
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: 8,
    background: '#1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { overflow: 'hidden' },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: '#f1f5f9',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    margin: 0,
  },
  meta: {
    fontSize: 11,
    color: '#64748b',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    margin: '2px 0 0',
  },
  actions: { display: 'flex', gap: 4, flexShrink: 0 },
  btn: {
    padding: '5px 10px',
    borderRadius: 6,
    border: 'none',
    background: '#1e293b',
    color: '#94a3b8',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 500,
  },
  openBtn: { background: '#1e3a5f', color: '#38bdf8' },
  noteBody: {
    padding: '10px 12px',
    borderTop: '1px solid #1e293b',
    marginTop: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
  },
  cardDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    padding: '10px 12px',
    borderTop: '1px solid #1e293b',
    marginTop: 8,
  },
  cardField: {
    fontSize: 12,
    color: '#94a3b8',
    background: '#1e293b',
    padding: '4px 8px',
    borderRadius: 6,
  },
  pinInput: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#f1f5f9',
    fontSize: 18,
    letterSpacing: 6,
    textAlign: 'center',
    outline: 'none',
  },
};
