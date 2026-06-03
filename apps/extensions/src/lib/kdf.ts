// PBKDF2-SHA256 key derivation — same as web app
// Takes master password → produces authKey (for API) + vaultKey (for decryption)

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

export async function deriveKeys(
  password: string,
  kdfSalt: string,
  kdfParams: KdfParams = DEFAULT_KDF_PARAMS
): Promise<{
  authKey: Uint8Array<ArrayBuffer>;
  vaultKey: Uint8Array<ArrayBuffer>;
}> {
  const enc = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(kdfSalt),
      iterations: kdfParams.iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    512 // 64 bytes → first 32 = authKey, last 32 = vaultKey
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
