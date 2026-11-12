import { Prisma, Role, User } from '@prisma/client';
import { prisma } from '../prisma';
import { HttpError } from '../http';
import { hashPassword, verifyPassword } from './passwords';
import { generateCompliantPassword } from './generate-password';
import { canAssignRole, isRole } from './permissions';
import { AuthUser } from './session';
import {
  BLOOD_GROUPS,
  GENDERS,
  assertPersonName,
  optionalAddress,
  optionalChoice,
  optionalDateOfBirth,
  optionalIdCard,
  optionalJoinedOn,
  optionalLabel,
  optionalNotes,
  optionalPersonName,
  optionalPhone,
} from '../fields';

export const publicUserSelect = {
  id: true,
  email: true,
  full_name: true,
  role: true,
  phone: true,
  secondary_email: true,
  address: true,
  id_card_number: true,
  date_of_birth: true,
  gender: true,
  blood_group: true,
  emergency_contact_name: true,
  emergency_contact_phone: true,
  joined_on: true,
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
  login_enabled: true,
  employee_code: true,
  employment_status: true,
  left_on: true,
  shift: true,
  password_changed_at: true,
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
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, 'Password must include a letter and a number');
  }
}

export function assertEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!EMAIL_PATTERN.test(normalized) || normalized.length > 254) {
    throw new HttpError(400, 'A valid email is required');
  }
  return normalized;
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
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100_000_000) {
    throw new HttpError(400, `${label} must be between 0 and 100,000,000`);
  }
  return parsed;
}

