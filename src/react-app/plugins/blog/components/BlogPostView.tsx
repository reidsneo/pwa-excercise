// =============================================================================
// BLOG POST VIEW COMPONENT
// =============================================================================

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Calendar, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: string;
  featured_image: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  author_name: string;
  author_email: string;
  categories: Category[];
  tags: Tag[];
}

interface Category {
  id: number;
  name: string;
}

interface Tag {
  id: number;
  name: string;
}

export function BlogPostView() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/plugins/blog/posts/${id}`);
      if (response.ok) {
        const data = await response.json();
        setPost(data);
      }
    } catch (error) {
      console.error('Failed to fetch post:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">Post not found</p>
            <Button onClick={() => navigate('/blog')}>Back to Posts</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/blog')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Posts
        </Button>
      </div>

      {/* Featured Image */}
      {post.featured_image && (
        <div className="mb-8 rounded-lg overflow-hidden">
          <img
            src={post.featured_image}
            alt={post.title}
            className="w-full h-auto"
          />
        </div>
      )}

      {/* Title */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>{post.author_name}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>
                  {post.published_at
                    ? new Date(Number(post.published_at) * 1000).toLocaleDateString()
                    : new Date(Number(post.created_at) * 1000).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          {hasPermission('blog', 'posts.edit') && (
            <Button onClick={() => navigate(`/blog/${post.id}/edit`)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>

        {/* Categories & Tags */}
        {(post.categories.length > 0 || post.tags.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {post.categories.map((category) => (
              <Badge key={category.id} variant="secondary">
                {category.name}
              </Badge>
            ))}
            {post.tags.map((tag) => (
              <Badge key={tag.id} variant="outline">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <Card>
        <CardContent className="pt-6">
          {post.excerpt && (
            <p className="text-lg text-muted-foreground mb-6">{post.excerpt}</p>
          )}
          <div className="prose max-w-none">
            {post.content.split('\n').map((paragraph, index) => (
              <p key={index} className="mb-4">
                {paragraph}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Meta Info */}
      {(post.meta_title || post.meta_description) && (
        <Card className="mt-8">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">SEO Information</h3>
            {post.meta_title && (
              <p className="text-sm mb-1">
                <span className="font-medium">Title:</span> {post.meta_title}
              </p>
            )}
            {post.meta_description && (
              <p className="text-sm">
                <span className="font-medium">Description:</span> {post.meta_description}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
