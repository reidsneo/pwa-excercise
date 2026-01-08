import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, User, ArrowLeft, Edit } from 'lucide-react';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  author_name: string;
  author_email: string;
  published_at: number;
  created_at: number;
  categories: Category[];
  tags: Tag[];
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface Tag {
  id: number;
  name: string;
  slug: string;
}

interface BlogPostPageProps {
  isEnabled?: boolean;
}

export function BlogPostPage({ isEnabled = true }: BlogPostPageProps) {
  // Redirect to home if plugin is disabled
  if (!isEnabled) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Blog Not Available</h2>
          <p className="text-muted-foreground">The blog plugin is not enabled.</p>
        </div>
      </div>
    );
  }

  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) return;

      try {
        const response = await fetch(`/blog/posts/${slug}`);
        if (response.ok) {
          const data: BlogPost = await response.json();
          setPost(data);
        } else if (response.status === 404) {
          setError('Post not found');
        } else {
          setError('Failed to load post');
        }
      } catch (err) {
        console.error('Failed to fetch post:', err);
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [slug]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading post...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">{error || 'Post not found'}</p>
            <Button asChild>
              <Link to="/blog">Back to Blog</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back Button */}
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link to="/blog">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Blog
        </Link>
      </Button>

      {/* Article */}
      <article>
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {formatDate(post.published_at || post.created_at)}
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {post.author_name}
            </div>
          </div>

          <h1 className="text-4xl font-bold mb-4">{post.title}</h1>

          {post.excerpt && (
            <p className="text-xl text-muted-foreground">{post.excerpt}</p>
          )}

          {/* Categories */}
          {post.categories && post.categories.length > 0 && (
            <div className="flex items-center gap-2 mt-4">
              <span className="text-sm text-muted-foreground">Categories:</span>
              {post.categories.map((category) => (
                <Badge key={category.id} variant="secondary">
                  {category.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Tags:</span>
              {post.tags.map((tag) => (
                <Badge key={tag.id} variant="outline">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </header>

        {/* Content */}
        <div className="prose prose-gray max-w-none">
          <div
            className="whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br />') }}
          />
        </div>
      </article>

      {/* Footer */}
      <footer className="mt-12 pt-8 border-t">
        <div className="flex justify-between items-center">
          <Button variant="outline" asChild>
            <Link to="/blog">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blog
            </Link>
          </Button>
        </div>
      </footer>
    </div>
  );
}
