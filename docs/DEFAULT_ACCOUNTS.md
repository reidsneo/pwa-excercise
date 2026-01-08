# Default Admin Accounts

This document lists the default admin accounts created during database initialization.

## Master Tenant (Default Tenant)

Access the master tenant via: `http://localhost:8787`

**Credentials:**
- **Email:** `admin@localhost.dev`
- **Password:** `admin123`
- **Role:** Admin (role_id = 1)
- **Tenant:** Master Workspace (default)
- **Plan:** Premium

## Tenant-2

Access tenant-2 via: `http://tenant-2.localhost:8787`

**Credentials:**
- **Email:** `admin@tenant-2.dev`
- **Password:** `admin123`
- **Role:** Admin (role_id = 1)
- **Tenant:** Tenant 2 Workspace (tenant-2)
- **Plan:** Free

## Initialization

These accounts are automatically created when you run the initialization command:

```bash
# Initialize database (preserves existing data)
npm run initialize

# Or run directly
node scripts/initialize.js
```

The initialization script:
1. Creates the default/master tenant if it doesn't exist
2. Creates tenant-2 if it doesn't exist
3. Creates admin accounts for both tenants with `role_id = 1`
4. Links each admin to their respective tenant as an "owner"

## Force Reset (Delete Database & Start Fresh)

⚠️ **DANGER:** This will delete ALL data in the database!

To completely reset the database and start fresh:

```bash
# Option 1: Direct script execution (recommended)
node scripts/initialize.js --force

# Option 2: Via npm (requires extra --)
npm run initialize -- --force
```

This will:
1. Delete the D1 database files (.sqlite, .sqlite-shm, .sqlite-wal)
2. Drop all existing database tables
3. Build the project
4. Reinitialize the database from scratch
5. Create fresh default admin accounts
6. Display the default credentials after completion

**Use cases:**
- Development/testing when you need a clean slate
- Resetting corrupted data
- Testing the initialization process
- Starting over after schema changes

**Warning:** This cannot be undone! All data will be permanently lost.

## Security Notes

⚠️ **IMPORTANT:** These are default credentials for development/testing purposes.

**Before deploying to production:**
1. Change all default passwords
2. Remove or disable these accounts
3. Create proper admin accounts with strong passwords
4. Consider using environment variables for initial admin setup

## Account Creation Details

### Master Admin Account
```sql
INSERT INTO users (email, password_hash, name, role_id, is_active, created_at, updated_at)
VALUES ('admin@localhost.dev', ?, 'Master Admin', 1, 1, strftime('%s', 'now'), strftime('%s', 'now'));

INSERT INTO tenant_users (tenant_id, user_id, role, joined_at)
VALUES ('default', (SELECT id FROM users WHERE email = 'admin@localhost.dev'), 'owner', strftime('%s', 'now'));
```

### Tenant-2 Admin Account
```sql
INSERT INTO users (email, password_hash, name, role_id, is_active, created_at, updated_at)
VALUES ('admin@tenant-2.dev', ?, 'Tenant 2 Admin', 1, 1, strftime('%s', 'now'), strftime('%s', 'now'));

INSERT INTO tenant_users (tenant_id, user_id, role, joined_at)
VALUES ('tenant-2-id', (SELECT id FROM users WHERE email = 'admin@tenant-2.dev'), 'owner', strftime('%s', 'now'));
```

Passwords are hashed using bcrypt with salt rounds = 10.
