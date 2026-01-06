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

### Using Localflare (Recommended for local development)

Localflare provides a local Cloudflare Workers environment with D1 database support:

```bash
# Start Localflare (runs on http://localhost:8787)
localflare

# In a separate terminal, start Vite dev server
npm run dev
```

The application will be available at [http://localhost:8787](http://localhost:8787).

### Using Vite dev server only

For frontend-only development without Workers backend:

```bash
npm run dev
```

The application will be available at [http://localhost:5173](http://localhost:5173).

**Note**: API routes won't work without the Workers backend.

### Available Scripts

```bash
npm run dev          # Start Vite development server
npm run build        # Build for production
npm run preview      # Preview production build locally
npm run deploy       # Deploy to Cloudflare Workers
npm run cf-typegen   # Generate TypeScript types for Cloudflare Workers
npm run lint         # Lint code with ESLint
```

### Monitoring Worker Logs

For production deployments, monitor your worker logs:

```bash
npx wrangler tail
```

## Database Schema

The application uses 5 main tables:

- **users** - User accounts (email, password hash, name, role_id)
- **roles** - Role definitions (admin, user, moderator)
- **permissions** - Granular permissions (resource:action format)
- **role_permissions** - Junction table for role-permission relationships
- **sessions** - User sessions for JWT management

### Default Seed Data

On first run, the database auto-initializes with:
- **3 roles**: admin (all permissions), user (basic access), moderator
- **16 permissions**: users.*, roles.*, content.*, settings.*, analytics.*
- Admin role assigned all permissions

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
