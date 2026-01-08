// =============================================================================
// BLOG POSTS LIST COMPONENT
// =============================================================================

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash2, Eye, FileText, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePluginLicenses } from '@/contexts/PluginLicenseContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  author_name: string;
}

export function BlogPostsList() {
  const { hasPermission } = useAuth();
  const { hasPluginLicense, hasPluginFeature } = usePluginLicenses();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null);

  useEffect(() => {
    fetchPosts();
  }, [page, statusFilter]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const status = statusFilter === 'all' ? '' : `&status=${statusFilter}`;
      const response = await fetch(`/api/plugins/blog/posts?page=${page}&limit=10${status}`);
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const post = posts.find((p) => p.id === id);
    if (post) {
      setPostToDelete(post);
      setShowDeleteDialog(true);
    }
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;

    try {
      const response = await fetch(`/api/plugins/blog/posts/${postToDelete.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchPosts();
        setShowDeleteDialog(false);
        setPostToDelete(null);
      } else if (response.status === 403) {
        const error = await response.json();
        alert(error.error || 'You do not have access to this feature');
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
    }
  };

  const filteredPosts = posts.filter(
    (post) =>
      post.title.toLowerCase().includes(search.toLowerCase()) ||
      post.excerpt?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-500/10 text-green-700';
      case 'draft':
        return 'bg-gray-500/10 text-gray-700';
      case 'archived':
        return 'bg-yellow-500/10 text-yellow-700';
      default:
        return 'bg-gray-500/10 text-gray-700';
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Blog Posts</h1>
          <p className="text-muted-foreground">Manage your blog content</p>
        </div>
        {hasPluginLicense('blog') && hasPermission('blog', 'posts.create') && (
          <Button onClick={() => navigate('/blog/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search posts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-md"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Posts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Posts ({filteredPosts.length})</CardTitle>
          <CardDescription>All blog posts in your system</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No posts found</p>
              {hasPluginLicense('blog') && hasPermission('blog', 'posts.create') ? (
                <Button onClick={() => navigate('/blog/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create your first post
                </Button>
              ) : !hasPluginLicense('blog') ? (
                <Button variant="outline" disabled>
                  <Lock className="w-4 h-4 mr-2" />
                  Blog plugin required
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPosts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <div>
                        <Link
                          to={`/blog/${post.id}`}
                          className="font-medium hover:underline"
                        >
                          {post.title}
                        </Link>
                        {post.excerpt && (
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                            {post.excerpt}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(post.status)}>{post.status}</Badge>
                    </TableCell>
                    <TableCell>{post.author_name}</TableCell>
                    <TableCell>
                      {new Date(Number(post.created_at) * 1000).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/blog/${post.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {hasPluginLicense('blog') && hasPermission('blog', 'posts.edit') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/blog/${post.id}/edit`)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {hasPluginLicense('blog') && hasPluginFeature('blog', 'posts.delete') && hasPermission('blog', 'posts.delete') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(post.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                        {hasPluginLicense('blog') && !hasPluginFeature('blog', 'posts.delete') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled
                            title="Delete posts requires a higher tier"
                          >
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blog Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the blog post <strong>"{postToDelete?.title}"</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePost} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
