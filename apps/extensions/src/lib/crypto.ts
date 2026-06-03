// AES-256-GCM encryption/decryption using Web Crypto API
// Identical to apps/web/src/lib/crypto.ts

const ALGORITHM = 'AES-GCM';

export async function encrypt(
  plaintext: string,
  key: Uint8Array<ArrayBuffer>
): Promise<{ ciphertext: string; iv: string }> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const keyObj = await globalThis.crypto.subtle.importKey(
    'raw',
    key,
    { name: ALGORITHM },
    false,
    ['encrypt']
  );
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    keyObj,
    encoded
  );
  return {
    ciphertext: bufToBase64(new Uint8Array(encrypted)),
    iv: bufToBase64(iv),
  };
}

export async function decrypt(
  { ciphertext, iv }: { ciphertext: string; iv: string },
  key: Uint8Array<ArrayBuffer>
): Promise<string> {
  const keyObj = await globalThis.crypto.subtle.importKey(
    'raw',
    key,
    { name: ALGORITHM },
    false,
    ['decrypt']
  );
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: ALGORITHM, iv: base64ToBuf(iv) },
    keyObj,
    base64ToBuf(ciphertext)
  );
  return new TextDecoder().decode(decrypted);
}

export async function encryptBytes(
  data: Uint8Array<ArrayBuffer>,
  key: Uint8Array<ArrayBuffer>
): Promise<{ ciphertext: string; iv: string }> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const keyObj = await globalThis.crypto.subtle.importKey(
    'raw',
    key,
    { name: ALGORITHM },
    false,
    ['encrypt']
  );
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    keyObj,
    data
  );
  return {
    ciphertext: bufToBase64(new Uint8Array(encrypted)),
    iv: bufToBase64(iv),
  };
}

export async function decryptBytes(
  { ciphertext, iv }: { ciphertext: string; iv: string },
  key: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const keyObj = await globalThis.crypto.subtle.importKey(
    'raw',
    key,
    { name: ALGORITHM },
    false,
    ['decrypt']
  );
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: ALGORITHM, iv: base64ToBuf(iv) },
    keyObj,
    base64ToBuf(ciphertext)
  );
  return new Uint8Array(decrypted) as Uint8Array<ArrayBuffer>;
}

function bufToBase64(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf));
}

function base64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    atob(b64)
      .split('')
      .map((c) => c.charCodeAt(0))
  ) as Uint8Array<ArrayBuffer>;
}