function optionalEmail(value: unknown, label: string): string | null | undefined {
  const text = optionalText(value, label, 254);
  if (text === undefined || text === null) return text;
  return assertEmail(text);
}

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function uniqueConflict(err: Prisma.PrismaClientKnownRequestError): HttpError {
  const target = err.meta?.target;
  const fields = Array.isArray(target) ? target.join(' ') : String(target ?? '');
  if (fields.includes('id_card')) {
    return new HttpError(409, 'An account with that ID card number already exists');
  }
  if (fields.includes('employee_code')) {
    return new HttpError(409, 'That employee code is already in use');
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
    secondary_email?: unknown;
    address?: unknown;
    id_card_number?: unknown;
    date_of_birth?: unknown;
    gender?: unknown;
    blood_group?: unknown;
    emergency_contact_name?: unknown;
    emergency_contact_phone?: unknown;
    joined_on?: unknown;
    info?: unknown;
    department?: unknown;
    designation?: unknown;
    salary_basic?: unknown;
    salary_allowance?: unknown;
    salary_deduction?: unknown;
    medical_limit?: unknown;
    opd_limit?: unknown;
    clock_enabled?: unknown;
    login_enabled?: unknown;
    employee_code?: unknown;
    shift?: unknown;
  },
): Promise<PublicUser> {
  if (typeof input.email !== 'string') {
    throw new HttpError(400, 'Email is required');
  }
  const loginEnabled = input.login_enabled !== false;
  if (loginEnabled && typeof input.password !== 'string') {
    throw new HttpError(400, 'Email and password are required');
  }
  if (typeof input.full_name !== 'string') throw new HttpError(400, 'Name is required');

  const role = input.role === undefined ? Role.employee : input.role;
  if (!isRole(role)) throw new HttpError(400, 'Invalid role');
  if (!canAssignRole(actor.role, role)) {
    throw new HttpError(403, 'You cannot create an account with that role');
  }

  const email = assertEmail(input.email);
  if (loginEnabled) assertPassword(input.password as string);
  const fullName = assertPersonName(input.full_name, 'Full name');
  const phone = optionalPhone(input.phone);
  const secondaryEmail = optionalEmail(input.secondary_email, 'Secondary email') ?? null;
  if (!phone) throw new HttpError(400, 'Phone number is required');
  if (!secondaryEmail) throw new HttpError(400, 'Secondary email is required');
  if (secondaryEmail === email) {
    throw new HttpError(400, 'Secondary email must be different from the account email');
  }
  const dateOfBirth = optionalDateOfBirth(input.date_of_birth) ?? null;
  const gender = optionalChoice(input.gender, 'Gender', GENDERS) ?? null;
  const idCard = optionalIdCard(input.id_card_number) ?? null;
  if (role === Role.employee) {
    if (!dateOfBirth) throw new HttpError(400, 'Date of birth is required');
    if (!gender) throw new HttpError(400, 'Gender is required');
    if (!idCard) throw new HttpError(400, 'ID card number is required');
  }

  try {
    const created = await prisma.user.create({
      data: {
        email,
        password_hash: await hashPassword(
          loginEnabled ? (input.password as string) : generateCompliantPassword(),
        ),
        full_name: fullName,
        role,
        login_enabled: loginEnabled,
        employee_code:
          typeof input.employee_code === 'string' && input.employee_code.trim()
            ? input.employee_code.trim().toUpperCase()
            : `EMP-${randomCode()}`,
        shift: input.shift === 'night' ? 'night' : 'day',
        phone,
        secondary_email: secondaryEmail,
        address: optionalAddress(input.address) ?? null,
        id_card_number: idCard,
        date_of_birth: dateOfBirth,
        gender,
        blood_group: optionalChoice(input.blood_group, 'Blood group', BLOOD_GROUPS) ?? null,
        emergency_contact_name:
          optionalPersonName(input.emergency_contact_name, 'Emergency contact') ?? null,
        emergency_contact_phone:
          optionalPhone(input.emergency_contact_phone, 'Emergency phone') ?? null,
        joined_on: optionalJoinedOn(input.joined_on) ?? null,
        info: optionalNotes(input.info) ?? null,
        department: optionalLabel(input.department, 'Department') ?? null,
        designation: optionalLabel(input.designation, 'Designation') ?? null,
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
    await prisma.salaryChange.create({
      data: {
        user_id: created.id,
        salary_basic: created.salary_basic,
        salary_allowance: created.salary_allowance,
        salary_deduction: created.salary_deduction,
        actor_id: actor.id,
      },
    });
    return created;
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
    secondary_email?: unknown;
    address?: unknown;
    id_card_number?: unknown;
    date_of_birth?: unknown;
    gender?: unknown;
    blood_group?: unknown;
    emergency_contact_name?: unknown;
    emergency_contact_phone?: unknown;
    department?: unknown;
    designation?: unknown;
    info?: unknown;
    current_password?: unknown;
    new_password?: unknown;
  },
): Promise<{ user: PublicUser; passwordChanged: boolean }> {
  const data: Prisma.UserUpdateInput = {};
  const personalFields = [
    input.full_name,
    input.phone,
    input.secondary_email,
    input.address,
    input.id_card_number,
    input.date_of_birth,
    input.gender,
    input.blood_group,
    input.emergency_contact_name,
    input.emergency_contact_phone,
    input.department,
    input.designation,
    input.info,
  ];
  const savesOwnProfile = actor.role === Role.super_admin || actor.role === Role.hr;
  if (!savesOwnProfile && personalFields.some((value) => value !== undefined)) {
    throw new HttpError(400, 'Submit a profile update request to change personal details');
  }

  if (input.full_name !== undefined) {
    if (typeof input.full_name !== 'string') throw new HttpError(400, 'Name is invalid');
    data.full_name = assertPersonName(input.full_name, 'Full name');
  }

  const phone = optionalPhone(input.phone);
  if (phone !== undefined) data.phone = phone;

  const secondaryEmail = optionalEmail(input.secondary_email, 'Secondary email');
  if (secondaryEmail && secondaryEmail === actor.email) {
    throw new HttpError(400, 'Secondary email must be different from the account email');
  }
  if (secondaryEmail !== undefined) data.secondary_email = secondaryEmail;

  const address = optionalAddress(input.address);
  if (address !== undefined) data.address = address;

  const idCard = optionalIdCard(input.id_card_number);
  if (idCard !== undefined) data.id_card_number = idCard;

  const dateOfBirth = optionalDateOfBirth(input.date_of_birth);
  if (dateOfBirth !== undefined) data.date_of_birth = dateOfBirth;

  const gender = optionalChoice(input.gender, 'Gender', GENDERS);
  if (gender !== undefined) data.gender = gender;

  const bloodGroup = optionalChoice(input.blood_group, 'Blood group', BLOOD_GROUPS);
  if (bloodGroup !== undefined) data.blood_group = bloodGroup;

  const emergencyName = optionalPersonName(input.emergency_contact_name, 'Emergency contact');
  if (emergencyName !== undefined) data.emergency_contact_name = emergencyName;

  const emergencyPhone = optionalPhone(input.emergency_contact_phone, 'Emergency phone');
  if (emergencyPhone !== undefined) data.emergency_contact_phone = emergencyPhone;

  const department = optionalLabel(input.department, 'Department');
  if (department !== undefined) data.department = department;

  const designation = optionalLabel(input.designation, 'Designation');
  if (designation !== undefined) data.designation = designation;

  const info = optionalNotes(input.info);
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
    data.password_changed_at = new Date();
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
    secondary_email: user.secondary_email,
    address: user.address,
    id_card_number: user.id_card_number,
    date_of_birth: user.date_of_birth,
    gender: user.gender,
    blood_group: user.blood_group,
    emergency_contact_name: user.emergency_contact_name,
    emergency_contact_phone: user.emergency_contact_phone,
    joined_on: user.joined_on,
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
    login_enabled: user.login_enabled,
    employee_code: user.employee_code,
    employment_status: user.employment_status,
    left_on: user.left_on,
    shift: user.shift,
    password_changed_at: user.password_changed_at,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}
