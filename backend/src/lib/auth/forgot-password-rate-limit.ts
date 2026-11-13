const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

function prune(now: number): void {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS) buckets.delete(key);
  }
}

export function isForgotPasswordRateLimited(key: string): boolean {
  const now = Date.now();
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  if (bucket.count > MAX_ATTEMPTS) return true;
  return false;
}

export const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  'If an account exists with a recovery email on file, a sign-in code was sent there.';
