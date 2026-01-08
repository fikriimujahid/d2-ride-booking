-- ============================================================================
-- Admin RBAC Database Seed - Example SQL
-- ============================================================================
-- This shows the database structure after running the updated seed
-- Use this to understand the permission model and verify your database state
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Permissions Catalog
-- ----------------------------------------------------------------------------
-- All available permissions in the system
-- These are the atomic authorization units

SELECT * FROM admin_permissions ORDER BY key;

/*
Expected Output:

id                                   | key                           | description
-------------------------------------|-------------------------------|----------------------------------
uuid-1                               | admin.admins.manage           | Create/edit/delete admin users
uuid-2                               | admin.admins.view             | View admin users list
uuid-3                               | admin.analytics.export        | Export reports and data
uuid-4                               | admin.analytics.view          | View analytics dashboards
uuid-5                               | admin.dashboard.control       | Control rides and dispatch operations
uuid-6                               | admin.dashboard.view          | View live operations dashboard
uuid-7                               | admin.disputes.resolve        | Resolve disputes and issue refunds
uuid-8                               | admin.disputes.view           | View disputes and support tickets
uuid-9                               | admin.drivers.delete          | Delete/suspend drivers
uuid-10                              | admin.drivers.edit            | Edit driver information and approvals
uuid-11                              | admin.drivers.view            | View driver list and profiles
uuid-12                              | admin.fraud.investigate       | Investigate and flag fraudulent activity
uuid-13                              | admin.fraud.view              | View fraud detection dashboard
uuid-14                              | admin.passengers.delete       | Delete/suspend passengers
uuid-15                              | admin.passengers.edit         | Edit passenger information
uuid-16                              | admin.passengers.view         | View passenger list and profiles
uuid-17                              | admin.pricing.manage          | Create and modify pricing rules
uuid-18                              | admin.pricing.view            | View pricing rules and promotions
uuid-19                              | admin.roles.manage            | Create/edit roles and assign permissions
uuid-20                              | admin.roles.view              | View roles and permissions
uuid-21                              | admin.settings.manage         | Modify system configuration
uuid-22                              | admin.settings.view           | View system settings
*/

-- ----------------------------------------------------------------------------
-- STEP 2: Roles
-- ----------------------------------------------------------------------------
-- Three-tier role hierarchy

SELECT * FROM admin_roles ORDER BY name;

/*
Expected Output:

id                                   | name           | description
-------------------------------------|----------------|--------------------------------------------------
role-uuid-1                          | ops_admin      | Operations admin - full control over rides, pricing, disputes
role-uuid-2                          | super_admin    | Full system access including RBAC management
role-uuid-3                          | support_admin  | Support admin - read-only access to help users
*/

-- ----------------------------------------------------------------------------
-- STEP 3: Role Inheritance
-- ----------------------------------------------------------------------------
-- super_admin inherits from ops_admin and support_admin

SELECT 
  parent.name AS parent_role,
  child.name AS child_role
FROM admin_role_inheritance i
JOIN admin_roles parent ON parent.id = i.parent_role_id
JOIN admin_roles child ON child.id = i.child_role_id;

/*
Expected Output:

parent_role  | child_role
-------------|-------------
super_admin  | ops_admin
super_admin  | support_admin
*/

-- ----------------------------------------------------------------------------
-- STEP 4: Role → Permission Mappings
-- ----------------------------------------------------------------------------

-- Support Admin Permissions (Read-only)
SELECT 
  r.name AS role_name,
  p.key AS permission_key
FROM admin_role_permissions rp
JOIN admin_roles r ON r.id = rp.role_id
JOIN admin_permissions p ON p.id = rp.permission_id
WHERE r.name = 'support_admin'
ORDER BY p.key;

/*
Expected Output:

role_name     | permission_key
--------------|---------------------------
support_admin | admin.analytics.view
support_admin | admin.dashboard.view
support_admin | admin.disputes.view
support_admin | admin.drivers.view
support_admin | admin.passengers.view
*/

-- Ops Admin Permissions (Operational control)
SELECT 
  r.name AS role_name,
  p.key AS permission_key
FROM admin_role_permissions rp
JOIN admin_roles r ON r.id = rp.role_id
JOIN admin_permissions p ON p.id = rp.permission_id
WHERE r.name = 'ops_admin'
ORDER BY p.key;

