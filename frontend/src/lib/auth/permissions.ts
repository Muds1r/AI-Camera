export const Role = {
  employee: 'employee',
  dataview: 'dataview',
  hr: 'hr',
  super_admin: 'super_admin',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ROLES = Object.values(Role);

export const Permission = {
  ProfileReadOwn: 'profile:read:own',
  ProfileRequest: 'profile:request',
  ProfileUpdateOwn: 'profile:update:own',
  AttendanceClockOwn: 'attendance:clock:own',
  AttendanceReadOwn: 'attendance:read:own',
  AttendanceReadAll: 'attendance:read:all',
  AttendanceSettings: 'attendance:settings',
  MedicalSubmitOwn: 'medical:submit:own',
  MedicalReadOwn: 'medical:read:own',
  MedicalReview: 'medical:review',
  LeaveSubmitOwn: 'leave:submit:own',
  LeaveReadOwn: 'leave:read:own',
  LeaveReview: 'leave:review',
  SalaryReadOwn: 'salary:read:own',
  SalaryManage: 'salary:manage',
  UsersCreateEmployee: 'users:create:employee',
  UsersCreateAny: 'users:create:any',
  UsersAssignRole: 'users:assign:role',
  UsersRead: 'users:read',
  UsersManage: 'users:manage',
  CompanyManage: 'company:manage',
  CamerasView: 'cameras:view',
  AuditRead: 'audit:read',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const EMPLOYEE_PERMISSIONS = [
  Permission.ProfileReadOwn,
  Permission.ProfileRequest,
  Permission.AttendanceClockOwn,
  Permission.AttendanceReadOwn,
  Permission.MedicalSubmitOwn,
  Permission.MedicalReadOwn,
  Permission.LeaveSubmitOwn,
  Permission.LeaveReadOwn,
  Permission.SalaryReadOwn,
] as const satisfies readonly Permission[];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  employee: EMPLOYEE_PERMISSIONS,
  dataview: [
    Permission.ProfileReadOwn,
    Permission.ProfileRequest,
    Permission.AttendanceClockOwn,
    Permission.AttendanceReadOwn,
    Permission.CamerasView,
  ],
  hr: [
    ...EMPLOYEE_PERMISSIONS,
    Permission.MedicalReview,
    Permission.LeaveReview,
    Permission.AttendanceReadAll,
    Permission.AttendanceSettings,
    Permission.UsersCreateEmployee,
    Permission.UsersRead,
    Permission.UsersManage,
    Permission.SalaryManage,
    Permission.CompanyManage,
  ],
  super_admin: Object.values(Permission),
};

export const ROLE_LABELS: Record<Role, string> = {
  employee: 'Employee',
  dataview: 'DataView',
  hr: 'HR',
  super_admin: 'Super Admin',
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as string[]).includes(value);
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAssignRole(actor: Role, target: Role): boolean {
  if (actor === Role.super_admin) return true;
  if (actor === Role.hr) return target === Role.employee || target === Role.dataview;
  return false;
}
