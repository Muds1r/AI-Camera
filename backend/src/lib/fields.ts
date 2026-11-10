import { HttpError } from './http';

export const GENDERS = ['male', 'female', 'other'] as const;
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

const PERSON_NAME = /^(?=.*\p{L})[\p{L}][\p{L}\s.'-]{1,79}$/u;
const LABEL_TEXT = /^(?=.*\p{L})[\p{L}\p{N}][\p{L}\p{N}\s&/.,'-]{1,79}$/u;

export function assertPersonName(value: string, label = 'Name'): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!PERSON_NAME.test(trimmed) || /\d/.test(trimmed)) {
    throw new HttpError(
      400,
      `${label} can only use letters, spaces, hyphens, and apostrophes (2–80 characters)`,
    );
  }
  return trimmed;
}

export function optionalPersonName(value: unknown, label: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new HttpError(400, `${label} is invalid`);
  if (!value.trim()) return null;
  return assertPersonName(value, label);
}

export function optionalPhone(value: unknown, label = 'Phone number'): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new HttpError(400, `${label} is invalid`);
  const digits = value.trim();
  if (!digits) return null;
  if (!/^\d{10,12}$/.test(digits)) {
    throw new HttpError(400, `${label} must be 10 to 12 digits, with no letters or symbols`);
  }
  return digits;
}

export function optionalIdCard(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new HttpError(400, 'ID card number is invalid');
  const digits = value.trim();
  if (!digits) return null;
  if (!/^\d{13}$/.test(digits)) {
    throw new HttpError(400, 'ID card number must be 13 digits');
  }
  return digits;
}

export function optionalLabel(value: unknown, label: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new HttpError(400, `${label} is invalid`);
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (!LABEL_TEXT.test(trimmed)) {
    throw new HttpError(
      400,
      `${label} can only use letters, numbers, spaces, and basic punctuation (2–80 characters)`,
    );
  }
  return trimmed;
}

export function optionalAddress(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new HttpError(400, 'Address is invalid');
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  if (trimmed.length < 5 || trimmed.length > 300 || /[<>]/.test(trimmed)) {
    throw new HttpError(400, 'Address must be 5 to 300 characters, without < or >');
  }
  return trimmed;
}

export function optionalNotes(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new HttpError(400, 'Notes are invalid');
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 2000 || /[<>]/.test(trimmed)) {
    throw new HttpError(400, 'Notes must be 2000 characters or fewer, without < or >');
  }
  return trimmed;
}

export function optionalChoice(
  value: unknown,
  label: string,
  allowed: readonly string[],
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new HttpError(400, `${label} is invalid`);
  }
  return value;
}

function parseIsoDate(value: string, label: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new HttpError(400, `${label} must be a valid date`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new HttpError(400, `${label} must be a valid date`);
  }
  return date;
}

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function ageOn(birth: Date, today: Date): number {
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function optionalDateOfBirth(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new HttpError(400, 'Date of birth is invalid');
  const date = parseIsoDate(value, 'Date of birth');
  const today = utcToday();
  if (date > today) throw new HttpError(400, 'Date of birth cannot be in the future');
  const age = ageOn(date, today);
  if (age < 16 || age > 80) {
    throw new HttpError(400, 'Date of birth must be between 16 and 80 years ago');
  }
  return date;
}

export function optionalJoinedOn(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new HttpError(400, 'Joining date is invalid');
  const date = parseIsoDate(value, 'Joining date');
  const today = utcToday();
  if (date > today) throw new HttpError(400, 'Joining date cannot be in the future');
  if (date < new Date(Date.UTC(1980, 0, 1))) {
    throw new HttpError(400, 'Joining date is too far in the past');
  }
  return date;
}

export function dateToIso(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}
