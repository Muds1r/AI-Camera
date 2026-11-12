import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { forgotPassword } from './auth.service';

const sent: { to: string; loginEmail: string; newPassword: string }[] = [];

jest.mock('../lib/mail', () => ({
  sendPasswordResetEmail: jest.fn(
    async (input: { to: string; loginEmail: string; newPassword: string }) => {
      sent.push(input);
    },
  ),
}));

jest.mock('../lib/audit', () => ({
  writeAudit: jest.fn(async () => undefined),
}));

interface FakeUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
  phone: string | null;
  secondary_email: string | null;
  is_active: boolean;
}

interface FakeToken {
  id: string;
  user_id: string;
  revoked_at: Date | null;
}

function state() {
  return (globalThis as { __forgotState?: { users: FakeUser[]; tokens: FakeToken[] } })
    .__forgotState!;
}

jest.mock('../lib/prisma', () => {
  const db = () =>
    (globalThis as { __forgotState?: { users: FakeUser[]; tokens: FakeToken[] } }).__forgotState!;
  const prisma = {
    user: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { email?: string; id?: string };
        select?: { id?: boolean; email?: boolean; is_active?: boolean; secondary_email?: boolean };
      }) => {
        const user = db().users.find((row) =>
          where.email ? row.email === where.email : row.id === where.id,
        );
        if (!user) return null;
        if (!select) return user;
        return {
          id: user.id,
          email: user.email,
          is_active: user.is_active,
          secondary_email: user.secondary_email,
        };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { password_hash: string };
      }) => {
        const user = db().users.find((row) => row.id === where.id);
        if (!user) throw new Error('missing user');
        user.password_hash = data.password_hash;
        return user;
      },
    },
    refreshToken: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { user_id?: string; revoked_at?: null };
        data: { revoked_at: Date };
      }) => {
        let count = 0;
        for (const token of db().tokens) {
          if (where.user_id !== undefined && token.user_id !== where.user_id) continue;
          if (where.revoked_at === null && token.revoked_at !== null) continue;
          token.revoked_at = data.revoked_at;
          count += 1;
        }
        return { count };
      },
    },
  };
  return { prisma };
});

beforeEach(() => {
  sent.length = 0;
  (globalThis as { __forgotState?: { users: FakeUser[]; tokens: FakeToken[] } }).__forgotState = {
    users: [],
    tokens: [
      { id: 't1', user_id: 'u1', revoked_at: null },
      { id: 't2', user_id: 'u1', revoked_at: null },
    ],
  };
});

async function seedUser(overrides: Partial<FakeUser> = {}) {
  const user: FakeUser = {
    id: 'u1',
    email: 'login@example.com',
    password_hash: await bcrypt.hash('old-password', 4),
    full_name: 'Test User',
    role: Role.employee,
    phone: null,
    secondary_email: 'recovery@example.com',
    is_active: true,
    ...overrides,
  };
  state().users.push(user);
  return user;
}

describe('forgotPassword', () => {
  it('sends a new password only to secondary email and revokes sessions', async () => {
    await seedUser();
    const result = await forgotPassword('login@example.com');
    expect(result.message).toMatch(/recovery email/i);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('recovery@example.com');
    expect(sent[0].loginEmail).toBe('login@example.com');
    expect(sent[0].newPassword.length).toBeGreaterThanOrEqual(8);

    const user = state().users[0];
    expect(await bcrypt.compare(sent[0].newPassword, user.password_hash)).toBe(true);
    expect(state().tokens.every((token) => token.revoked_at)).toBe(true);
  });

  it('returns the same message when the login email is unknown', async () => {
    const result = await forgotPassword('missing@example.com');
    expect(result.message).toMatch(/recovery email/i);
    expect(sent).toHaveLength(0);
  });

  it('does not email inactive accounts or accounts without secondary email', async () => {
    await seedUser({ is_active: false });
    await forgotPassword('login@example.com');
    expect(sent).toHaveLength(0);

    sent.length = 0;
    state().users[0].is_active = true;
    state().users[0].secondary_email = null;
    await forgotPassword('login@example.com');
    expect(sent).toHaveLength(0);
  });
});
