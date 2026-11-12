export const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const;

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

const PERSON_NAME = /^(?=.*\p{L})[\p{L}][\p{L}\s.'-]{1,79}$/u;
const LABEL_TEXT = /^(?=.*\p{L})[\p{L}\p{N}][\p{L}\p{N}\s&/.,'-]{1,79}$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function digitsOnly(value: string, max: number) {
  return value.replace(/\D/g, '').slice(0, max);
}

export function withoutDigits(value: string, max = 80) {
  return value.replace(/\d/g, '').slice(0, max);
}

export function dateInputValue(value: string | null | undefined) {
  if (!value) return '';
  return value.slice(0, 10);
}

export function firstError(errors: Record<string, string>) {
  return Object.values(errors).find(Boolean) ?? '';
}

export function nameError(value: string, label = 'Full name') {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return `${label} is required`;
  if (!PERSON_NAME.test(trimmed) || /\d/.test(trimmed)) {
    return `${label} can only use letters, spaces, hyphens, and apostrophes (2–80 characters)`;
  }
  return '';
}

export function optionalNameError(value: string, label: string) {
  if (!value.trim()) return '';
  return nameError(value, label).replace(' is required', '');
}

export function phoneError(value: string, required: boolean, label = 'Phone number') {
  const digits = value.trim();
  if (!digits) return required ? `${label} is required` : '';
  if (!/^\d{10,12}$/.test(digits)) {
    return `${label} must be 10 to 12 digits, with no letters or symbols`;
  }
  return '';
}

export function emailError(value: string, required: boolean, label = 'Email') {
  const email = value.trim().toLowerCase();
  if (!email) return required ? `${label} is required` : '';
  if (!EMAIL.test(email) || email.length > 254) return `Enter a valid ${label.toLowerCase()}`;
  return '';
}

export function secondaryEmailError(value: string, loginEmail: string, required: boolean) {
  const message = emailError(value, required, 'Secondary email');
  if (message) return message;
  if (
    value.trim() &&
    loginEmail.trim() &&
    value.trim().toLowerCase() === loginEmail.trim().toLowerCase()
  ) {
    return 'Secondary email must be different from the account email';
  }
  return '';
}

export function idCardError(value: string, required: boolean) {
  const digits = value.trim();
  if (!digits) return required ? 'ID card number is required' : '';
  if (!/^\d{13}$/.test(digits)) return 'ID card number must be 13 digits';
  return '';
}

function parseIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function ageOn(birth: Date, today: Date) {
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function dateOfBirthError(value: string, required: boolean) {
  if (!value) return required ? 'Date of birth is required' : '';
  const date = parseIso(value);
  if (!date) return 'Date of birth must be a valid date';
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (date > today) return 'Date of birth cannot be in the future';
  const age = ageOn(date, today);
  if (age < 16 || age > 80) return 'Date of birth must be between 16 and 80 years ago';
  return '';
}

export function joinedOnError(value: string) {
  if (!value) return '';
  const date = parseIso(value);
  if (!date) return 'Joining date must be a valid date';
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (date > today) return 'Joining date cannot be in the future';
  if (date < new Date(Date.UTC(1980, 0, 1))) return 'Joining date is too far in the past';
  return '';
}

export function addressError(value: string, required: boolean) {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return required ? 'Address is required' : '';
  if (trimmed.length < 5 || trimmed.length > 300 || /[<>]/.test(trimmed)) {
    return 'Address must be 5 to 300 characters, without < or >';
  }
  return '';
}

export function notesError(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length > 2000 || /[<>]/.test(trimmed)) {
    return 'Notes must be 2000 characters or fewer, without < or >';
  }
  return '';
}

export function labelError(value: string, label: string) {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  if (!LABEL_TEXT.test(trimmed)) {
    return `${label} can only use letters, numbers, spaces, and basic punctuation (2–80 characters)`;
  }
  return '';
}

export function choiceError(
  value: string,
  label: string,
  allowed: readonly string[],
  required: boolean,
) {
  if (!value) return required ? `${label} is required` : '';
  if (!allowed.includes(value)) return `${label} is invalid`;
  return '';
}

export function passwordError(value: string, required: boolean) {
  if (!value) return required ? 'Password is required' : '';
  if (value.length < 8 || value.length > 72) return 'Password must be between 8 and 72 characters';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'Password must include a letter and a number';
  }
  return '';
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function imageFileError(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!IMAGE_TYPES.has(file.type) || !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    return 'Picture must be a JPEG, PNG, or WebP image';
  }
  if (file.size > 2 * 1024 * 1024) return 'Picture must be 2 MB or smaller';
  return '';
}

export function documentFileError(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const allowedType = IMAGE_TYPES.has(file.type) || file.type === 'application/pdf';
  const allowedExtension = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(extension);
  if (!allowedType || !allowedExtension) return 'Document must be a JPEG, PNG, WebP, or PDF file';
  if (file.size > 5 * 1024 * 1024) return 'Document must be 5 MB or smaller';
  return '';
}
