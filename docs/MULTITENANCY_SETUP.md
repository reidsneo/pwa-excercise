# Multi-Tenancy Setup Guide

This guide explains how to configure and deploy the multi-tenant SaaS application with wildcard subdomain support.

## Architecture Overview

```
DNS Wildcard (*.yourdomain.com)
   ↓
Single Cloudflare Worker
   ↓
Host Header Resolution
   ↓
Tenant Detection (by subdomain/custom domain)
   ↓
Tenant-Aware Plugins & Data
```

## DNS Configuration

### Production (Cloudflare)

1. **Add DNS Record for Wildcard Subdomains**

   In your Cloudflare DNS settings for your domain:

   ```
   Type: CNAME
   Name: *.yourdomain.com
   Target: your-worker.your-subdomain.workers.dev
   Proxy: Yes (orange cloud)
   TTL: Auto
   ```

2. **Configure Custom Domains (Optional)**

   For each tenant with a custom domain:

   ```
   Type: CNAME
   Name: clientdomain.com
   Target: your-worker.your-subdomain.workers.dev
   Proxy: Yes (orange cloud)
   TTL: Auto
   ```

### Local Development

For local development with `localflare` or Miniflare:

```javascript
// wrangler.toml or local dev config
[[routes]]
pattern = "*.yourdomain.test/*"
zone_name = "yourdomain.test"
```

Or test directly with:
- `http://tenant1.yourdomain.test:8787`
- `http://tenant2.yourdomain.test:8787`

## Cloudflare Worker Configuration

### wrangler.toml

```toml
name = "your-worker"
main = "src/worker/index.ts"
compatibility_date = "2024-01-01"

# Environment variables
[env.production]
vars = [
  { BASE_DOMAIN = "yourdomain.com" },
  { JWT_SECRET = "your-production-secret" },
]

# Routes for wildcard subdomain support
[[routes]]
pattern = "*.yourdomain.com/*"
zone_name = "yourdomain.com"

[[routes]]
pattern = "yourdomain.com/*"
zone_name = "yourdomain.com"
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BASE_DOMAIN` | Base domain for subdomain extraction | `yourdomain.com` |
| `JWT_SECRET` | Secret for JWT signing | `random-secret-key` |

## Tenant Resolution Flow

### 1. Subdomain-Based Tenancy

```
Request: tenant-name.yourdomain.com/api/blog/posts
         ↓
Extract subdomain: "tenant-name"
         ↓
Lookup in DB: SELECT * FROM tenants WHERE slug = 'tenant-name'
         ↓
Get tenant_id: "abc-123-def"
         ↓
Filter all queries by tenant_id
```

### 2. Custom Domain Tenancy

```
Request: clientdomain.com/api/blog/posts
         ↓
Not base domain → custom domain lookup
         ↓
Lookup in DB: SELECT * FROM tenants WHERE custom_domain = 'clientdomain.com'
         ↓
Get tenant_id: "xyz-789-uvw"
         ↓
Filter all queries by tenant_id
```

### 3. Main Domain (No Tenant)

```
Request: yourdomain.com/api/plugins
         ↓
No subdomain → admin/marketing site
         ↓
No tenant filtering
```

## Security Best Practices

### ✅ Always Implemented

1. **Tenant ID from Database**
   - Never trust subdomain alone
   - Always verify tenant exists in DB
   - Use tenant_id from DB record, not slug

2. **JWT Contains Tenant Context**
   - JWT payload includes `tenantId`
   - Prevents cross-tenant token reuse
   - Enforces tenant boundaries

3. **Cookie Domain Configuration**
   - Set `Domain=.yourdomain.com` for wildcard
   - Allows auth across subdomains
   - HttpOnly, Secure, SameSite=Lax

### ❌ Never Do

1. ❌ Trust subdomain for authorization
2. ❌ Use tenant_id from URL parameter
3. ❌ Skip tenant validation in queries
4. ❌ Allow cross-tenant data access

## Tenant Registration Flow

When a new user signs up:

```typescript
// 1. Create tenant record
const tenantId = crypto.randomUUID();
const tenantSlug = generateSlug(user.companyName); // e.g., "acme-corp"

await db.prepare(`
  INSERT INTO tenants (id, name, slug, plan, status)
  VALUES (?, ?, ?, 'free', 'active')
`).bind(tenantId, user.companyName, tenantSlug).run();

// 2. Link user to tenant
await db.prepare(`
  INSERT INTO tenant_users (tenant_id, user_id, role)
  VALUES (?, ?, 'owner')
`).bind(tenantId, user.id).run();

// 3. User can now access: acme-corp.yourdomain.com
```

## Plugin Data Isolation

All plugin data is automatically scoped to tenants:

```sql
-- Blog posts (tenant-aware)
CREATE TABLE blog_posts (
  id INTEGER PRIMARY KEY,
  tenant_id TEXT NOT NULL,  -- 🔥 Tenant scoping
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  UNIQUE(tenant_id, slug)   -- Per-tenant unique slugs
);

-- Queries automatically filter by tenant_id
SELECT * FROM blog_posts WHERE tenant_id = ?;
```

## Testing Locally

### Using curl

```bash
# Tenant subdomain
curl http://tenant1.localhost:8787/api/blog/posts

# Custom domain
curl http://custom.local:8787/api/blog/posts

# Main domain (no tenant)
curl http://localhost:8787/api/plugins
```

### Using browser

1. Add subdomain to `/etc/hosts`:
   ```
   127.0.0.1 tenant1.localhost
   127.0.0.1 tenant2.localhost
   ```

2. Access in browser:
   - `http://tenant1.localhost:8787`
   - `http://tenant2.localhost:8787`

## Troubleshooting

### Issue: Cookies not working across subdomains

**Solution**: Ensure cookie domain is set correctly:
```typescript
createSessionCookie(token, 'yourdomain.com')
// Sets: Domain=.yourdomain.com
```

### Issue: Tenant not found

**Solution**: Verify tenant exists in DB:
```sql
SELECT * FROM tenants WHERE slug = 'tenant-name';
SELECT * FROM tenants WHERE custom_domain = 'client.com';
```

### Issue: Data leaking between tenants

**Solution**: Verify all queries include `WHERE tenant_id = ?`:
```typescript
const posts = await db
  .prepare('SELECT * FROM blog_posts WHERE tenant_id = ?')
  .bind(tenantId)
  .all();
```

## Production Checklist

- [ ] DNS wildcard record configured
- [ ] BASE_DOMAIN environment variable set
- [ ] JWT_SECRET is strong and unique
- [ ] Custom domains added to Cloudflare (if needed)
- [ ] Worker routes configured for wildcard
- [ ] Cookie domain configured correctly
- [ ] All queries filter by tenant_id
- [ ] JWT includes tenant context
- [ ] Tenant verification middleware active

## Performance Considerations

1. **Index tenant_id columns** on all tables
2. **Cache tenant lookups** by slug/domain
3. **Use CDN** for static assets
4. **Database connection pooling** (if applicable)

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Multi-tenancy Best Practices](https://github.com/anthropics/courses)
- [DNS Wildcard Configuration](https://developers.cloudflare.com/dns/)
