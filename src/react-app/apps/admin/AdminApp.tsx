import { Routes, Route, Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutDashboard, Users, Shield, Settings, BarChart, LogOut, Puzzle, FileText } from "lucide-react";
import { AdminUsers } from "@/pages/admin/AdminUsersPage";
import { AdminRoles } from "@/pages/admin/AdminRolesPage";
import { AdminPlugins } from "@/pages/admin/AdminPluginsPage";
import { AdminBlogListPage, AdminBlogEditPage } from "@/pages/admin/blog";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import type { PluginState } from "@/shared/plugin";
import { PluginStatus } from "@/shared/plugin";

interface MenuItem {
	path: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	permission: { resource: string; action: string };
	pluginId?: string; // Optional: only show if this plugin is enabled
}

interface BackendPluginState {
	plugins: Array<{ id: string; name: string; version: string }>;
	states: PluginState[];
}

export function AdminApp() {
	const { hasPermission, user, tenant } = useAuth();
	const [pluginStates, setPluginStates] = useState<PluginState[]>([]);

	// Fetch plugin states to check which plugins are enabled
	useEffect(() => {
		const fetchPluginStates = async () => {
			try {
				const response = await fetch('/api/plugins');
				if (response.ok) {
					const data: BackendPluginState = await response.json();
					setPluginStates(data.states || []);
				}
			} catch (error) {
				console.error('Failed to fetch plugin states:', error);
			}
		};

		fetchPluginStates();
	}, []);

	// Check if blog plugin is enabled
	const blogPlugin = pluginStates.find(
		(state) => state.id === '550e8400-e29b-41d4-a716-446655440001' && state.status === PluginStatus.ENABLED
	);
	const isBlogEnabled = !!blogPlugin;

	// Helper function to check if user has permission OR is admin
	const canAccess = (resource: string, action: string) => {
		return hasPermission(resource, action) || user?.roleId === 1;
	};

	// Check if a plugin-dependent menu item should be shown
	const canAccessPlugin = (resource: string, action: string, pluginId?: string) => {
		if (pluginId === '550e8400-e29b-41d4-a716-446655440001') {
			return isBlogEnabled && (hasPermission(resource, action) || user?.roleId === 1);
		}
		return hasPermission(resource, action) || user?.roleId === 1;
	};

	const menuItems: MenuItem[] = [
		{
			path: "/admin/blog",
			label: "Blog",
			icon: FileText,
			permission: { resource: "blog", action: "manage" },
			pluginId: '550e8400-e29b-41d4-a716-446655440001',
		},
		{
			path: "/admin/users",
			label: "Users",
			icon: Users,
			permission: { resource: "users", action: "view" },
		},
		{
			path: "/admin/roles",
			label: "Roles",
			icon: Shield,
			permission: { resource: "roles", action: "view" },
		},
		{
			path: "/admin/plugins",
			label: "Plugins",
			icon: Puzzle,
			permission: { resource: "plugins", action: "view" },
		},
		{
			path: "/admin/analytics",
			label: "Analytics",
			icon: BarChart,
			permission: { resource: "analytics", action: "view" },
		},
		{
			path: "/admin/settings",
			label: "Settings",
			icon: Settings,
			permission: { resource: "settings", action: "view" },
		},
	];

	const filteredMenuItems = menuItems.filter((item) =>
		canAccessPlugin(item.permission.resource, item.permission.action, item.pluginId)
	);

	return (
		<div className="min-h-screen bg-background">
			<div className="flex">
				{/* Sidebar */}
				<aside className="w-64 border-r min-h-screen bg-card">
					<div className="p-6">
						<h1 className="text-2xl font-bold">Admin Panel</h1>
						<p className="text-sm text-muted-foreground mt-1">Management Dashboard</p>
					</div>
					<nav className="px-4 space-y-2">
						<Button variant="ghost" className="w-full justify-start" asChild>
							<Link to="/admin">
								<LayoutDashboard className="w-4 h-4 mr-2" />
								Dashboard
							</Link>
						</Button>
						{filteredMenuItems.map((item) => {
							const Icon = item.icon;
							return (
								<Button key={item.path} variant="ghost" className="w-full justify-start" asChild>
									<Link to={item.path}>
										<Icon className="w-4 h-4 mr-2" />
										{item.label}
									</Link>
								</Button>
							);
						})}
						<Button variant="ghost" className="w-full justify-start" asChild>
							<Link to="/">
								<LogOut className="w-4 h-4 mr-2" />
								Exit Admin
							</Link>
						</Button>
					</nav>
				</aside>

				{/* Main Content */}
				<div className="flex-1">
					<header className="border-b">
						<div className="px-8 py-4 flex items-center justify-between">
							<div>
								<h2 className="text-lg font-semibold">Admin Dashboard</h2>
								{tenant && (
									<p className="text-sm text-muted-foreground">
										Workspace: <span className="font-medium text-primary">{tenant.name}</span>
									</p>
								)}
							</div>
							<div className="flex items-center gap-4">
								{user && (
									<div className="text-sm text-right">
										<p className="font-medium">{user.name}</p>
										<p className="text-muted-foreground">{user.email}</p>
									</div>
								)}
								<Button variant="outline" size="sm">
									<Settings className="w-4 h-4 mr-2" />
									Profile
								</Button>
							</div>
						</div>
					</header>

					<main className="p-8">
						<Routes>
							<Route path="/" element={<AdminDashboard />} />
							{isBlogEnabled && canAccess("blog", "manage") && (
								<>
									<Route path="/blog" element={<AdminBlogListPage />} />
									<Route path="/blog/new" element={<AdminBlogEditPage />} />
									<Route path="/blog/:id" element={<AdminBlogEditPage />} />
								</>
							)}
							{canAccess("users", "view") && (
								<Route path="/users" element={<AdminUsers />} />
							)}
							{canAccess("roles", "view") && (
								<Route path="/roles" element={<AdminRoles />} />
							)}
							{canAccess("plugins", "view") && (
								<Route path="/plugins" element={<AdminPlugins />} />
							)}
							{canAccess("analytics", "view") && (
								<Route path="/analytics" element={<AdminAnalytics />} />
							)}
							{canAccess("settings", "view") && (
								<Route path="/settings" element={<AdminSettings />} />
							)}
							<Route path="*" element={<Navigate to="/admin" replace />} />
						</Routes>
					</main>
				</div>
			</div>
		</div>
	);
}

