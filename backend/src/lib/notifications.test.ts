import { NotificationKind, Role } from '@prisma/client';
import { notifyBenefitDecided, notifyBenefitSubmitted } from './notifications';

interface FakeUser {
  id: string;
  role: Role;
  is_active: boolean;
}

interface FakeNote {
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
}

interface NoticeState {
  users: FakeUser[];
  notes: FakeNote[];
}

function state(): NoticeState {
  return (globalThis as { __noticeState?: NoticeState }).__noticeState!;
}

jest.mock('./prisma', () => {
  const db = () => (globalThis as { __noticeState?: NoticeState }).__noticeState!;
  return {
    prisma: {
      user: {
        findMany: async ({
          where,
        }: {
          where: { role: Role; is_active: boolean; id: { not: string } };
        }) =>
          db()
            .users.filter(
              (user) =>
                user.role === where.role &&
                user.is_active === where.is_active &&
                user.id !== where.id.not,
            )
            .map((user) => ({ id: user.id })),
      },
      notification: {
        createMany: async ({ data }: { data: FakeNote[] }) => {
          db().notes.push(...data);
          return { count: data.length };
        },
      },
    },
  };
});

beforeEach(() => {
  (globalThis as { __noticeState?: NoticeState }).__noticeState = {
    users: [
      { id: 'fin-1', role: Role.finance, is_active: true },
      { id: 'fin-2', role: Role.finance, is_active: true },
      { id: 'hr-1', role: Role.hr, is_active: true },
      { id: 'hr-2', role: Role.hr, is_active: true },
      { id: 'hr-off', role: Role.hr, is_active: false },
      { id: 'admin-1', role: Role.super_admin, is_active: true },
      { id: 'emp-1', role: Role.employee, is_active: true },
    ],
    notes: [],
  };
});

describe('request notifications', () => {
  it('tells active finance about a new employee claim', async () => {
    await notifyBenefitSubmitted({
      actorId: 'emp-1',
      requesterName: 'Ada Lovelace',
      kind: 'medical',
      amount: 1500,
      reason: 'Clinic visit',
    });

    expect(
      state()
        .notes.map((note) => note.user_id)
        .sort(),
    ).toEqual(['fin-1', 'fin-2']);
    expect(state().notes[0]).toMatchObject({
      kind: NotificationKind.request_submitted,
      title: 'New Medical request',
      href: '/finance/claims?tab=medical',
    });
    expect(state().notes[0].body).toContain('Ada Lovelace');
    expect(state().notes[0].body).toContain('PKR 1,500');
    expect(state().notes[0].body).toContain('Clinic visit');
  });

  it('falls back to Super Admin when no finance account can review', async () => {
    state().users = state().users.filter((user) => user.role !== Role.finance);
    await notifyBenefitSubmitted({
      actorId: 'emp-1',
      requesterName: 'Grace Hopper',
      kind: 'opd',
      amount: 800,
      reason: 'Pharmacy',
    });

    expect(state().notes.map((note) => note.user_id)).toEqual(['admin-1']);
    expect(state().notes[0].href).toBe('/finance/claims?tab=opd');
  });

  it('tells the employee when a claim is rejected, including the reason', async () => {
    await notifyBenefitDecided({
      userId: 'emp-1',
      kind: 'opd',
      amount: 800,
      status: 'rejected',
      reviewNote: 'Receipt is missing',
    });

    expect(state().notes).toEqual([
      expect.objectContaining({
        user_id: 'emp-1',
        kind: NotificationKind.request_rejected,
        title: 'OPD request rejected',
        href: '/requests?tab=benefits&kind=opd',
      }),
    ]);
    expect(state().notes[0].body).toContain('was rejected');
    expect(state().notes[0].body).toContain('Receipt is missing');
  });
});
