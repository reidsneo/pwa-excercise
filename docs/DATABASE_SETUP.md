# D1 Database Setup

This project uses Cloudflare D1 (SQLite) for the database.

## Local Development Setup

### 1. Initialize the Database

The database has already been initialized, but if you need to reset it:

```bash
# Run the initialization script
./scripts/init-db.sh

# Or manually
npx wrangler d1 execute sample-worker-neo-db --local --file=./migrations/0001_init.sql
```

### 2. Start the Development Server

```bash
npm run dev
```

### 3. Database Location

Local D1 databases are stored in:
```
.wrangler/state/v3/d1/miniflare-D1DatabaseObject/
```

## Database Schema

The database includes the following tables:

- **users** - User accounts with authentication
- **roles** - User roles (admin, user, moderator)
- **permissions** - Granular permissions
- **role_permissions** - Junction table for role-permission assignments
- **sessions** - User sessions for authentication

## Seeded Data

After initialization, the database includes:

### Roles (3)
- **admin** - Full system access (all permissions)
- **user** - Basic user access (content.view, content.create)
- **moderator** - Content moderation access

### Permissions (16)
- users.* (view, create, edit, delete)
- roles.* (view, create, edit, delete, assign_permissions)
- content.* (view, create, edit, delete)
- settings.* (view, edit)
- analytics.* (view)

## Running Queries

To query the local database:

```bash
# View all users
npx wrangler d1 execute sample-worker-neo-db --local --command="SELECT * FROM users"

# View all roles
npx wrangler d1 execute sample-worker-neo-db --local --command="SELECT * FROM roles"

# View role permissions
npx wrangler d1 execute sample-worker-neo-db --local --command="SELECT rp.role_id, r.name as role_name, p.name as permission_name FROM role_permissions rp JOIN roles r ON rp.role_id = r.id JOIN permissions p ON rp.permission_id = p.id"
```

## Resetting the Database

To completely reset the database:

```bash
# Delete local database
rm -rf .wrangler/state/v3/d1/

# Re-initialize
./scripts/init-db.sh
```

## Configuration

The D1 binding is configured in `wrangler.json`:

```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "sample-worker-neo-db",
      "database_id": "local"
    }
  ]
}
```

The database is accessible in the worker via `c.env.DB`.
