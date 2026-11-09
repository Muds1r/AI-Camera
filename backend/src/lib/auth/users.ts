import { Prisma, Role, User } from '@prisma/client';
import { prisma } from '../prisma';
import { HttpError } from '../http';
import { hashPassword, verifyPassword } from './passwords';
import { canAssignRole, isRole } from './permissions';
import { AuthUser } from './session';

export const publicUserSelect = {
  id: true,
  email: true,
  full_name: true,
  role: true,
  phone: true,
  address: true,
  id_card_number: true,
  info: true,
  avatar_url: true,
  department: true,
  designation: true,
  salary_basic: true,
  salary_allowance: true,
  salary_deduction: true,
  medical_limit: true,
  opd_limit: true,
  clock_enabled: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertPassword(password: string): void {
  if (password.length < 8 || password.length > 72) {
    throw new HttpError(400, 'Password must be between 8 and 72 characters');
  }
}

export function assertEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!EMAIL_PATTERN.test(normalized) || normalized.length > 254) {
    throw new HttpError(400, 'A valid email is required');
  }
  return normalized;
}

function assertName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 120) {
    throw new HttpError(400, 'Name must be between 1 and 120 characters');
  }
  return trimmed;
}

function optionalText(value: unknown, label: string, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new HttpError(400, `${label} is invalid`);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw new HttpError(400, `${label} must be at most ${max} characters`);
  return trimmed;
}

function optionalNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new HttpError(400, `${label} must be zero or greater`);
  }
  return parsed;
}

function optionalIdCard(value: unknown): string | null | undefined {
  const text = optionalText(value, 'ID card number', 30);
  if (text === undefined || text === null) return text;
  if (!/^[A-Za-z0-9-]{5,30}$/.test(text)) {
    throw new HttpError(400, 'ID card number must be 5 to 30 letters, numbers, or dashes');
  }
  return text.toUpperCase();
}

function uniqueConflict(err: Prisma.PrismaClientKnownRequestError): HttpError {
  const target = err.meta?.target;
  const fields = Array.isArray(target) ? target.join(' ') : String(target ?? '');
  if (fields.includes('id_card')) {
    return new HttpError(409, 'An account with that ID card number already exists');
  }
  return new HttpError(409, 'An account with that email already exists');
}

