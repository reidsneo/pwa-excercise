# Full-Stack PWA with React, Vite, Hono, and Cloudflare Workers

A complete full-stack Progressive Web Application built with React 19, Vite, Hono, and Cloudflare Workers with D1 database. Features a production-ready authentication and authorization system with role-based access control (RBAC).

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/vite-react-template)

## Tech Stack

### Frontend
- **React 19** - Modern UI library with latest features
- **Vite 6** - Lightning-fast build tooling and HMR
- **React Router v7** - Client-side routing
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **PWA** - Offline support with service worker

### Backend
- **Hono** - Ultralight, modern web framework
- **Cloudflare Workers** - Edge computing platform
- **D1 Database** - SQLite at the edge
- **Drizzle ORM** - Type-safe database queries

### Authentication & Authorization
- **JWT** (jose) - Stateless authentication
- **bcrypt** - Secure password hashing
- **RBAC** - Role-based access control with granular permissions

## Features

- 🔐 Complete authentication system (register, login, logout)
- 👥 Role-based access control with granular permissions
- 🎛️ Admin dashboard with permission-based menu filtering
- 💾 Persistent sessions with JWT tokens (7-day expiration)
- 📱 Progressive Web App with offline support
- 🚀 Hot Module Replacement for rapid development
- 🌐 Edge deployment with Cloudflare Workers
- 📊 D1 database with auto-initialization and seed data
- 🛡️ Protected routes with role checking
- 🔍 Permission-based UI rendering

## Project Structure

```
sample-worker-neo/
├── src/
│   ├── worker/           # Cloudflare Worker backend (Hono API)
│   │   ├── auth.ts       # JWT authentication utilities
│   │   ├── db/
│   │   │   ├── schema.ts # Database schema (Drizzle ORM)
│   │   │   └── index.ts  # Database queries and operations
│   │   └── index.ts      # API routes and middleware
│   └── react-app/        # React frontend application
│       ├── apps/
│       │   ├── admin/    # Admin dashboard with RBAC
│       │   └── user/     # Main user interface
│       ├── components/   # Reusable UI components
│       ├── contexts/     # React contexts (AuthContext)
│       ├── pages/        # Page components
│       └── main.tsx      # React entry point
├── .dev.vars             # Local environment variables (for Localflare)
├── wrangler.toml         # Cloudflare Workers configuration
└── vite.config.ts        # Vite configuration
```

## Prerequisites

- **Node.js** 18+ and npm
- **Localflare** - For local Cloudflare Workers development
  ```bash
  npm install -g localflare
  ```

## Installation

1. **Clone the repository** (or create from template):
   ```bash
   npm create cloudflare@latest -- --template=cloudflare/templates/vite-react-template
   cd sample-worker-neo
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:

   Create a `.dev.vars` file in the project root (for local development with Localflare):
   ```bash
   # .dev.vars
   JWT_SECRET=your-secret-key-change-in-production
   ```

   **Important**: Localflare reads from `.dev.vars`, NOT `.env`. Always use `.dev.vars` for local development.

4. **Initialize D1 database** (optional - auto-initializes on first run):
   ```bash
   # Create D1 database
   npx wrangler d1 create sample-worker-neo-db

   # Update database_id in wrangler.toml if needed
   ```

## Development

### ⚠️ Important: Use Localflare, not `wrangler dev`

**This project does NOT work with `npx wrangler dev`** because:

1. This project uses Vite to bundle the worker code with custom path aliases (`@/shared`, `@/plugins`, etc.)
2. `wrangler dev` uses its own bundler which doesn't understand these path aliases
3. Localflare uses the Vite build output which has all paths already resolved

**Always use Localflare for local development.**

### Using Localflare (Recommended for local development)

Localflare provides a local Cloudflare Workers environment with D1 database support:

```bash
# Terminal 1: Start Localflare (runs on http://localhost:8787)
localflare

# Terminal 2 (Optional): Start Vite dev server for frontend HMR
npm run dev
```

The application will be available at [http://localhost:8787](http://localhost:8787).

**Why Localflare?**
- Automatically uses the Vite build output from `dist/`
- Supports D1 database locally
- Reads environment variables from `.dev.vars`
- Handles all path aliases correctly

### Quick Start Commands

```bash
# Install Localflare (if not already installed)
npm install -g localflare

# Start the full stack (backend + database)
localflare

