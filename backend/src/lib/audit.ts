import { prisma } from './prisma';

export async function writeAudit(
  actorId: string | null,
  action: string,
  targetType: string,
  targetId?: string | null,
  detail?: string,
) {
  await prisma.auditLog.create({
    data: {
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId ?? null,
      detail: detail ?? null,
    },
  });
}