/*
Expected Output:

role_name  | permission_key
-----------|---------------------------
ops_admin  | admin.analytics.export
ops_admin  | admin.analytics.view
ops_admin  | admin.dashboard.control
ops_admin  | admin.dashboard.view
ops_admin  | admin.disputes.resolve
ops_admin  | admin.disputes.view
ops_admin  | admin.drivers.edit
ops_admin  | admin.drivers.view
ops_admin  | admin.fraud.investigate
ops_admin  | admin.fraud.view
ops_admin  | admin.passengers.edit
ops_admin  | admin.passengers.view
ops_admin  | admin.pricing.manage
ops_admin  | admin.pricing.view
*/

-- Super Admin Permissions (Direct, not inherited)
SELECT 
  r.name AS role_name,
  p.key AS permission_key
FROM admin_role_permissions rp
JOIN admin_roles r ON r.id = rp.role_id
JOIN admin_permissions p ON p.id = rp.permission_id
WHERE r.name = 'super_admin'
ORDER BY p.key;

/*
Expected Output:

role_name    | permission_key
-------------|---------------------------
super_admin  | admin.admins.manage
super_admin  | admin.admins.view
super_admin  | admin.drivers.delete
super_admin  | admin.passengers.delete
super_admin  | admin.roles.manage
super_admin  | admin.roles.view
super_admin  | admin.settings.manage
super_admin  | admin.settings.view
*/

-- ----------------------------------------------------------------------------
-- STEP 5: Effective Permissions (with inheritance)
-- ----------------------------------------------------------------------------
-- This shows the ACTUAL permissions a user has (including inherited)

-- Super Admin Effective Permissions (includes inherited from ops_admin + support_admin)
WITH RECURSIVE role_tree AS (
  SELECT r.id AS role_id
  FROM admin_roles r
  WHERE r.name = 'super_admin'
  
  UNION
  
  SELECT inh.child_role_id AS role_id
  FROM admin_role_inheritance inh
  JOIN role_tree rt ON rt.role_id = inh.parent_role_id
)
SELECT DISTINCT p.key AS permission_key
FROM role_tree rt
JOIN admin_role_permissions rp ON rp.role_id = rt.role_id
JOIN admin_permissions p ON p.id = rp.permission_id
ORDER BY p.key;

/*
Expected Output (ALL permissions - 22 total):

permission_key
---------------------------
admin.admins.manage
admin.admins.view
admin.analytics.export
admin.analytics.view
admin.dashboard.control
admin.dashboard.view
admin.disputes.resolve
admin.disputes.view
admin.drivers.delete
admin.drivers.edit
admin.drivers.view
admin.fraud.investigate
admin.fraud.view
admin.passengers.delete
admin.passengers.edit
admin.passengers.view
admin.pricing.manage
admin.pricing.view
admin.roles.manage
admin.roles.view
admin.settings.manage
admin.settings.view
*/

-- ----------------------------------------------------------------------------
-- STEP 6: User → Role Assignments
-- ----------------------------------------------------------------------------

SELECT 
  u.email,
  r.name AS role_name
FROM admin_user_roles ur
JOIN users u ON u.id = ur.user_id
JOIN admin_roles r ON r.id = ur.role_id
WHERE u.user_type = 'ADMIN'
ORDER BY u.email, r.name;

/*
Expected Output (after seed):

email               | role_name
--------------------|------------
admin@example.com   | super_admin
*/

-- ----------------------------------------------------------------------------
-- STEP 7: Complete User Context
-- ----------------------------------------------------------------------------
-- This is what GET /admin/me returns (simulated in SQL)

