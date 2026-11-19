import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/http';
import { writeAudit } from '../lib/audit';
import { AuthUser } from '../lib/auth/session';
import { optionalLabel } from '../lib/fields';
import { roleHasPermission, Permission } from '../lib/auth/permissions';

const COMPANY_ID = 'default';

function parseLimit(value: unknown, label: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100_000_000) {
    throw new HttpError(400, `${label} must be between 0 and 100,000,000`);
  }
  return amount;
}

export async function listDepartments() {
  return prisma.department.findMany({
    where: { company_id: COMPANY_ID },
    orderBy: { name: 'asc' },
  });
}

export async function findDepartmentById(id: string) {
  return prisma.department.findFirst({
    where: { id, company_id: COMPANY_ID },
  });
}

export async function perksFromDepartmentId(departmentId: string) {
  const dept = await findDepartmentById(departmentId);
  if (!dept) throw new HttpError(400, 'Department not found');
  return {
    department_id: dept.id,
    department: dept.name,
    medical_limit: dept.medical_limit,
    opd_limit: dept.opd_limit,
  };
}

export async function createDepartment(
  actor: AuthUser,
  input: { name?: unknown; medical_limit?: unknown; opd_limit?: unknown },
) {
  if (!roleHasPermission(actor.role, Permission.CompanyManage)) {
    throw new HttpError(403, 'You cannot manage departments');
  }
  const name = optionalLabel(input.name, 'Department name');
  if (!name) throw new HttpError(400, 'Department name is required');
  const medical_limit = parseLimit(input.medical_limit ?? 0, 'Medical limit');
  const opd_limit = parseLimit(input.opd_limit ?? 0, 'OPD limit');
  try {
    const created = await prisma.department.create({
      data: { company_id: COMPANY_ID, name, medical_limit, opd_limit },
    });
    await writeAudit(actor.id, 'department.create', 'department', created.id, created.name);
    return created;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      throw new HttpError(409, 'A department with that name already exists');
    }
    throw err;
  }
}

export async function updateDepartment(
  actor: AuthUser,
  id: string,
  input: { name?: unknown; medical_limit?: unknown; opd_limit?: unknown },
) {
  if (!roleHasPermission(actor.role, Permission.CompanyManage)) {
    throw new HttpError(403, 'You cannot manage departments');
  }
  const existing = await findDepartmentById(id);
  if (!existing) throw new HttpError(404, 'Department not found');
  const data: { name?: string; medical_limit?: number; opd_limit?: number } = {};
  if (input.name !== undefined) {
    const name = optionalLabel(input.name, 'Department name');
    if (!name) throw new HttpError(400, 'Department name is required');
    data.name = name;
  }
  if (input.medical_limit !== undefined)
    data.medical_limit = parseLimit(input.medical_limit, 'Medical limit');
  if (input.opd_limit !== undefined) data.opd_limit = parseLimit(input.opd_limit, 'OPD limit');
  if (!Object.keys(data).length) throw new HttpError(400, 'Nothing to update');
  try {
    const updated = await prisma.department.update({ where: { id }, data });
    if (data.name && data.name !== existing.name) {
      await prisma.user.updateMany({
        where: { department_id: id },
        data: { department: data.name },
      });
    }
    await writeAudit(actor.id, 'department.update', 'department', id, updated.name);
    return updated;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Unique constraint')) {
      throw new HttpError(409, 'A department with that name already exists');
    }
    throw err;
  }
}

export async function deleteDepartment(actor: AuthUser, id: string) {
  if (!roleHasPermission(actor.role, Permission.CompanyManage)) {
    throw new HttpError(403, 'You cannot manage departments');
  }
  const existing = await findDepartmentById(id);
  if (!existing) throw new HttpError(404, 'Department not found');
  const members = await prisma.user.count({ where: { department_id: id } });
  if (members > 0) {
    throw new HttpError(409, 'Reassign employees before deleting this department');
  }
  await prisma.department.delete({ where: { id } });
  await writeAudit(actor.id, 'department.delete', 'department', id, existing.name);
}
