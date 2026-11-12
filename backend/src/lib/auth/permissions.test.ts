import { Role } from '@prisma/client';
import { canAssignRole, Permission, roleHasPermission } from './permissions';

describe('role permissions', () => {
  it('gives DataView attendance and cameras without HR access', () => {
    expect(roleHasPermission(Role.dataview, Permission.CamerasView)).toBe(true);
    expect(roleHasPermission(Role.dataview, Permission.AttendanceReadOwn)).toBe(true);
    expect(roleHasPermission(Role.dataview, Permission.MedicalReview)).toBe(false);
    expect(roleHasPermission(Role.dataview, Permission.SalaryManage)).toBe(false);
    expect(roleHasPermission(Role.employee, Permission.CamerasView)).toBe(false);
  });

  it('lets employees manage only their own profile, attendance, and medical requests', () => {
    expect(roleHasPermission(Role.employee, Permission.ProfileRequest)).toBe(true);
    expect(roleHasPermission(Role.employee, Permission.AttendanceClockOwn)).toBe(true);
    expect(roleHasPermission(Role.employee, Permission.MedicalSubmitOwn)).toBe(true);
    expect(roleHasPermission(Role.employee, Permission.MedicalReview)).toBe(false);
    expect(roleHasPermission(Role.employee, Permission.UsersCreateEmployee)).toBe(false);
    expect(roleHasPermission(Role.employee, Permission.UsersAssignRole)).toBe(false);
  });

  it('lets HR review claims finance filed, and not claims an employee filed', () => {
    expect(roleHasPermission(Role.hr, Permission.MedicalReview)).toBe(false);
    expect(roleHasPermission(Role.hr, Permission.MedicalReviewOnBehalf)).toBe(true);
    expect(roleHasPermission(Role.hr, Permission.UsersCreateEmployee)).toBe(true);
    expect(roleHasPermission(Role.hr, Permission.UsersCreateAny)).toBe(false);
    expect(roleHasPermission(Role.hr, Permission.UsersAssignRole)).toBe(false);
    expect(canAssignRole(Role.hr, Role.employee)).toBe(true);
    expect(canAssignRole(Role.hr, Role.dataview)).toBe(true);
    expect(canAssignRole(Role.hr, Role.hr)).toBe(false);
    expect(canAssignRole(Role.hr, Role.finance)).toBe(false);
    expect(canAssignRole(Role.hr, Role.super_admin)).toBe(false);
    expect(roleHasPermission(Role.hr, Permission.AuditRead)).toBe(false);
  });

  it('lets Finance approve employee claims and file claims for workers', () => {
    expect(roleHasPermission(Role.finance, Permission.MedicalReview)).toBe(true);
    expect(roleHasPermission(Role.finance, Permission.MedicalSubmitFor)).toBe(true);
    expect(roleHasPermission(Role.finance, Permission.MedicalReviewOnBehalf)).toBe(false);
    expect(roleHasPermission(Role.finance, Permission.UsersRead)).toBe(true);
    expect(roleHasPermission(Role.finance, Permission.UsersManage)).toBe(false);
    expect(canAssignRole(Role.finance, Role.employee)).toBe(false);
  });

  it('lets Super Admin assign every role', () => {
    for (const permission of Object.values(Permission)) {
      expect(roleHasPermission(Role.super_admin, permission)).toBe(true);
    }
    expect(canAssignRole(Role.super_admin, Role.employee)).toBe(true);
    expect(canAssignRole(Role.super_admin, Role.dataview)).toBe(true);
    expect(canAssignRole(Role.super_admin, Role.hr)).toBe(true);
    expect(canAssignRole(Role.super_admin, Role.finance)).toBe(true);
    expect(canAssignRole(Role.super_admin, Role.super_admin)).toBe(true);
  });
});
