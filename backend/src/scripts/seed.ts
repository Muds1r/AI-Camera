import 'dotenv/config';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth/passwords';
import { assertEmail, assertPassword } from '../lib/auth/users';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || 'Super Admin';

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set');
  }

  const normalized = assertEmail(email);
  assertPassword(password);

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    if (existing.role !== Role.super_admin) {
      throw new Error(`Seed email ${normalized} already belongs to a ${existing.role} account`);
    }
    console.log(`Super Admin already exists: ${normalized}`);
    return;
  }

  await prisma.user.create({
    data: {
      email: normalized,
      password_hash: await hashPassword(password),
      full_name: name.trim() || 'Super Admin',
      role: Role.super_admin,
    },
  });

  console.log(`Super Admin created: ${normalized}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
