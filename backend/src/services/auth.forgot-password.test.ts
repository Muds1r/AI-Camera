import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { completePasswordReset, forgotPassword, verifyPasswordResetCode } from './auth.service';

const sent: { to: string; loginEmail: string; code: string }[] = [];

jest.mock('../lib/mail', () => ({
  sendPasswordResetEmail: jest.fn(
    async (input: { to: string; loginEmail: string; code: string }) => {
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

interface FakeReset {
  id: string;
  user_id: string;
  code_hash: string;
  token_hash: string | null;
  attempts: number;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

function state() {
  return (
    globalThis as {
      __forgotState?: { users: FakeUser[]; tokens: FakeToken[]; resets: FakeReset[] };
    }
  ).__forgotState!;
}

jest.mock('../lib/prisma', () => {
  const db = () =>
    (
      globalThis as {
        __forgotState?: { users: FakeUser[]; tokens: FakeToken[]; resets: FakeReset[] };
      }
    ).__forgotState!;
  let resetSeq = 0;
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
    passwordReset: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { user_id: string; used_at: null };
        data: { used_at: Date };
      }) => {
        for (const reset of db().resets) {
          if (reset.user_id === where.user_id && reset.used_at === null)
            reset.used_at = data.used_at;
        }
        return { count: 1 };
      },
      create: async ({
        data,
      }: {
        data: { user_id: string; code_hash: string; expires_at: Date };
      }) => {
        const reset: FakeReset = {
          id: `r${++resetSeq}`,
          user_id: data.user_id,
          code_hash: data.code_hash,
          token_hash: null,
          attempts: 0,
          expires_at: data.expires_at,
          used_at: null,
          created_at: new Date(),
        };
        db().resets.push(reset);
        return reset;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          used_at?: Date;
          token_hash?: string;
          expires_at?: Date;
          attempts?: { increment: number };
        };
      }) => {
        const reset = db().resets.find((row) => row.id === where.id);
        if (!reset) throw new Error('missing reset');
        if (data.used_at) reset.used_at = data.used_at;
        if (data.token_hash) reset.token_hash = data.token_hash;
        if (data.expires_at) reset.expires_at = data.expires_at;
        if (data.attempts?.increment) reset.attempts += data.attempts.increment;
        return reset;
      },
      findFirst: async ({
        where,
      }: {
        where: {
          user_id?: string;
          used_at?: null;
          token_hash?: string | null;
          expires_at?: { gt: Date };
        };
      }) => {
        const rows = db()
          .resets.filter((reset) => {
            if (where.user_id && reset.user_id !== where.user_id) return false;
            if (where.used_at === null && reset.used_at !== null) return false;
            if (where.token_hash === null && reset.token_hash !== null) return false;
            if (typeof where.token_hash === 'string' && reset.token_hash !== where.token_hash) {
              return false;
            }
            if (where.expires_at && reset.expires_at <= where.expires_at.gt) return false;
            return true;
          })
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
        return rows[0] ?? null;
      },
    },
    loginEvent: {
      create: async () => ({ id: 'event' }),
    },
  };
  return { prisma };
});

beforeEach(() => {
  sent.length = 0;
  (
    globalThis as {
      __forgotState?: { users: FakeUser[]; tokens: FakeToken[]; resets: FakeReset[] };
    }
  ).__forgotState = {
    users: [],
    tokens: [
      { id: 't1', user_id: 'u1', revoked_at: null },
      { id: 't2', user_id: 'u1', revoked_at: null },
    ],
    resets: [],
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
  it('emails a code to the recovery address and leaves the password in place', async () => {
    await seedUser();
    const before = state().users[0].password_hash;
    const result = await forgotPassword('login@example.com');
    expect(result.message).toMatch(/sign-in code/i);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('recovery@example.com');
    expect(sent[0].loginEmail).toBe('login@example.com');
    expect(sent[0].code).toMatch(/^\d{6}$/);
    expect(state().users[0].password_hash).toBe(before);
    expect(state().tokens.every((token) => token.revoked_at === null)).toBe(true);
  });

  it('returns the same message when the login email is unknown', async () => {
    const result = await forgotPassword('missing@example.com');
    expect(result.message).toMatch(/sign-in code/i);
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

  it('saves a new password only after the code is confirmed', async () => {
    await seedUser();
    await forgotPassword('login@example.com');
    await expect(verifyPasswordResetCode('login@example.com', '000000')).rejects.toThrow(
      /not valid/i,
    );

    const verified = await verifyPasswordResetCode('login@example.com', sent[0].code);
    expect(verified.resetToken.length).toBeGreaterThan(10);

    const saved = await completePasswordReset(verified.resetToken, 'new-password1');
    expect(saved.message).toMatch(/sign in/i);
    expect(await bcrypt.compare('new-password1', state().users[0].password_hash)).toBe(true);
    expect(state().tokens.every((token) => token.revoked_at)).toBe(true);
    await expect(completePasswordReset(verified.resetToken, 'another-password1')).rejects.toThrow(
      /expired/i,
    );
  });
});
