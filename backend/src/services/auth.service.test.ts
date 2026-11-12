import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import {
  REMEMBER_REFRESH_TTL_SECONDS,
  SESSION_REFRESH_TTL_SECONDS,
  hashRefreshToken,
} from '../lib/auth/tokens';
import { login, refreshSession } from './auth.service';

interface FakeUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
  phone: string | null;
  address: string | null;
  id_card_number: string | null;
  info: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface FakeToken {
  id: string;
  user_id: string;
  token_hash: string;
  family_id: string;
  expires_at: Date;
  remember_me: boolean;
  revoked_at: Date | null;
  replaced_by: string | null;
  created_at: Date;
}

interface AuthTestState {
  users: FakeUser[];
  tokens: FakeToken[];
}

function state(): AuthTestState {
  return (globalThis as { __authTestState?: AuthTestState }).__authTestState!;
}

jest.mock('../lib/prisma', () => {
  const db = () => (globalThis as { __authTestState?: AuthTestState }).__authTestState!;
  const prisma: {
    user: {
      findUnique: (args: { where: { email?: string; id?: string } }) => Promise<FakeUser | null>;
    };
    refreshToken: {
      create: (args: { data: Partial<FakeToken> }) => Promise<FakeToken>;
      findUnique: (args: {
        where: { token_hash: string };
        include?: { user?: boolean };
      }) => Promise<(FakeToken & { user?: FakeUser }) | FakeToken | null>;
      update: (args: { where: { id: string }; data: Partial<FakeToken> }) => Promise<FakeToken>;
      updateMany: (args: {
        where: { id?: string; family_id?: string; user_id?: string; revoked_at?: null };
        data: Partial<FakeToken>;
      }) => Promise<{ count: number }>;
    };
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  } = {
    user: {
      findUnique: async ({ where }: { where: { email?: string; id?: string } }) =>
        db().users.find((user) =>
          where.email ? user.email === where.email : user.id === where.id,
        ) ?? null,
    },
    refreshToken: {
      create: async ({ data }: { data: Partial<FakeToken> }) => {
        const row: FakeToken = {
          id: data.id ?? `token-${db().tokens.length + 1}`,
          user_id: data.user_id!,
          token_hash: data.token_hash!,
          family_id: data.family_id!,
          expires_at: data.expires_at!,
          remember_me: data.remember_me ?? false,
          revoked_at: data.revoked_at ?? null,
          replaced_by: data.replaced_by ?? null,
          created_at: new Date(),
        };
        db().tokens.push(row);
        return row;
      },
      findUnique: async ({
        where,
        include,
      }: {
        where: { token_hash: string };
        include?: { user?: boolean };
      }) => {
        const token = db().tokens.find((item) => item.token_hash === where.token_hash) ?? null;
        if (!token || !include?.user) return token;
        return { ...token, user: db().users.find((user) => user.id === token.user_id) };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeToken> }) => {
        const token = db().tokens.find((item) => item.id === where.id);
        if (!token) throw new Error('missing token');
        Object.assign(token, data);
        return token;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id?: string; family_id?: string; user_id?: string; revoked_at?: null };
        data: Partial<FakeToken>;
      }) => {
        let count = 0;
        for (const token of db().tokens) {
          if (where.id !== undefined && token.id !== where.id) continue;
          if (where.family_id !== undefined && token.family_id !== where.family_id) continue;
          if (where.user_id !== undefined && token.user_id !== where.user_id) continue;
          if (where.revoked_at === null && token.revoked_at !== null) continue;
          Object.assign(token, data);
          count += 1;
        }
        return { count };
      },
    },
    $transaction: async (fn) => fn(prisma),
  };

  return { prisma };
});

