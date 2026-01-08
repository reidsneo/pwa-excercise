-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role_id INTEGER REFERENCES roles(id),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Role-Permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Plugin states table
CREATE TABLE IF NOT EXISTS plugin_states (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'installed',
    version TEXT NOT NULL,
    enabled_at INTEGER,
    disabled_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Plugin migrations table
CREATE TABLE IF NOT EXISTS plugin_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plugin_id TEXT NOT NULL,
    version TEXT NOT NULL,
    applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(plugin_id, version)
);

-- Insert default permissions
INSERT INTO permissions (name, description, resource, action) VALUES
    ('users.view', 'View users list', 'users', 'view'),
    ('users.create', 'Create new users', 'users', 'create'),
    ('users.edit', 'Edit user information', 'users', 'edit'),
    ('users.delete', 'Delete users', 'users', 'delete'),
    ('roles.view', 'View roles list', 'roles', 'view'),
    ('roles.create', 'Create new roles', 'roles', 'create'),
    ('roles.edit', 'Edit role information', 'roles', 'edit'),
    ('roles.delete', 'Delete roles', 'roles', 'delete'),
    ('roles.assign_permissions', 'Assign permissions to roles', 'roles', 'assign_permissions'),
    ('plugins.view', 'View plugins list', 'plugins', 'view'),
    ('plugins.install', 'Install plugins', 'plugins', 'install'),
    ('plugins.enable', 'Enable plugins', 'plugins', 'enable'),
    ('plugins.disable', 'Disable plugins', 'plugins', 'disable'),
    ('plugins.uninstall', 'Uninstall plugins', 'plugins', 'uninstall'),
    ('plugins.configure', 'Configure plugins', 'plugins', 'configure'),
    ('content.view', 'View content', 'content', 'view'),
    ('content.create', 'Create content', 'content', 'create'),
    ('content.edit', 'Edit content', 'content', 'edit'),
    ('content.delete', 'Delete content', 'content', 'delete'),
    ('settings.view', 'View settings', 'settings', 'view'),
    ('settings.edit', 'Edit settings', 'settings', 'edit'),
    ('analytics.view', 'View analytics', 'analytics', 'view');

-- Insert default roles
INSERT INTO roles (name, description) VALUES
    ('admin', 'Full system access'),
    ('user', 'Basic user access'),
    ('moderator', 'Content moderation access');

-- Assign permissions to admin role (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

-- Assign permissions to user role (basic permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE name IN ('content.view', 'content.create');

-- Assign permissions to moderator role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE name IN ('users.view', 'content.view', 'content.create', 'content.edit', 'content.delete');