export async function createAccount(
  actor: AuthUser,
  input: {
    email?: unknown;
    password?: unknown;
    full_name?: unknown;
    role?: unknown;
    phone?: unknown;
    address?: unknown;
    id_card_number?: unknown;
    info?: unknown;
    department?: unknown;
    designation?: unknown;
    salary_basic?: unknown;
    salary_allowance?: unknown;
    salary_deduction?: unknown;
    medical_limit?: unknown;
    opd_limit?: unknown;
    clock_enabled?: unknown;
  },
): Promise<PublicUser> {
  if (typeof input.email !== 'string' || typeof input.password !== 'string') {
    throw new HttpError(400, 'Email and password are required');
  }
  if (typeof input.full_name !== 'string') throw new HttpError(400, 'Name is required');

  const role = input.role === undefined ? Role.employee : input.role;
  if (!isRole(role)) throw new HttpError(400, 'Invalid role');
  if (!canAssignRole(actor.role, role)) {
    throw new HttpError(403, 'You cannot create an account with that role');
  }

  const email = assertEmail(input.email);
  assertPassword(input.password);
  const fullName = assertName(input.full_name);

  try {
    return await prisma.user.create({
      data: {
        email,
        password_hash: await hashPassword(input.password),
        full_name: fullName,
        role,
        phone: optionalText(input.phone, 'Phone', 30) ?? null,
        address: optionalText(input.address, 'Address', 300) ?? null,
        id_card_number: optionalIdCard(input.id_card_number) ?? null,
        info: optionalText(input.info, 'Info', 2000) ?? null,
        department: optionalText(input.department, 'Department', 80) ?? null,
        designation: optionalText(input.designation, 'Designation', 80) ?? null,
        salary_basic: optionalNumber(input.salary_basic, 'Basic salary') ?? 0,
        salary_allowance: optionalNumber(input.salary_allowance, 'Allowance') ?? 0,
        salary_deduction: optionalNumber(input.salary_deduction, 'Deduction') ?? 0,
        medical_limit: optionalNumber(input.medical_limit, 'Medical limit') ?? 0,
        opd_limit: optionalNumber(input.opd_limit, 'OPD limit') ?? 0,
        clock_enabled:
          input.clock_enabled === undefined ? role !== Role.dataview : Boolean(input.clock_enabled),
      },
      select: publicUserSelect,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw uniqueConflict(err);
    }
    throw err;
  }
}

export async function listAccounts(): Promise<PublicUser[]> {
  return prisma.user.findMany({
    select: publicUserSelect,
    orderBy: { created_at: 'desc' },
  });
}

export async function updateOwnProfile(
  actor: AuthUser,
  input: {
    full_name?: unknown;
    phone?: unknown;
    address?: unknown;
    id_card_number?: unknown;
    info?: unknown;
    current_password?: unknown;
    new_password?: unknown;
  },
): Promise<{ user: PublicUser; passwordChanged: boolean }> {
  const data: Prisma.UserUpdateInput = {};
  const personalFields = [
    input.full_name,
    input.phone,
    input.address,
    input.id_card_number,
    input.info,
  ];
  if (actor.role !== Role.super_admin && personalFields.some((value) => value !== undefined)) {
    throw new HttpError(400, 'Submit a profile update request to change personal details');
  }

  if (input.full_name !== undefined) {
    if (typeof input.full_name !== 'string') throw new HttpError(400, 'Name is invalid');
    data.full_name = assertName(input.full_name);
  }

  const phone = optionalText(input.phone, 'Phone', 30);
  if (phone !== undefined) data.phone = phone;

  const address = optionalText(input.address, 'Address', 300);
  if (address !== undefined) data.address = address;

  const idCard = optionalIdCard(input.id_card_number);
  if (idCard !== undefined) data.id_card_number = idCard;

  const info = optionalText(input.info, 'Info', 2000);
  if (info !== undefined) data.info = info;

  let passwordChanged = false;
  if (input.new_password !== undefined || input.current_password !== undefined) {
    if (typeof input.new_password !== 'string' || typeof input.current_password !== 'string') {
      throw new HttpError(400, 'Current password and a new password are required');
    }
    assertPassword(input.new_password);
    const existing = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!existing) throw new HttpError(401, 'Unauthorized');
    const matches = await verifyPassword(input.current_password, existing.password_hash);
    if (!matches) throw new HttpError(400, 'Current password is incorrect');
    data.password_hash = await hashPassword(input.new_password);
    passwordChanged = true;
  }

  if (Object.keys(data).length === 0) {
    throw new HttpError(400, 'Nothing to update');
  }

  try {
    const user = await prisma.user.update({
      where: { id: actor.id },
      data,
      select: publicUserSelect,
    });
    return { user, passwordChanged };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw uniqueConflict(err);
    }
    throw err;
  }
}

export async function assignRole(
  actor: AuthUser,
  userId: string,
  role: unknown,
): Promise<PublicUser> {
  if (!isRole(role)) throw new HttpError(400, 'Invalid role');
  if (actor.id === userId) throw new HttpError(403, 'You cannot change your own role');
  if (!canAssignRole(actor.role, role)) {
    throw new HttpError(403, 'You cannot assign that role');
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new HttpError(404, 'User not found');

  if (target.role === Role.super_admin && role !== Role.super_admin) {
    const remaining = await prisma.user.count({
      where: { role: Role.super_admin, is_active: true, id: { not: target.id } },
    });
    if (remaining === 0) {
      throw new HttpError(409, 'Cannot change the role of the last Super Admin');
    }
  }

  return prisma.user.update({
    where: { id: target.id },
    data: { role },
    select: publicUserSelect,
  });
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    phone: user.phone,
    address: user.address,
    id_card_number: user.id_card_number,
    info: user.info,
    avatar_url: user.avatar_url,
    department: user.department,
    designation: user.designation,
    salary_basic: user.salary_basic,
    salary_allowance: user.salary_allowance,
    salary_deduction: user.salary_deduction,
    medical_limit: user.medical_limit,
    opd_limit: user.opd_limit,
    clock_enabled: user.clock_enabled,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}