# The app is now available at http://localhost:8787
# - API: http://localhost:8787/api/*
# - Frontend: http://localhost:8787/*
```

### Using Vite dev server only

For frontend-only development without Workers backend:

```bash
npm run dev
```

The application will be available at [http://localhost:5173](http://localhost:5173).

**Note**: API routes won't work without the Workers backend.

### Available Scripts

```bash
npm run dev          # Start Vite development server (frontend only)
npm run build        # Build for production (creates dist/ folder)
npm run preview      # Preview production build locally
npm run deploy       # Deploy to Cloudflare Workers
npm run initialize   # Initialize database, seed data, and run migrations
npm run cf-typegen   # Generate TypeScript types for Cloudflare Workers
npm run lint         # Lint code with ESLint
```

### Development Workflow

1. **Make code changes**
2. **Build**: `npm run build` (or use Vite's watch mode)
3. **Localflare automatically picks up changes** from `dist/` folder

**Tip**: For faster development, run Vite in watch mode in a separate terminal:
```bash
# Terminal 1
npm run build -- --watch

# Terminal 2
localflare
```

### Monitoring Worker Logs

For production deployments, monitor your worker logs:

```bash
npx wrangler tail
```

## Database Schema

The application uses 11 main tables:

### Core Tables
- **users** - User accounts (email, password hash, name, role_id)
- **roles** - Role definitions (admin, user, moderator)
- **permissions** - Granular permissions (resource:action format)
- **role_permissions** - Junction table for role-permission relationships
- **sessions** - User sessions for JWT management

### Plugin Management Tables
- **plugin_states** - Plugin installation and enablement status
- **plugin_migrations** - Database migration tracking for plugins

### SaaS Multitenancy Tables
- **tenants** - SaaS customer accounts with subdomain support
- **plugin_licenses** - License tracking with expiration and plans
- **plugin_tiers** - Pricing tiers (free, trial, monthly, yearly, lifetime)
- **plugin_feature_flags** - Granular feature control per tenant
- **plugin_usage** - Metered billing tracking
- **invoices** - Billing records

### Default Seed Data

On first run, the database auto-initializes with:
- **3 roles**: admin (all permissions), user (basic access), moderator
- **28 permissions**: users.*, roles.*, plugins.*, blog.*, content.*, settings.*, analytics.*
- Admin role assigned all permissions

## Database Management

### How Database Initialization Works

The database automatically initializes on the first request after deployment. The `initializeDatabase()` function in `src/worker/index.ts`:

1. Checks if tables exist by querying the users table
2. If tables don't exist, creates all tables and indexes
3. Inserts default permissions and roles
4. Sets up role-permission relationships

### Reinitializing the Database

If you need to completely reset the database (delete all data and start fresh):

#### Option 1: Delete and Recreate D1 Database (Recommended)

```bash
# 1. List your D1 databases
npx wrangler d1 list

# 2. Delete the existing database
npx wrangler d1 delete sample-worker-neo-db

# 3. Create a new database
npx wrangler d1 create sample-worker-neo-db

# 4. Update the database_id in wrangler.toml with the new ID

# 5. Restart Localflare or redeploy
# The database will auto-initialize on first request
```

#### Option 2: Drop All Tables via SQL

```bash
# Connect to your D1 database
npx wrangler d1 execute sample-worker-neo-db --command --interactive

# Then run these DROP commands:
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS plugin_usage;
DROP TABLE IF EXISTS plugin_feature_flags;
DROP TABLE IF EXISTS plugin_tiers;
DROP TABLE IF EXISTS plugin_licenses;
DROP TABLE IF EXISTS tenants;
DROP TABLE IF EXISTS plugin_migrations;
DROP TABLE IF EXISTS plugin_states;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;

# Exit and restart - tables will be recreated automatically
```

#### Option 3: Local Development - Delete Local DB File

When using Localflare, the database is stored locally:

```bash
# Stop Localflare

# Find and delete the local database file
# Usually in: ~/.localflare/data/ or your project's .wrangler/ directory
rm -rf ~/.localflare/data/

# Restart Localflare
localflare

# Database will reinitialize on first request
```

### Running Database Migrations

#### Quick Start - Full Initialization

For a fresh development environment, use the initialize command to set up everything:

```bash
# Make sure Localflare is running first
localflare

# In another terminal, run the initialize command
npm run initialize

# This will:
# 1. Initialize all database tables
# 2. Seed the plugin marketplace with the Blog Plugin
# 3. Create all pricing tiers (free, trial, monthly, yearly, lifetime)
# 4. Register and enable the Blog Plugin
# 5. Run all plugin migrations (creates blog_posts, blog_categories, etc.)
```

After initialization, you can immediately start using the application with all features enabled.

#### Individual Setup Steps (Advanced)

If you prefer to set up components individually:

##### Seeding Plugin Tier Data

After database initialization, seed the plugin pricing tiers:

```bash
# Using curl
curl -X POST http://localhost:8787/api/saas/seed-tiers

