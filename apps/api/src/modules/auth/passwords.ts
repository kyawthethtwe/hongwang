import { hash, verify } from '@node-rs/argon2';

/** Argon2id with the library's defaults (m=19 MiB, t=2, p=1). */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

let dummyHash: Promise<string> | null = null;

/**
 * True when `password` matches `passwordHash`. With no hash (unknown email, or an account without a
 * password) it still runs one verification so response time doesn't reveal whether the account exists.
 */
export async function verifyPassword(passwordHash: string | null | undefined, password: string): Promise<boolean> {
  if (!passwordHash) {
    dummyHash ??= hash('hongwang-timing-equaliser');
    await verify(await dummyHash, password).catch(() => false);
    return false;
  }
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
