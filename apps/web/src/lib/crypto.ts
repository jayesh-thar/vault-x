export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}

const subtle = window.crypto.subtle;

async function importKey(
  keyBytes: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  return subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

function toBase64(buf: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export async function encrypt(
  plaintext: string,
  key: Uint8Array<ArrayBuffer>
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await importKey(key);

  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode(plaintext)
  );

  return { ciphertext: toBase64(ciphertext), iv: toBase64(iv) };
}

export async function decrypt(
  payload: EncryptedPayload,
  key: Uint8Array<ArrayBuffer>
): Promise<string> {
  const cryptoKey = await importKey(key);

  const plaintext = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(payload.iv) },
    cryptoKey,
    fromBase64(payload.ciphertext)
  );

  return new TextDecoder().decode(plaintext);
}

export function generateVaultKey(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(32));
}

export async function encryptBytes(
  bytes: Uint8Array<ArrayBuffer>,
  key: Uint8Array<ArrayBuffer>
): Promise<EncryptedPayload> {
  return encrypt(toBase64(bytes), key);
}

export async function decryptBytes(
  payload: EncryptedPayload,
  key: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const b64 = await decrypt(payload, key);
  return fromBase64(b64);
}

//add a recovery key generator

export function generateRecoveryKey(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(32)) as Uint8Array<ArrayBuffer>;
}

// Encode recovery key as a readable string for the downloadable file
export function recoveryKeyToString(key: Uint8Array): string {
  return Array.from(key)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
    .replace(/(.{4})/g, '$1-')
    .slice(0, -1); // groups of 4 hex chars separated by dashes
}

export function recoveryKeyFromString(str: string): Uint8Array<ArrayBuffer> {
  const hex = str.replace(/-/g, '').toLowerCase();
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}
