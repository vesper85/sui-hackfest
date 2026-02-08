import { nanoid } from "nanoid";

const NONCE_TTL_MS = 5 * 60 * 1000;

type NonceRecord = {
  nonce: string;
  expiresAt: number;
};

const nonceStore = new Map<string, NonceRecord>();

function cleanupExpiredNonces() {
  const now = Date.now();
  for (const [key, record] of nonceStore.entries()) {
    if (record.expiresAt <= now) {
      nonceStore.delete(key);
    }
  }
}

export function createAuthMessage(walletAddress: string, nonce: string) {
  return `SUI UW Login\nWallet: ${walletAddress}\nNonce: ${nonce}`;
}

export function issueNonce(walletAddress: string) {
  cleanupExpiredNonces();
  const nonce = nanoid(24);
  const expiresAt = Date.now() + NONCE_TTL_MS;
  nonceStore.set(walletAddress, { nonce, expiresAt });
  return {
    nonce,
    expiresAt,
    message: createAuthMessage(walletAddress, nonce),
  };
}

export function consumeNonce(walletAddress: string, nonce: string) {
  const record = nonceStore.get(walletAddress);
  if (!record) {
    return false;
  }
  if (record.expiresAt <= Date.now()) {
    nonceStore.delete(walletAddress);
    return false;
  }
  if (record.nonce !== nonce) {
    return false;
  }
  nonceStore.delete(walletAddress);
  return true;
}
