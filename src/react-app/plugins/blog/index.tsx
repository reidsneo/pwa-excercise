// =============================================================================
// BLOG PLUGIN - FRONTEND
// =============================================================================
// Full-featured blog UI with posts management
// =============================================================================

import type { PluginManifest } from '@/shared/plugin';
import { BlogPostsList } from './components/BlogPostsList';
import { BlogPostEditor } from './components/BlogPostEditor';
import { BlogPostView } from './components/BlogPostView';
import { BlogSettings } from './components/BlogSettings';

// -----------------------------------------------------------------------------
// Plugin Manifest
// -----------------------------------------------------------------------------

export const manifest: PluginManifest = {
  // ----- Identity -----
  id: 'blog/blog' as const,
  name: 'Blog',
  description: 'Full-featured blog with posts, categories, and tags',
  version: '1.0.0',
  author: 'System',

  // ----- Lifecycle -----
  priority: 100,

  onLoad() {
    console.log('[Blog Plugin] Frontend loaded');
  },

  onEnable() {
    console.log('[Blog Plugin] Frontend enabled');
  },

  onDisable() {
    console.log('[Blog Plugin] Frontend disabled');
  },

  onUninstall() {
    console.log('[Blog Plugin] Frontend uninstalled');
    // Clear any cached data
    localStorage.removeItem('blog_posts_cache');
    localStorage.removeItem('blog_categories_cache');
    localStorage.removeItem('blog_tags_cache');
  },

  // ----- Routes -----
  routes: [
    {
      path: '/blog',
      component: BlogPostsList,
      lazy: false,
    },
    {
      path: '/blog/new',
      component: BlogPostEditor,
      lazy: false,
    },
    {
      path: '/blog/:id',
      component: BlogPostView,
      lazy: false,
    },
    {
      path: '/blog/:id/edit',
      component: BlogPostEditor,
      lazy: false,
    },
  ],

  // ----- Navigation -----
  navigation: [
    {
      label: 'Blog',
      path: '/blog',
      order: 10,
    },
  ],

  adminNavigation: [
    {
      label: 'Blog',
      path: '/admin/blog',
      order: 20,
    },
  ],

  // ----- Settings -----
  settings: {
    component: BlogSettings,
    label: 'Blog',
    order: 10,
  },

  // ----- Permissions -----
  permissions: [
    {
      id: 'blog.posts.view',
      name: 'View Posts',
      description: 'Allow viewing blog posts',
      category: 'Blog',
    },
    {
      id: 'blog.posts.create',
      name: 'Create Posts',
      description: 'Allow creating new blog posts',
      category: 'Blog',
    },
    {
      id: 'blog.posts.edit',
      name: 'Edit Posts',
      description: 'Allow editing blog posts',
      category: 'Blog',
    },
    {
      id: 'blog.posts.delete',
      name: 'Delete Posts',
      description: 'Allow deleting blog posts',
      category: 'Blog',
    },
    {
      id: 'blog.posts.publish',
      name: 'Publish Posts',
      description: 'Allow publishing blog posts',
      category: 'Blog',
    },
    {
      id: 'blog.categories.manage',
      name: 'Manage Categories',
      description: 'Allow managing blog categories',
      category: 'Blog',
    },
    {
      id: 'blog.tags.manage',
      name: 'Manage Tags',
      description: 'Allow managing blog tags',
      category: 'Blog',
    },
    {
      id: 'blog.settings.manage',
      name: 'Manage Settings',
      description: 'Allow managing blog settings',
      category: 'Blog',
    },
  ],
};

export default manifest;
