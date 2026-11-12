import { canAccessPath, safeNextPath } from '@/lib/auth/guards';
import { canAssignRole, Permission, roleHasPermission } from '@/lib/auth/permissions';

describe('route guards', () => {
  it('keeps Dataview aligned with Employee and reserves HR and Super Admin routes', () => {
    expect(roleHasPermission('dataview', Permission.CamerasView)).toBe(true);
    expect(roleHasPermission('employee', Permission.CamerasView)).toBe(false);
    expect(roleHasPermission('hr', Permission.UsersCreateAny)).toBe(false);
    expect(canAssignRole('super_admin', 'dataview')).toBe(true);

    expect(canAccessPath('/profile', 'employee')).toBe('allow');
    expect(canAccessPath('/profile', 'dataview')).toBe('allow');
    expect(canAccessPath('/hr', 'employee')).toBe('deny');
    expect(canAccessPath('/hr', 'dataview')).toBe('deny');
    expect(canAccessPath('/hr', 'finance')).toBe('deny');
    expect(canAccessPath('/finance/claims', 'finance')).toBe('allow');
    expect(canAccessPath('/finance/claims', 'hr')).toBe('deny');
    expect(canAccessPath('/policies', 'employee')).toBe('allow');
    expect(canAccessPath('/policies', 'finance')).toBe('allow');
    expect(canAccessPath('/hr', 'hr')).toBe('allow');
    expect(canAccessPath('/admin/users', 'hr')).toBe('deny');
    expect(canAccessPath('/admin/users', 'super_admin')).toBe('allow');
    expect(canAccessPath('/cameras', 'employee')).toBe('deny');
    expect(canAccessPath('/cameras', 'dataview')).toBe('allow');
    expect(canAccessPath('/requests', null)).toBe('login');
    expect(canAccessPath('/login', null)).toBe('allow');
    expect(canAccessPath('/api/auth/forgot-password', null)).toBe('allow');
  });

  it('rejects external redirect targets', () => {
    expect(safeNextPath('/requests')).toBe('/requests');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('/\\evil.example')).toBe('/');
  });
});
