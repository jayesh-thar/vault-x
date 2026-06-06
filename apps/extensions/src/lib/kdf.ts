export interface KdfParams {
  iterations: number;
  memory: number;
  parallelism: number;
}

export const DEFAULT_KDF_PARAMS: KdfParams = {
  iterations: 600000,
  memory: 0,
  parallelism: 1,
};

// kdfSalt comes from DB as a hex string — must convert to bytes before use
// This matches exactly how the web app does it
function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

export async function deriveKeys(
  password: string,
  kdfSalt: string,
  kdfParams: KdfParams = DEFAULT_KDF_PARAMS
): Promise<{
  authKey: Uint8Array<ArrayBuffer>;
  vaultKey: Uint8Array<ArrayBuffer>;
}> {
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromHex(kdfSalt), // ← fix: hex → bytes, same as web app
      iterations: kdfParams.iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    512
  );

  const bytes = new Uint8Array(bits) as Uint8Array<ArrayBuffer>;
  return {
    authKey: bytes.slice(0, 32) as Uint8Array<ArrayBuffer>,
    vaultKey: bytes.slice(32, 64) as Uint8Array<ArrayBuffer>,
  };
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
