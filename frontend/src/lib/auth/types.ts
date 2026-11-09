import type { Role } from './permissions';

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone: string | null;
  address: string | null;
  id_card_number: string | null;
  info: string | null;
  avatar_url: string | null;
  department: string | null;
  designation: string | null;
  salary_basic: number;
  salary_allowance: number;
  salary_deduction: number;
  medical_limit: number;
  opd_limit: number;
  clock_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