function AdminDashboard() {
	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-3xl font-bold">Dashboard Overview</h2>
				<p className="text-muted-foreground">Welcome to your admin dashboard</p>
			</div>

			<div className="grid md:grid-cols-4 gap-6">
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">Total Users</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">1,234</div>
						<p className="text-xs text-muted-foreground mt-1">+12% from last month</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">89</div>
						<p className="text-xs text-muted-foreground mt-1">Currently online</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">Revenue</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">$45.2K</div>
						<p className="text-xs text-muted-foreground mt-1">+23% from last month</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">3.2%</div>
						<p className="text-xs text-muted-foreground mt-1">+0.5% from last month</p>
					</CardContent>
				</Card>
			</div>

			<div className="grid md:grid-cols-2 gap-6">
				<Card>
					<CardHeader>
						<CardTitle>Recent Activity</CardTitle>
						<CardDescription>Latest user actions</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">New user registration</p>
									<p className="text-sm text-muted-foreground">john@example.com</p>
								</div>
								<span className="text-sm text-muted-foreground">2 min ago</span>
							</div>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">Order placed</p>
									<p className="text-sm text-muted-foreground">Order #12345</p>
								</div>
								<span className="text-sm text-muted-foreground">15 min ago</span>
							</div>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">Payment received</p>
									<p className="text-sm text-muted-foreground">$299.00</p>
								</div>
								<span className="text-sm text-muted-foreground">1 hour ago</span>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
						<CardDescription>Common admin tasks</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2">
						<Button variant="outline" className="w-full justify-start">
							Add New User
						</Button>
						<Button variant="outline" className="w-full justify-start">
							Send Newsletter
						</Button>
						<Button variant="outline" className="w-full justify-start">
							Generate Report
						</Button>
						<Button variant="outline" className="w-full justify-start">
							View System Logs
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function AdminAnalytics() {
	return (
		<div className="space-y-6">
			<h2 className="text-3xl font-bold">Analytics</h2>
			<Card>
				<CardContent className="pt-6">
					<p className="text-muted-foreground">Analytics dashboard and charts will be displayed here.</p>
				</CardContent>
			</Card>
		</div>
	);
}

function AdminSettings() {
	return (
		<div className="space-y-6">
			<h2 className="text-3xl font-bold">Settings</h2>
			<Card>
				<CardHeader>
					<CardTitle>General Settings</CardTitle>
					<CardDescription>Manage your application settings</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground">Configuration options will be displayed here.</p>
				</CardContent>
			</Card>
		</div>
	);
}
