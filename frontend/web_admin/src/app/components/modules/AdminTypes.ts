export interface Admin {
  id: string;
  email: string;
  full_name?: string;
  system_role: "ADMIN";
  roles: string[];
  permissions: string[];
  is_active: boolean;
  two_factor_enabled: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface AdminFormData {
  email: string;
  full_name?: string;
  roles: string[];
  permissions: string[];
}
