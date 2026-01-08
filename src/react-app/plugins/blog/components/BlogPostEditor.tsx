// =============================================================================
// BLOG POST EDITOR COMPONENT
// =============================================================================

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, ArrowLeft, Eye, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePluginLicenses } from '@/contexts/PluginLicenseContext';

interface BlogPost {
  id?: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: string;
  featured_image: string | null;
  meta_title: string | null;
  meta_description: string | null;
  category_ids: number[];
  tag_ids: number[];
}

interface Category {
  id: number;
  name: string;
}

interface Tag {
  id: number;
  name: string;
}

export function BlogPostEditor() {
  const { hasPermission } = useAuth();
  const { hasPluginLicense, hasPluginFeature } = usePluginLicenses();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [post, setPost] = useState<BlogPost>({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    status: 'draft',
    featured_image: '',
    meta_title: '',
    meta_description: '',
    category_ids: [],
    tag_ids: [],
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    fetchCategories();
    fetchTags();
    if (isEditing) {
      fetchPost();
    }
  }, [id]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/plugins/blog/posts/${id}`);
      if (response.ok) {
        const data = await response.json();
        setPost({
          ...data,
          category_ids: data.categories?.map((c: Category) => c.id) || [],
          tag_ids: data.tags?.map((t: Tag) => t.id) || [],
        });
      }
    } catch (error) {
      console.error('Failed to fetch post:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/plugins/blog/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/plugins/blog/tags');
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags);
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleSubmit = async (publish = false) => {
    if (!hasPluginLicense('blog')) {
      alert('Blog plugin license required');
      return;
    }

    if (publish && !hasPluginFeature('blog', 'posts.publish')) {
      alert('Publishing posts requires a higher tier blog subscription');
      return;
    }

    if (!hasPermission('blog', 'posts.create') && !hasPermission('blog', 'posts.edit')) {
      alert('You do not have permission to save posts');
      return;
    }

    setSaving(true);
    try {
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing ? `/api/plugins/blog/posts/${id}` : '/api/plugins/blog/posts';

      const payload = {
        ...post,
        status: publish ? 'published' : post.status,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/blog/${data.id}`);
      } else if (response.status === 403) {
        const error = await response.json();
        alert(error.error || error.message || 'Failed to save post');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save post');
      }
    } catch (error) {
      console.error('Failed to save post:', error);
      alert('Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  const handleTitleChange = (value: string) => {
    setPost((prev) => ({
      ...prev,
      title: value,
      slug: prev.slug || generateSlug(value),
    }));
  };

  const toggleCategory = (categoryId: number) => {
    setPost((prev) => ({
      ...prev,
      category_ids: prev.category_ids.includes(categoryId)
        ? prev.category_ids.filter((id) => id !== categoryId)
        : [...prev.category_ids, categoryId],
    }));
  };

  const toggleTag = (tagId: number) => {
    setPost((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter((id) => id !== tagId)
        : [...prev.tag_ids, tagId],
    }));
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/blog')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{isEditing ? 'Edit Post' : 'New Post'}</h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Edit your blog post' : 'Create a new blog post'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/blog/${id}`)}
            disabled={!isEditing}
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={saving}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Draft
          </Button>
          {hasPluginLicense('blog') && hasPluginFeature('blog', 'posts.publish') && hasPermission('blog', 'posts.publish') ? (
            <Button onClick={() => handleSubmit(true)} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              Publish
            </Button>
          ) : hasPluginLicense('blog') && !hasPluginFeature('blog', 'posts.publish') ? (
            <Button variant="outline" disabled title="Publishing requires a higher tier">
              <Lock className="w-4 h-4 mr-2" />
              Publish
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
              <CardDescription>Write your blog post content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Enter post title..."
                  value={post.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  placeholder="post-url-slug"
                  value={post.slug}
                  onChange={(e) => setPost((prev) => ({ ...prev, slug: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  placeholder="Brief summary of the post..."
                  value={post.excerpt || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPost((prev) => ({ ...prev, excerpt: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="Write your post content here..."
                  value={post.content}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPost((prev) => ({ ...prev, content: e.target.value }))}
                  rows={20}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Publish</CardTitle>
              <CardDescription>Post status and visibility</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  value={post.status}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPost((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="featured">Featured Image URL</Label>
                <Input
                  id="featured"
                  placeholder="https://example.com/image.jpg"
                  value={post.featured_image || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPost((prev) => ({ ...prev, featured_image: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
              <CardDescription>Select categories</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories.map((category) => (
                <label key={category.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={post.category_ids.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                    className="rounded"
                  />
                  <span>{category.name}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>Select tags</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={post.tag_ids.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                    className="rounded"
                  />
                  <span>{tag.name}</span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO</CardTitle>
              <CardDescription>Meta tags for search engines</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meta-title">Meta Title</Label>
                <Input
                  id="meta-title"
                  placeholder="SEO title"
                  value={post.meta_title || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPost((prev) => ({ ...prev, meta_title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta-desc">Meta Description</Label>
                <Textarea
                  id="meta-desc"
                  placeholder="SEO description"
                  value={post.meta_description || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPost((prev) => ({ ...prev, meta_description: e.target.value }))}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