async function addUser(overrides: Partial<FakeUser> = {}): Promise<FakeUser> {
  const user: FakeUser = {
    id: 'user-1',
    email: 'ada@example.com',
    password_hash: await bcrypt.hash('correct-password', 4),
    full_name: 'Ada',
    role: Role.employee,
    phone: null,
    address: null,
    id_card_number: null,
    info: null,
    avatar_url: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
  state().users.push(user);
  return user;
}

describe('refresh token rotation', () => {
  beforeEach(() => {
    (globalThis as { __authTestState?: AuthTestState }).__authTestState = { users: [], tokens: [] };
  });

  it('rejects an unknown email and a wrong password with the same result', async () => {
    await addUser();
    await expect(login('missing@example.com', 'correct-password')).resolves.toMatchObject({
      ok: false,
      reason: 'invalid',
    });
    await expect(login('ada@example.com', 'wrong-password')).resolves.toMatchObject({
      ok: false,
      reason: 'invalid',
    });
    expect(state().tokens).toHaveLength(0);
  });

  it('rejects a deactivated account when the password is correct', async () => {
    await addUser({ is_active: false });
    await expect(login('ada@example.com', 'correct-password')).resolves.toMatchObject({
      ok: false,
      reason: 'inactive',
    });
    expect(state().tokens).toHaveLength(0);
  });

  it('rotates the refresh token and revokes the family when a used token is replayed', async () => {
    await addUser();
    const first = await login('ada@example.com', 'correct-password');
    if (!first.ok) throw new Error('login failed');

    const rotated = await refreshSession(first.refreshToken);
    if (!rotated.ok) throw new Error('refresh failed');
    expect(rotated.refreshToken).not.toBe(first.refreshToken);

    const previous = state().tokens.find(
      (token) => token.token_hash === hashRefreshToken(first.refreshToken),
    );
    previous!.revoked_at = new Date(Date.now() - 30_000);

    const replay = await refreshSession(first.refreshToken);
    expect(replay).toMatchObject({ ok: false, reason: 'reused' });
    expect(state().tokens.every((token) => token.revoked_at)).toBe(true);
  });

  it('does not revoke the family when the same token is presented again inside the grace window', async () => {
    await addUser();
    const first = await login('ada@example.com', 'correct-password');
    if (!first.ok) throw new Error('login failed');

    const rotated = await refreshSession(first.refreshToken);
    if (!rotated.ok) throw new Error('refresh failed');

    await expect(refreshSession(first.refreshToken)).resolves.toMatchObject({
      ok: false,
      reason: 'rotated',
    });

    const current = state().tokens.find(
      (token) => token.token_hash === hashRefreshToken(rotated.refreshToken),
    );
    expect(current?.revoked_at).toBeNull();

    const next = await refreshSession(rotated.refreshToken);
    expect(next.ok).toBe(true);
  });

  it('issues a short session without remember me and preserves that on refresh', async () => {
    await addUser();
    const first = await login('ada@example.com', 'correct-password', false);
    if (!first.ok) throw new Error('login failed');
    expect(first.rememberMe).toBe(false);

    const stored = state().tokens.find(
      (token) => token.token_hash === hashRefreshToken(first.refreshToken),
    );
    expect(stored?.remember_me).toBe(false);
    const sessionSkewMs = 5_000;
    expect(stored!.expires_at.getTime()).toBeLessThanOrEqual(
      Date.now() + SESSION_REFRESH_TTL_SECONDS * 1000 + sessionSkewMs,
    );

    const rotated = await refreshSession(first.refreshToken);
    if (!rotated.ok) throw new Error('refresh failed');
    expect(rotated.rememberMe).toBe(false);
    const next = state().tokens.find(
      (token) => token.token_hash === hashRefreshToken(rotated.refreshToken),
    );
    expect(next?.remember_me).toBe(false);
  });

  it('issues a long-lived remember-me session and keeps the flag across rotation', async () => {
    await addUser();
    const first = await login('ada@example.com', 'correct-password', true);
    if (!first.ok) throw new Error('login failed');
    expect(first.rememberMe).toBe(true);

    const stored = state().tokens.find(
      (token) => token.token_hash === hashRefreshToken(first.refreshToken),
    );
    expect(stored?.remember_me).toBe(true);
    expect(stored!.expires_at.getTime()).toBeGreaterThan(
      Date.now() + SESSION_REFRESH_TTL_SECONDS * 1000,
    );
    expect(stored!.expires_at.getTime()).toBeLessThanOrEqual(
      Date.now() + REMEMBER_REFRESH_TTL_SECONDS * 1000 + 5_000,
    );

    const rotated = await refreshSession(first.refreshToken);
    if (!rotated.ok) throw new Error('refresh failed');
    expect(rotated.rememberMe).toBe(true);
  });

  it('treats invalid rememberMe values as false', async () => {
    await addUser();
    const first = await login('ada@example.com', 'correct-password', 'nope');
    if (!first.ok) throw new Error('login failed');
    expect(first.rememberMe).toBe(false);
  });
});
