import bcrypt from 'bcryptjs';

let dummyHash: Promise<string> | null = null;

function rounds(): number {
  const parsed = Number(process.env.BCRYPT_ROUNDS ?? 12);
  if (!Number.isInteger(parsed) || parsed < 4 || parsed > 15) return 12;
  return parsed;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, rounds());
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

/** Keeps unknown-email logins on a similar timeline to a real compare. */
export function verifyPasswordAgainstDummy(password: string): Promise<boolean> {
  if (!dummyHash) {
    dummyHash = bcrypt.hash('not-a-real-account', rounds());
  }
  return dummyHash.then((hash) => bcrypt.compare(password, hash));
}
