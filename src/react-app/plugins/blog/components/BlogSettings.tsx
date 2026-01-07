// =============================================================================
// BLOG SETTINGS COMPONENT
// =============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function BlogSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Blog Settings</h3>
        <p className="text-sm text-muted-foreground">Configure your blog preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Basic blog configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="posts-per-page">Posts per page</Label>
            <Input id="posts-per-page" type="number" defaultValue={10} min={1} max={100} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow comments</Label>
              <p className="text-sm text-muted-foreground">Enable comments on blog posts</p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable RSS feed</Label>
              <p className="text-sm text-muted-foreground">Generate RSS feed for posts</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SEO Settings</CardTitle>
          <CardDescription>Search engine optimization defaults</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meta-title-template">Meta title template</Label>
            <Input
              id="meta-title-template"
              placeholder="%post_title% | %site_name%"
              defaultValue="%post_title% | Blog"
            />
            <p className="text-xs text-muted-foreground">
              Available variables: %post_title%, %site_name%, %category%
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="home-title">Home page title</Label>
            <Input id="home-title" placeholder="Blog" defaultValue="Blog" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="home-description">Home page description</Label>
            <Input
              id="home-description"
              placeholder="Latest news and updates"
              defaultValue="Latest news and updates from our blog"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
