import { randomBytes } from 'crypto';

const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DIGITS = '23456789';

/** Random password that satisfies assertPassword (8–72 chars, letter + digit). */
export function generateCompliantPassword(length = 14): string {
  const size = Math.max(8, Math.min(72, length));
  const all = LOWER + UPPER + DIGITS;
  const chars: string[] = [
    LOWER[randomBytes(1)[0] % LOWER.length],
    UPPER[randomBytes(1)[0] % UPPER.length],
    DIGITS[randomBytes(1)[0] % DIGITS.length],
  ];
  const bytes = randomBytes(size - chars.length);
  for (let i = 0; i < bytes.length; i += 1) {
    chars.push(all[bytes[i] % all.length]);
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
