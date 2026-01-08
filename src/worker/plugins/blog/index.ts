// =============================================================================
// BLOG PLUGIN - BACKEND
// =============================================================================
// Full-featured blog plugin with migrations and API endpoints
// =============================================================================

import { Hono } from 'hono';
import { validator } from 'hono/validator';
import type { BackendPluginManifest } from '../../../shared/plugin/index.ts';
import type { Env } from '../../db';
import type { Tenant } from '../../middleware/tenant';
import { verifyAuth, requireAuth, requireAdmin } from '../../middleware/auth';
import { requirePlugin, getPluginLicense } from '../../middleware/tenant';

// -----------------------------------------------------------------------------
// Blog Plugin Manifest
// -----------------------------------------------------------------------------

export const manifest: BackendPluginManifest = {
  // ----- Identity -----
  id: '550e8400-e29b-41d4-a716-446655440001' as const,
  name: 'blog',
  version: '1.1.0',

  // ----- Dependencies -----
  priority: 100,

  // ----- Lifecycle Hooks -----
  async onLoad() {
    console.log('[Blog Plugin] Backend loaded');
  },

  async onEnable() {
    console.log('[Blog Plugin] Backend enabled');
  },

  async onDisable() {
    console.log('[Blog Plugin] Backend disabled');
  },

  async onUninstall() {
    console.log('[Blog Plugin] Backend uninstalled');
  },

  // ----- Database Migrations -----
  migrations: [
    {
      version: '1.0.0',
      name: 'Create blog tables',
      up: `
        -- Posts table
        CREATE TABLE IF NOT EXISTS blog_posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          content TEXT NOT NULL,
          excerpt TEXT,
          author_id INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          featured_image TEXT,
          meta_title TEXT,
          meta_description TEXT,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          published_at INTEGER
        );

        -- Categories table
        CREATE TABLE IF NOT EXISTS blog_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          parent_id INTEGER REFERENCES blog_categories(id) ON DELETE SET NULL,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );

        -- Tags table
        CREATE TABLE IF NOT EXISTS blog_tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          slug TEXT NOT NULL UNIQUE,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );

        -- Post-Category junction table
        CREATE TABLE IF NOT EXISTS blog_post_categories (
          post_id INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
          category_id INTEGER NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
          PRIMARY KEY (post_id, category_id)
        );

        -- Post-Tag junction table
        CREATE TABLE IF NOT EXISTS blog_post_tags (
          post_id INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
          tag_id INTEGER NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
          PRIMARY KEY (post_id, tag_id)
        );

        -- Create indexes for better query performance
        CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
        CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts(author_id);
        CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published_at);
        CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
      `,
      down: `
        DROP INDEX IF EXISTS idx_blog_posts_slug;
        DROP INDEX IF EXISTS idx_blog_posts_published;
        DROP INDEX IF EXISTS idx_blog_posts_author;
        DROP INDEX IF EXISTS idx_blog_posts_status;
        DROP TABLE IF EXISTS blog_post_tags;
        DROP TABLE IF EXISTS blog_post_categories;
        DROP TABLE IF EXISTS blog_tags;
        DROP TABLE IF EXISTS blog_categories;
        DROP TABLE IF EXISTS blog_posts;
      `,
    },
    {
      version: '1.1.0',
      name: 'Insert sample data',
      up: `
        -- Insert sample categories
        INSERT OR IGNORE INTO blog_categories (name, slug, description) VALUES
        ('Technology', 'technology', 'Latest tech news and insights'),
        ('Programming', 'programming', 'Coding tutorials and best practices'),
        ('Web Development', 'web-development', 'Frontend and backend development tips');

        -- Insert sample tags
        INSERT OR IGNORE INTO blog_tags (name, slug) VALUES
        ('JavaScript', 'javascript'),
        ('TypeScript', 'typescript'),
        ('React', 'react'),
        ('Cloudflare', 'cloudflare'),
        ('Tutorial', 'tutorial');

        -- Insert sample posts (assuming author_id = 1 exists)
        INSERT OR IGNORE INTO blog_posts (title, slug, content, excerpt, author_id, status, published_at) VALUES
        (
          'Getting Started with Cloudflare Workers',
          'getting-started-with-cloudflare-workers',
          'Cloudflare Workers allow you to run JavaScript at the edge, closer to your users worldwide. In this tutorial, we''ll explore the basics of building serverless applications with Workers.

You''ll learn how to:
- Set up your development environment
- Create your first Worker
- Deploy to the Cloudflare network
- Handle HTTP requests and responses

Let''s dive in and start building edge applications!',
          'Learn how to build serverless applications with Cloudflare Workers',
          1,
          'published',
          strftime('%s', 'now', '-7 days')
        ),
        (
          'TypeScript Best Practices for 2025',
          'typescript-best-practices-2025',
          'TypeScript has become the de facto standard for building large-scale JavaScript applications. Here are the best practices you should follow in 2025:

1. Use strict mode
2. Leverage type inference
3. Avoid any types
4. Use utility types
5. Implement proper error handling

These practices will help you write more maintainable and type-safe code.',
          'Modern TypeScript practices for better code quality',
          1,
          'published',
          strftime('%s', 'now', '-5 days')
        ),
        (
          'Building a Plugin System with React',
          'building-plugin-system-with-react',
          'Plugin architectures enable extensibility and modularity in your applications. In this guide, we''ll build a dynamic plugin system using React.

Key concepts covered:
- Plugin registry pattern
- Dynamic component loading
- Lifecycle management
- Communication between plugins

Let''s create a flexible plugin system that scales with your application.',
          'Create a flexible and scalable plugin architecture',
          1,
          'published',
          strftime('%s', 'now', '-3 days')
        );

        -- Link posts with categories
        INSERT OR IGNORE INTO blog_post_categories (post_id, category_id)
        SELECT p.id, c.id FROM blog_posts p
        CROSS JOIN blog_categories c
        WHERE (p.slug = 'getting-started-with-cloudflare-workers' AND c.slug = 'technology')
           OR (p.slug = 'typescript-best-practices-2025' AND c.slug = 'programming')
           OR (p.slug = 'building-plugin-system-with-react' AND c.slug = 'web-development');

        -- Link posts with tags
        INSERT OR IGNORE INTO blog_post_tags (post_id, tag_id)
        SELECT p.id, t.id FROM blog_posts p
        CROSS JOIN blog_tags t
        WHERE (p.slug = 'getting-started-with-cloudflare-workers' AND t.slug IN ('cloudflare', 'tutorial'))
           OR (p.slug = 'typescript-best-practices-2025' AND t.slug IN ('typescript', 'javascript'))
           OR (p.slug = 'building-plugin-system-with-react' AND t.slug IN ('react', 'tutorial'));
      `,
      down: `
        -- Remove sample data (in reverse order of dependencies)
        DELETE FROM blog_post_tags WHERE post_id IN (SELECT id FROM blog_posts WHERE slug IN ('getting-started-with-cloudflare-workers', 'typescript-best-practices-2025', 'building-plugin-system-with-react'));
        DELETE FROM blog_post_categories WHERE post_id IN (SELECT id FROM blog_posts WHERE slug IN ('getting-started-with-cloudflare-workers', 'typescript-best-practices-2025', 'building-plugin-system-with-react'));
        DELETE FROM blog_posts WHERE slug IN ('getting-started-with-cloudflare-workers', 'typescript-best-practices-2025', 'building-plugin-system-with-react');
        DELETE FROM blog_tags WHERE slug IN ('javascript', 'typescript', 'react', 'cloudflare', 'tutorial');
        DELETE FROM blog_categories WHERE slug IN ('technology', 'programming', 'web-development');
      `,
    },
  ],

  // ----- API Endpoints -----
  endpoints: [
    // Public user endpoints (no auth required)
    { method: 'GET', path: '/blog/posts', permission: 'public', authRequired: false },
    { method: 'GET', path: '/blog/posts/:idOrSlug', permission: 'public', authRequired: false },
    { method: 'GET', path: '/blog/categories', permission: 'public', authRequired: false },
    { method: 'GET', path: '/blog/tags', permission: 'public', authRequired: false },
    // Admin endpoints (auth + admin required)
    { method: 'GET', path: '/admin/blog/posts', permission: 'blog.posts.manage', authRequired: true },
    { method: 'GET', path: '/admin/blog/posts/:id', permission: 'blog.posts.manage', authRequired: true },
    { method: 'POST', path: '/admin/blog/posts', permission: 'blog.posts.create', authRequired: true },
    { method: 'PUT', path: '/admin/blog/posts/:id', permission: 'blog.posts.edit', authRequired: true },
    { method: 'DELETE', path: '/admin/blog/posts/:id', permission: 'blog.posts.delete', authRequired: true },
    { method: 'PATCH', path: '/admin/blog/posts/:id/publish', permission: 'blog.posts.publish', authRequired: true },
    { method: 'POST', path: '/admin/blog/categories', permission: 'blog.categories.manage', authRequired: true },
    { method: 'POST', path: '/admin/blog/tags', permission: 'blog.tags.manage', authRequired: true },
  ],
};

