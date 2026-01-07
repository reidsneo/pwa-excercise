// =============================================================================
// BLOG PLUGIN - BACKEND
// =============================================================================
// Full-featured blog plugin with migrations and API endpoints
// =============================================================================

import { Hono } from 'hono';
import { validator } from 'hono/validator';
import type { BackendPluginManifest } from '@/shared/plugin';
import type { Env } from '../../db';

// -----------------------------------------------------------------------------
// Blog Plugin Manifest
// -----------------------------------------------------------------------------

export const manifest: BackendPluginManifest = {
  // ----- Identity -----
  id: 'blog/blog' as const,
  name: 'Blog Plugin',
  version: '1.0.0',

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
  ],

  // ----- API Endpoints -----
  endpoints: [
    { method: 'GET', path: '/posts', permission: 'blog.posts.view', authRequired: true },
    { method: 'GET', path: '/posts/:id', permission: 'blog.posts.view', authRequired: true },
    { method: 'POST', path: '/posts', permission: 'blog.posts.create', authRequired: true },
    { method: 'PUT', path: '/posts/:id', permission: 'blog.posts.edit', authRequired: true },
    { method: 'DELETE', path: '/posts/:id', permission: 'blog.posts.delete', authRequired: true },
    { method: 'PATCH', path: '/posts/:id/publish', permission: 'blog.posts.publish', authRequired: true },
    { method: 'GET', path: '/categories', permission: 'blog.posts.view', authRequired: true },
    { method: 'POST', path: '/categories', permission: 'blog.categories.manage', authRequired: true },
    { method: 'GET', path: '/tags', permission: 'blog.posts.view', authRequired: true },
    { method: 'POST', path: '/tags', permission: 'blog.tags.manage', authRequired: true },
  ],
};

// -----------------------------------------------------------------------------
// Blog API Controllers
// -----------------------------------------------------------------------------

export function createBlogRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  // ============================================================================
  // POSTS API
  // ============================================================================

  // Get all posts with filtering and pagination
  app.get('/api/plugins/blog/posts', async (c) => {
    const db = c.env.DB;
    const status = c.req.query('status') || 'published';
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = (page - 1) * limit;

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
        WHERE p.status = ?
        GROUP BY p.id
        ORDER BY p.published_at DESC, p.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(status, limit, offset)
      .all();

    const countResult = await db
      .prepare('SELECT COUNT(*) as total FROM blog_posts WHERE status = ?')
      .bind(status)
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

  // Get single post by ID or slug
  app.get('/api/plugins/blog/posts/:idOrSlug', async (c) => {
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
        WHERE p.id = ? OR p.slug = ?
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

  // Create new post
  app.post(
    '/api/plugins/blog/posts',
    validator('json', (value, c) => {
      if (!value.title || !value.content) {
        return c.json({ error: 'Title and content are required' }, 400);
      }
      return value;
    }),
    async (c) => {
      const db = c.env.DB;
      const data = await c.req.json();

      // For now, use a default user ID (should be from auth middleware in production)
      const authorId = 1; // TODO: Get from authenticated user

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
  app.put('/api/plugins/blog/posts/:id', async (c) => {
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

  // Delete post
  app.delete('/api/plugins/blog/posts/:id', async (c) => {
    const db = c.env.DB;
    const postId = c.req.param('id');

    const result = await db.prepare('DELETE FROM blog_posts WHERE id = ?').bind(postId).run();

    if (result.meta.changes === 0) {
      return c.json({ error: 'Post not found' }, 404);
    }

    return c.json({ success: true, message: 'Post deleted successfully' });
  });

  // Publish post
  app.patch('/api/plugins/blog/posts/:id/publish', async (c) => {
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
  // CATEGORIES API
  // ============================================================================

  app.get('/api/plugins/blog/categories', async (c) => {
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

  app.post('/api/plugins/blog/categories', async (c) => {
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
  // TAGS API
  // ============================================================================

  app.get('/api/plugins/blog/tags', async (c) => {
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

  app.post('/api/plugins/blog/tags', async (c) => {
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