# This creates pricing tiers for the blog plugin:
# - free: $0 (basic features)
# - trial: 14 days (all features)
# - monthly: $9.99/month
# - yearly: $99.99/year
# - lifetime: $499.99 one-time
```

#### Creating a Test Tenant

Create a sample tenant for testing:

```bash
curl -X POST http://localhost:8787/api/saas/seed-tenant \
  -H "Content-Type: application/json" \
  -d '{"name": "TestCompany"}'

# Returns: tenantId and slug (e.g., "testcompany-abc123")
```

#### Seeding Blog Sample Data

```bash
curl -X POST http://localhost:8787/api/blog/seed
```

#### Seeding Plugin Marketplace Data

Populate the plugin marketplace with available plugins:

```bash
curl -X POST http://localhost:8787/api/saas/seed-plugins

# This adds the Blog Plugin to the marketplace with pricing tiers
# Returns: success message
```

### Database Commands

```bash
# Execute SQL directly
npx wrangler d1 execute sample-worker-neo-db --command "SELECT * FROM users"

# Execute SQL from file
npx wrangler d1 execute sample-worker-neo-db --file=./path/to/query.sql

# Interactive SQL shell
npx wrangler d1 execute sample-worker-neo-db --interactive

# Export database to SQL file
npx wrangler d1 export sample-worker-neo-db --output=backup.sql

# View table schema
npx wrangler d1 execute sample-worker-neo-db --command ".schema"
```

### Checking Database Status

```bash
# List all tables
npx wrangler d1 execute sample-worker-neo-db --command "SELECT name FROM sqlite_master WHERE type='table'"

# Check tenant count
npx wrangler d1 execute sample-worker-neo-db --command "SELECT COUNT(*) as count FROM tenants"

# Check plugin licenses
npx wrangler d1 execute sample-worker-neo-db --command "SELECT * FROM plugin_licenses"

# Check plugin tiers
npx wrangler d1 execute sample-worker-neo-db --command "SELECT * FROM plugin_tiers"
```

### Common Issues

**"no such table: tenants" Error**

This happens on first run before tables are created. The tenant detection middleware gracefully handles this by returning null. After the first request completes, tables will be created and the error will stop.

**Database not persisting in Localflare**

Make sure you're not deleting the `.localflare/` directory between runs. The database persists in `~/.localflare/data/` by default.

**Need to clear cache after schema changes**

```bash
# Stop Localflare
# Clear cache
rm -rf node_modules/.vite
rm -rf dist

# Restart
npm run dev
```

## Authentication & Authorization

### Permission System

Permissions follow a `resource:action` format:
- `users.view` - View users list
- `users.create` - Create new users
- `roles.edit` - Edit role information
- `settings.view` - View settings

### Using Permissions in React

```typescript
import { useAuth } from "@/contexts/AuthContext";

function MyComponent() {
  const { hasPermission } = useAuth();

  if (hasPermission("users", "edit")) {
    // Show edit button
  }

  return (
    <div>
      {hasPermission("settings", "view") && (
        <SettingsLink />
      )}
    </div>
  );
}
```

### Protected Routes

Routes can be protected by permissions:

```typescript
{hasPermission("users", "view") && (
  <Route path="/admin/users" element={<AdminUsers />} />
)}
```

## API Routes

### Authentication
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Authenticate and receive JWT
- `POST /api/auth/logout` - Clear session
- `GET /api/auth/me` - Get current user with permissions

### Admin (Requires Authentication)
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/roles` - List all roles
- `POST /api/admin/roles` - Create role
- `PUT /api/admin/roles/:id` - Update role
- `DELETE /api/admin/roles/:id` - Delete role
- `GET /api/admin/permissions` - List all permissions
- `GET /api/admin/roles/:id/permissions` - Get role permissions
- `POST /api/admin/roles/:roleId/permissions` - Assign permission
- `DELETE /api/admin/roles/:roleId/permissions/:permissionId` - Remove permission

## Production Deployment

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Deploy to Cloudflare Workers**:
   ```bash
   npm run deploy
   ```

3. **Configure environment variables** in Cloudflare dashboard:
   - Set `JWT_SECRET` to a secure random string

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [Vite Documentation](https://vitejs.dev/guide/)
- [React Documentation](https://react.dev/)
- [Hono Documentation](https://hono.dev/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
