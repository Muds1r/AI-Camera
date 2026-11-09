import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http';

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function submitOwnAttendance(userId: string, note: unknown) {
  let cleanNote: string | null = null;
  if (note !== undefined && note !== null) {
    if (typeof note !== 'string') throw new HttpError(400, 'Note is invalid');
    const trimmed = note.trim();
    if (trimmed.length > 500) throw new HttpError(400, 'Note must be at most 500 characters');
    cleanNote = trimmed || null;
  }

  const workDate = utcToday();
  const existing = await prisma.attendance.findUnique({
    where: { user_id_work_date: { user_id: userId, work_date: workDate } },
  });
  if (existing) throw new HttpError(409, 'Attendance for today has already been submitted');

  try {
    return await prisma.attendance.create({
      data: { user_id: userId, work_date: workDate, note: cleanNote },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'Attendance for today has already been submitted');
    }
    throw err;
  }
}

export function listOwnAttendance(userId: string) {
  return prisma.attendance.findMany({
    where: { user_id: userId },
    orderBy: { work_date: 'desc' },
    take: 60,
  });
}