WITH user_info AS (
  SELECT id, email, user_type
  FROM users
  WHERE email = 'admin@example.com'
    AND user_type = 'ADMIN'
),
user_roles AS (
  SELECT DISTINCT r.name
  FROM user_info ui
  JOIN admin_user_roles ur ON ur.user_id = ui.id
  JOIN admin_roles r ON r.id = ur.role_id
),
user_permissions AS (
  WITH RECURSIVE role_tree AS (
    SELECT r.id AS role_id
    FROM user_info ui
    JOIN admin_user_roles ur ON ur.user_id = ui.id
    JOIN admin_roles r ON r.id = ur.role_id
    
    UNION
    
    SELECT inh.child_role_id AS role_id
    FROM admin_role_inheritance inh
    JOIN role_tree rt ON rt.role_id = inh.parent_role_id
  )
  SELECT DISTINCT p.key
  FROM role_tree rt
  JOIN admin_role_permissions rp ON rp.role_id = rt.role_id
  JOIN admin_permissions p ON p.id = rp.permission_id
  ORDER BY p.key
)
SELECT
  json_build_object(
    'identity', json_build_object(
      'id', ui.id,
      'email', ui.email,
      'userType', ui.user_type
    ),
    'roles', (SELECT json_agg(name) FROM user_roles),
    'permissions', (SELECT json_agg(key) FROM user_permissions),
    'metadata', json_build_object(
      'environment', 'development'
    )
  ) AS admin_context
FROM user_info ui;

/*
Expected Output (formatted):

{
  "identity": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@example.com",
    "userType": "ADMIN"
  },
  "roles": ["super_admin"],
  "permissions": [
    "admin.admins.manage",
    "admin.admins.view",
    "admin.analytics.export",
    "admin.analytics.view",
    "admin.dashboard.control",
    "admin.dashboard.view",
    "admin.disputes.resolve",
    "admin.disputes.view",
    "admin.drivers.delete",
    "admin.drivers.edit",
    "admin.drivers.view",
    "admin.fraud.investigate",
    "admin.fraud.view",
    "admin.passengers.delete",
    "admin.passengers.edit",
    "admin.passengers.view",
    "admin.pricing.manage",
    "admin.pricing.view",
    "admin.roles.manage",
    "admin.roles.view",
    "admin.settings.manage",
    "admin.settings.view"
  ],
  "metadata": {
    "environment": "development"
  }
}
*/

-- ----------------------------------------------------------------------------
-- STEP 8: Verify Your Database
-- ----------------------------------------------------------------------------

-- Count permissions per role (including inherited)
WITH RECURSIVE role_tree AS (
  SELECT 
    r.id AS role_id,
    r.name AS role_name,
    r.id AS original_role_id
  FROM admin_roles r
  
  UNION
  
  SELECT 
    inh.child_role_id AS role_id,
    r.name AS role_name,
    rt.original_role_id
  FROM admin_role_inheritance inh
  JOIN role_tree rt ON rt.role_id = inh.parent_role_id
  JOIN admin_roles r ON r.id = rt.original_role_id
)
SELECT 
  rt.role_name,
  COUNT(DISTINCT p.id) AS permission_count
FROM role_tree rt
JOIN admin_role_permissions rp ON rp.role_id = rt.role_id
JOIN admin_permissions p ON p.id = rp.permission_id
WHERE rt.role_id = rt.original_role_id  -- Only count for original role
GROUP BY rt.role_name
ORDER BY permission_count DESC;

/*
Expected Output:

role_name     | permission_count
--------------|------------------
super_admin   | 22  (all permissions via direct + inheritance)
ops_admin     | 14  (operational permissions)
support_admin | 5   (read-only permissions)
*/

-- ----------------------------------------------------------------------------
-- TROUBLESHOOTING
-- ----------------------------------------------------------------------------

-- Check if permissions are missing
SELECT 'Missing permissions' AS issue
WHERE NOT EXISTS (
  SELECT 1 FROM admin_permissions WHERE key = 'admin.dashboard.view'
);

-- Check if roles are missing
SELECT 'Missing roles' AS issue
WHERE NOT EXISTS (
  SELECT 1 FROM admin_roles WHERE name = 'super_admin'
);

-- Check if admin user has a role assigned
SELECT 'Admin user has no roles' AS issue
WHERE NOT EXISTS (
  SELECT 1 
  FROM users u
  JOIN admin_user_roles ur ON ur.user_id = u.id
  WHERE u.email = 'admin@example.com'
);

-- Check if super_admin has inheritance set up
SELECT 'super_admin missing inheritance' AS issue
WHERE NOT EXISTS (
  SELECT 1 
  FROM admin_role_inheritance i
  JOIN admin_roles r ON r.id = i.parent_role_id
  WHERE r.name = 'super_admin'
);
