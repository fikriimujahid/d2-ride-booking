import type { Pool } from 'pg';

export async function getEffectiveAdminPermissions(db: Pool, userId: string): Promise<string[]> {
  // parent inherits child permissions
  const result = await db.query<{ key: string }>(
    `with recursive role_tree as (
      select r.id as role_id
      from admin_user_roles ur
      join admin_roles r on r.id = ur.role_id
      where ur.user_id = $1

      union

      select inh.child_role_id as role_id
      from admin_role_inheritance inh
      join role_tree rt on rt.role_id = inh.parent_role_id
    )
    select distinct p.key
    from role_tree rt
    join admin_role_permissions rp on rp.role_id = rt.role_id
    join admin_permissions p on p.id = rp.permission_id
    order by p.key`,
    [userId]
  );

  return result.rows.map((r: { key: string }) => r.key);
}

export async function getUserAdminRoles(db: Pool, userId: string): Promise<string[]> {
  const result = await db.query<{ name: string }>(
    `select distinct r.name
     from admin_user_roles ur
     join admin_roles r on r.id = ur.role_id
     where ur.user_id = $1
     order by r.name`,
    [userId]
  );

  return result.rows.map((r: { name: string }) => r.name);
}