// -----------------------------------------------------------------------------
// Blog API Controllers
// -----------------------------------------------------------------------------

/**
 * Check if tenant has a specific blog feature based on their license
 * Features are stored as JSON array in the license.features field
 */
async function hasBlogFeature(db: any, tenantId: string, feature: string): Promise<boolean> {
  try {
    const license = await getPluginLicense(db, tenantId, 'blog');
    if (!license || license.status !== 'active') {
      return false;
    }

    // Check if license has expired
    if (license.expires_at && license.expires_at < Date.now() / 1000) {
      return false;
    }

    // Check if feature is in the licensed features array
    return license.features.includes(feature);
  } catch (error) {
    console.error('[Blog Plugin] Error checking feature:', error);
    return false;
  }
}

/**
 * Middleware to require specific blog feature
 */
function requireBlogFeature(feature: string) {
  return async (c: any, next: any) => {
    const tenant = c.get('tenant') as Tenant | null;

    if (!tenant) {
      return c.json({
        error: 'Tenant not found',
        message: 'Unable to verify license for this feature.'
      }, 404);
    }

    const hasFeature = await hasBlogFeature(c.env.DB, tenant.id, feature);

    if (!hasFeature) {
      return c.json({
        error: 'Feature not available',
        message: `The "${feature}" feature requires a higher tier blog subscription.`,
        feature
      }, 403);
    }

    await next();
  };
}

