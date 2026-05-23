const encoder = new TextEncoder();
const DEFAULT_ITERATIONS = 210000;

function cryptoApi() {
  const api = globalThis.crypto;
  if (!api?.subtle) throw new Error("Web Crypto를 사용할 수 없습니다.");
  return api;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  if (typeof btoa === "function") return btoa(binary);
  return Buffer.from(binary, "binary").toString("base64");
}

function base64ToBytes(value) {
  const binary = typeof atob === "function"
    ? atob(value)
    : Buffer.from(value, "base64").toString("binary");
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomSalt() {
  const salt = new Uint8Array(16);
  cryptoApi().getRandomValues(salt);
  return salt;
}

async function derivePasswordHash(password, salt, iterations) {
  const key = await cryptoApi().subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await cryptoApi().subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256
  );
  return new Uint8Array(bits);
}

function sameBytes(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

export function isLockConfigured(settings) {
  return Boolean(settings?.lockEnabled && settings.lockPasswordHash && settings.lockPasswordSalt);
}

export async function createPasswordRecord(password, options = {}) {
  const value = String(password || "");
  if (value.length < 4) throw new Error("비밀번호는 4자 이상이어야 합니다.");
  const iterations = Number(options.iterations || DEFAULT_ITERATIONS);
  const salt = options.salt ? base64ToBytes(options.salt) : randomSalt();
  const hash = await derivePasswordHash(value, salt, iterations);
  return {
    lockEnabled: true,
    lockPasswordAlgorithm: "PBKDF2-SHA256",
    lockPasswordIterations: iterations,
    lockPasswordSalt: bytesToBase64(salt),
    lockPasswordHash: bytesToBase64(hash)
  };
}

export async function verifyPassword(password, settings) {
  if (!isLockConfigured(settings)) return false;
  const salt = base64ToBytes(settings.lockPasswordSalt);
  const expected = base64ToBytes(settings.lockPasswordHash);
  const iterations = Number(settings.lockPasswordIterations || DEFAULT_ITERATIONS);
  const actual = await derivePasswordHash(String(password || ""), salt, iterations);
  return sameBytes(actual, expected);
}

export function clearPasswordRecord(settings) {
  return {
    ...settings,
    lockEnabled: false,
    lockPasswordHash: "",
    lockPasswordSalt: "",
    lockPasswordAlgorithm: "PBKDF2-SHA256",
    lockPasswordIterations: DEFAULT_ITERATIONS
  };
}

export function lockTimeoutMs(settings) {
  return Math.max(1, Number(settings?.lockTimeoutMinutes || 60)) * 60 * 1000;
}
