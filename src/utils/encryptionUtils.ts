const PIN_VERIFY_CONSTANT = 'VERIFY:mybetterbudget'
const PBKDF2_ITERATIONS = 100_000

export async function deriveKey(pin: string, salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey'])
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptJson(key: CryptoKey, data: unknown): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder()
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)))
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

export async function decryptJson<T>(key: CryptoKey, ciphertext: string, iv: string): Promise<T> {
  const dec = new TextDecoder()
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0))
  const ciphertextBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
  const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ciphertextBytes)
  return JSON.parse(dec.decode(decrypted)) as T
}

export async function createVerifyToken(key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  return encryptJson(key, PIN_VERIFY_CONSTANT)
}

export async function verifyPin(key: CryptoKey, ciphertext: string, iv: string): Promise<boolean> {
  try {
    const decrypted = await decryptJson<string>(key, ciphertext, iv)
    return decrypted === PIN_VERIFY_CONSTANT
  } catch {
    return false
  }
}