export function createBlogRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  const publicApp = new Hono<{ Bindings: Env }>();
  const adminApp = new Hono<{ Bindings: Env }>();

  // ============================================================================
  // PUBLIC USER ENDPOINTS (No auth required)
  // ============================================================================

  // Get all published posts with filtering and pagination
  publicApp.get('/posts', async (c) => {
    const db = c.env.DB;
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = (page - 1) * limit;
    const category = c.req.query('category');
    const tag = c.req.query('tag');

    let whereClause = 'WHERE p.status = ?';
    const params: any[] = ['published'];

    if (category) {
      whereClause += ' AND cat.slug = ?';
      params.push(category);
    }

    if (tag) {
      whereClause += ' AND tag.slug = ?';
      params.push(tag);
    }

    const posts = await db
      .prepare(`
        SELECT
          p.*,
          u.name as author_name,
          u.email as author_email
        FROM blog_posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN blog_post_categories pc ON p.id = pc.post_id
        LEFT JOIN blog_categories cat ON pc.category_id = cat.id
        LEFT JOIN blog_post_tags pt ON p.id = pt.post_id
        LEFT JOIN blog_tags tag ON pt.tag_id = tag.id
        ${whereClause}
        GROUP BY p.id
        ORDER BY p.published_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...params, limit, offset)
      .all();

    const countResult = await db
      .prepare(`SELECT COUNT(DISTINCT p.id) as total FROM blog_posts p
        LEFT JOIN blog_post_categories pc ON p.id = pc.post_id
        LEFT JOIN blog_categories cat ON pc.category_id = cat.id
        LEFT JOIN blog_post_tags pt ON p.id = pt.post_id
        LEFT JOIN blog_tags tag ON pt.tag_id = tag.id
        ${whereClause}`)
      .bind(...params)
      .first();

    return c.json({
      posts: posts.results || [],
      pagination: {
        page,
        limit,
        total: (countResult?.total as number) || 0,
        totalPages: Math.ceil(((countResult?.total as number) || 0) / limit),
      },
    });
  });

  // Get single post by ID or slug (public view)
  publicApp.get('/posts/:idOrSlug', async (c) => {
    const db = c.env.DB;
    const idOrSlug = c.req.param('idOrSlug');

    const post = await db
      .prepare(`
        SELECT
          p.*,
          u.name as author_name,
          u.email as author_email
        FROM blog_posts p
        LEFT JOIN users u ON p.author_id = u.id
        WHERE (p.id = ? OR p.slug = ?) AND p.status = 'published'
      `)
      .bind(idOrSlug, idOrSlug)
      .first();

    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    // Get categories
    const categories = await db
      .prepare(`
        SELECT c.* FROM blog_categories c
        JOIN blog_post_categories pc ON c.id = pc.category_id
        WHERE pc.post_id = ?
      `)
      .bind(post.id)
      .all();

    // Get tags
    const tags = await db
      .prepare(`
        SELECT t.* FROM blog_tags t
        JOIN blog_post_tags pt ON t.id = pt.tag_id
        WHERE pt.post_id = ?
      `)
      .bind(post.id)
      .all();

    return c.json({
      ...post,
      categories: categories.results || [],
      tags: tags.results || [],
    });
  });

  // Get all categories (public)
  publicApp.get('/categories', async (c) => {
    const db = c.env.DB;

    const categories = await db
      .prepare(`
        SELECT
          c.*,
          COUNT(DISTINCT pc.post_id) as post_count,
          p.name as parent_name
        FROM blog_categories c
        LEFT JOIN blog_post_categories pc ON c.id = pc.category_id
        LEFT JOIN blog_categories p ON c.parent_id = p.id
        GROUP BY c.id
        ORDER BY c.name
      `)
      .all();

    return c.json({ categories: categories.results || [] });
  });

  // Get all tags (public)
  publicApp.get('/tags', async (c) => {
    const db = c.env.DB;

    const tags = await db
      .prepare(`
        SELECT
          t.*,
          COUNT(DISTINCT pt.post_id) as post_count
        FROM blog_tags t
        LEFT JOIN blog_post_tags pt ON t.id = pt.tag_id
        GROUP BY t.id
        ORDER BY t.name
      `)
      .all();

    return c.json({ tags: tags.results || [] });
  });

  // ============================================================================
  // ADMIN ENDPOINTS (Auth + Admin required + Blog License)
  // ============================================================================

  // Apply auth and license middleware to all admin routes
  // This ensures the tenant has an active blog plugin license
  adminApp.use('*', verifyAuth, requireAuth, requireAdmin, requirePlugin('blog'));

  // ============================================================================
  // ADMIN POSTS API
  // ============================================================================

  // Get all posts (including drafts) for admin
  adminApp.get('/posts', async (c) => {
    const db = c.env.DB;
    const status = c.req.query('status');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params: any[] = [];

    if (status) {
      whereClause = 'WHERE p.status = ?';
      params.push(status);
    }

    const posts = await db
      .prepare(`
        SELECT
          p.*,
          u.name as author_name,
          u.email as author_email,
          GROUP_CONCAT(DISTINCT cat.name) as categories,
          GROUP_CONCAT(DISTINCT tag.name) as tags
        FROM blog_posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN blog_post_categories pc ON p.id = pc.post_id
        LEFT JOIN blog_categories cat ON pc.category_id = cat.id
        LEFT JOIN blog_post_tags pt ON p.id = pt.post_id
        LEFT JOIN blog_tags tag ON pt.tag_id = tag.id
        ${whereClause}
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...params, limit, offset)
      .all();

    const countResult = await db
      .prepare(`SELECT COUNT(*) as total FROM blog_posts p ${whereClause}`)
      .bind(...params)
      .first();

    return c.json({
      posts: posts.results || [],
      pagination: {
        page,
        limit,
        total: (countResult?.total as number) || 0,
        totalPages: Math.ceil(((countResult?.total as number) || 0) / limit),
      },
    });
  });

  // Get single post by ID for admin (including drafts)
  adminApp.get('/posts/:id', async (c) => {
    const db = c.env.DB;
    const postId = c.req.param('id');

    const post = await db
      .prepare(`
        SELECT
          p.*,
          u.name as author_name,
          u.email as author_email
        FROM blog_posts p
        LEFT JOIN users u ON p.author_id = u.id
        WHERE p.id = ?
      `)
      .bind(postId)
      .first();

    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }

    // Get categories
    const categories = await db
      .prepare(`
        SELECT c.* FROM blog_categories c
        JOIN blog_post_categories pc ON c.id = pc.category_id
        WHERE pc.post_id = ?
      `)
      .bind(post.id)
      .all();

    // Get tags
    const tags = await db
      .prepare(`
        SELECT t.* FROM blog_tags t
        JOIN blog_post_tags pt ON t.id = pt.tag_id
        WHERE pt.post_id = ?
      `)
      .bind(post.id)
      .all();

    return c.json({
      ...post,
      categories: categories.results || [],
      tags: tags.results || [],
    });
  });

  // Create new post
  adminApp.post(
    '/posts',
    validator('json', (value, c) => {
      if (!value.title || !value.content) {
        return c.json({ error: 'Title and content are required' }, 400);
      }
      return value;
    }),
    async (c) => {
      const db = c.env.DB;
      const data = await c.req.json();
      const user = (c as any).get('user');

      // Get author ID from authenticated user
      const authorId = user?.id || 1;

      // Generate slug from title
      const slug = data.slug || generateSlug(data.title);

      // Check if slug exists
      const existing = await db
        .prepare('SELECT id FROM blog_posts WHERE slug = ?')
        .bind(slug)
        .first();

      if (existing) {
        return c.json({ error: 'A post with this slug already exists' }, 400);
      }

      const result = await db
        .prepare(`
          INSERT INTO blog_posts (title, slug, content, excerpt, author_id, status,
            featured_image, meta_title, meta_description, published_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          data.title,
          slug,
          data.content,
          data.excerpt || null,
          authorId,
          data.status || 'draft',
          data.featured_image || null,
          data.meta_title || null,
          data.meta_description || null,
          data.status === 'published' ? Date.now() / 1000 : null
        )
        .run();

      if (!result.success) {
        return c.json({ error: 'Failed to create post' }, 500);
      }

      // Link categories if provided
      if (data.category_ids && Array.isArray(data.category_ids)) {
        for (const categoryId of data.category_ids) {
          await db
            .prepare('INSERT OR IGNORE INTO blog_post_categories (post_id, category_id) VALUES (?, ?)')
            .bind(result.meta.last_row_id, categoryId)
            .run();
        }
      }

      // Link tags if provided
      if (data.tag_ids && Array.isArray(data.tag_ids)) {
        for (const tagId of data.tag_ids) {
          await db
            .prepare('INSERT OR IGNORE INTO blog_post_tags (post_id, tag_id) VALUES (?, ?)')
            .bind(result.meta.last_row_id, tagId)
            .run();
        }
      }

      const newPost = await db
        .prepare('SELECT * FROM blog_posts WHERE id = ?')
        .bind(result.meta.last_row_id)
        .first();

      return c.json(newPost, 201);
    }
  );

  // Update post
  adminApp.put('/posts/:id', async (c) => {
    const db = c.env.DB;
    const postId = c.req.param('id');
    const data = await c.req.json();

    // Check if post exists
    const existing = await db
      .prepare('SELECT * FROM blog_posts WHERE id = ?')
      .bind(postId)
      .first();

    if (!existing) {
      return c.json({ error: 'Post not found' }, 404);
    }

    // Generate new slug if title changed
    let slug = existing.slug;
    if (data.title && data.title !== existing.title) {
      slug = data.slug || generateSlug(data.title);

      // Check if new slug exists
      const slugExists = await db
        .prepare('SELECT id FROM blog_posts WHERE slug = ? AND id != ?')
        .bind(slug, postId)
        .first();

      if (slugExists) {
        return c.json({ error: 'A post with this slug already exists' }, 400);
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    if (data.slug !== undefined) {
      updates.push('slug = ?');
      values.push(data.slug);
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      values.push(data.content);
    }
    if (data.excerpt !== undefined) {
      updates.push('excerpt = ?');
      values.push(data.excerpt);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
      if (data.status === 'published' && !existing.published_at) {
        updates.push('published_at = ?');
        values.push(Date.now() / 1000);
      }
    }
    if (data.featured_image !== undefined) {
      updates.push('featured_image = ?');
      values.push(data.featured_image);
    }
    if (data.meta_title !== undefined) {
      updates.push('meta_title = ?');
      values.push(data.meta_title);
    }
    if (data.meta_description !== undefined) {
      updates.push('meta_description = ?');
      values.push(data.meta_description);
    }

    updates.push('updated_at = ?');
    values.push(Date.now() / 1000);
    values.push(postId);

    await db
      .prepare(`UPDATE blog_posts SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    // Update categories if provided
    if (data.category_ids !== undefined) {
      await db.prepare('DELETE FROM blog_post_categories WHERE post_id = ?').bind(postId).run();
      for (const categoryId of data.category_ids) {
        await db
          .prepare('INSERT OR IGNORE INTO blog_post_categories (post_id, category_id) VALUES (?, ?)')
          .bind(postId, categoryId)
          .run();
      }
    }

    // Update tags if provided
    if (data.tag_ids !== undefined) {
      await db.prepare('DELETE FROM blog_post_tags WHERE post_id = ?').bind(postId).run();
      for (const tagId of data.tag_ids) {
        await db
          .prepare('INSERT OR IGNORE INTO blog_post_tags (post_id, tag_id) VALUES (?, ?)')
          .bind(postId, tagId)
          .run();
      }
    }

    const updatedPost = await db
      .prepare('SELECT * FROM blog_posts WHERE id = ?')
      .bind(postId)
      .first();

    return c.json(updatedPost);
  });

  // Delete post (requires posts.delete feature)
  adminApp.delete('/posts/:id', requireBlogFeature('posts.delete'), async (c) => {
    const db = c.env.DB;
    const postId = c.req.param('id');

    const result = await db.prepare('DELETE FROM blog_posts WHERE id = ?').bind(postId).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Post not found' }, 404);
    }

    return c.json({ success: true, message: 'Post deleted successfully' });
  });

  // Publish post (requires posts.publish feature)
  adminApp.patch('/posts/:id/publish', requireBlogFeature('posts.publish'), async (c) => {
    const db = c.env.DB;
    const postId = c.req.param('id');

    const result = await db
      .prepare(`
        UPDATE blog_posts
        SET status = 'published', published_at = strftime('%s', 'now'), updated_at = strftime('%s', 'now')
        WHERE id = ?
      `)
      .bind(postId)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Post not found' }, 404);
    }

    const post = await db.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(postId).first();

    return c.json(post);
  });

  // ============================================================================
  // ADMIN CATEGORIES API
  // ============================================================================

  // Get all categories (admin)
  adminApp.get('/categories', async (c) => {
    const db = c.env.DB;

    const categories = await db
      .prepare(`
        SELECT
          c.*,
          COUNT(DISTINCT pc.post_id) as post_count,
          p.name as parent_name
        FROM blog_categories c
        LEFT JOIN blog_post_categories pc ON c.id = pc.category_id
        LEFT JOIN blog_categories p ON c.parent_id = p.id
        GROUP BY c.id
        ORDER BY c.name
      `)
      .all();

    return c.json({ categories: categories.results || [] });
  });

  adminApp.post('/categories', requireBlogFeature('categories.manage'), async (c) => {
    const db = c.env.DB;
    const data = await c.req.json();

    if (!data.name) {
      return c.json({ error: 'Category name is required' }, 400);
    }

    const slug = data.slug || generateSlug(data.name);

    const result = await db
      .prepare('INSERT INTO blog_categories (name, slug, description, parent_id) VALUES (?, ?, ?, ?)')
      .bind(data.name, slug, data.description || null, data.parent_id || null)
      .run();

    if (!result.success) {
      return c.json({ error: 'Failed to create category' }, 500);
    }

    const category = await db
      .prepare('SELECT * FROM blog_categories WHERE id = ?')
      .bind(result.meta.last_row_id)
      .first();

    return c.json(category, 201);
  });

  // ============================================================================
  // ADMIN TAGS API
  // ============================================================================

  // Get all tags (admin)
  adminApp.get('/tags', async (c) => {
    const db = c.env.DB;

    const tags = await db
      .prepare(`
        SELECT
          t.*,
          COUNT(DISTINCT pt.post_id) as post_count
        FROM blog_tags t
        LEFT JOIN blog_post_tags pt ON t.id = pt.tag_id
        GROUP BY t.id
        ORDER BY t.name
      `)
      .all();

    return c.json({ tags: tags.results || [] });
  });

  adminApp.post('/tags', requireBlogFeature('tags.manage'), async (c) => {
    const db = c.env.DB;
    const data = await c.req.json();

    if (!data.name) {
      return c.json({ error: 'Tag name is required' }, 400);
    }

    const slug = data.slug || generateSlug(data.name);

    const result = await db
      .prepare('INSERT INTO blog_tags (name, slug) VALUES (?, ?)')
      .bind(data.name, slug)
      .run();

    if (!result.success) {
      return c.json({ error: 'Failed to create tag' }, 500);
    }

    const tag = await db
      .prepare('SELECT * FROM blog_tags WHERE id = ?')
      .bind(result.meta.last_row_id)
      .first();

    return c.json(tag, 201);
  });

  // Mount public and admin routes
  app.route('/blog', publicApp);
  app.route('/admin/blog', adminApp);

  return app;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default manifest;
