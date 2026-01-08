import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { AdminUsers } from "@/pages/admin/AdminUsersPage";
import { AdminRoles } from "@/pages/admin/AdminRolesPage";
import { AdminPlugins } from "@/pages/admin/AdminPluginsPage";
import { AdminBlogListPage, AdminBlogEditPage } from "@/pages/admin/blog";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import type { PluginState } from "@/shared/plugin";
import { PluginStatus } from "@/shared/plugin";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/components/ui/avatar";
import { LayoutDashboard, Users, Shield, Puzzle, BarChart, Settings, FileText, ChevronLeft, ChevronRight, MoreHorizontal, User, LogIn, LogOut, Menu, ChevronsUpDown, Command, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface MenuItem {
	path: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	permission: { resource: string; action: string };
	pluginId?: string;
	badge?: string | number;
}

interface BackendPluginState {
	plugins: Array<{ id: string; name: string; version: string }>;
	states: PluginState[];
}

export function AdminApp() {
	const { hasPermission, user, tenant, logout } = useAuth();
	const [pluginStates, setPluginStates] = useState<PluginState[]>([]);
	const location = useLocation();
	const navigate = useLocation();
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);

	// Reset selected index when search query changes
	useEffect(() => {
		setSelectedIndex(0);
	}, [searchQuery]);

	// Handle keyboard shortcut for search (Cmd+K or Ctrl+K)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setSearchOpen(true);
				setSearchQuery("");
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Fetch plugin states
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

	const canAccess = (resource: string, action: string) => {
		return hasPermission(resource, action) || user?.roleId === 1;
	};

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

	// Get filtered search results
	const searchResults = searchQuery
		? filteredMenuItems.filter((item) =>
				item.label.toLowerCase().includes(searchQuery.toLowerCase())
			)
		: [];

	// Handle keyboard navigation within search dialog
	useEffect(() => {
		if (!searchOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setSelectedIndex((prev) =>
					prev < searchResults.length - 1 ? prev + 1 : prev
				);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
			} else if (e.key === "Enter" && searchResults.length > 0) {
				e.preventDefault();
				const selected = searchResults[selectedIndex];
				if (selected) {
					setSearchOpen(false);
					setSearchQuery("");
					// Use window.location to navigate
					window.location.href = selected.path;
				}
			} else if (e.key === "Escape") {
				setSearchOpen(false);
				setSearchQuery("");
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [searchOpen, searchResults, selectedIndex]);

	// Get user initials for avatar fallback
	const getUserInitials = () => {
		if (!user?.name) return 'U';
		return user.name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	};

	return (
		<SidebarProvider>
			<Sidebar variant="floating" collapsible="icon">
				<SidebarHeader>
					<SidebarMenu>
						<SidebarMenuItem>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<SidebarMenuButton size="lg" data-size="lg">
										<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
											<Command className="size-4" />
										</div>
										<div className="grid flex-1 text-start text-sm leading-tight">
											<span className="truncate font-semibold">Admin Panel</span>
											<span className="truncate text-xs">{tenant?.name || 'Admin'}</span>
										</div>
										<ChevronsUpDown className="ml-auto" />
									</SidebarMenuButton>
								</DropdownMenuTrigger>
								<DropdownMenuContent className="w-56" align="start" side="bottom">
									<DropdownMenuLabel>
										<div className="flex flex-col space-y-1">
											<p className="text-xs font-medium leading-none text-muted-foreground">
												Workspace
											</p>
											<p className="text-sm font-semibold truncate">{tenant?.name || 'Default Workspace'}</p>
										</div>
									</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuItem asChild>
										<Link to="/admin/settings" className="cursor-pointer">
											<Settings className="mr-2 h-4 w-4" />
											Workspace Settings
										</Link>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>

				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupLabel>Platform</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton asChild isActive={location.pathname === '/admin'}>
										<Link to="/admin">
											<LayoutDashboard />
											<span>Dashboard</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>

					<SidebarGroup>
						<SidebarGroupLabel>Management</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{filteredMenuItems.map((item) => {
									const Icon = item.icon;
									return (
										<SidebarMenuItem key={item.path}>
											<SidebarMenuButton asChild isActive={location.pathname === item.path}>
												<Link to={item.path}>
													<Icon />
													<span>{item.label}</span>
												</Link>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>

				<SidebarFooter>
					<SidebarMenu>
						<SidebarMenuItem>
							{user ? (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<SidebarMenuButton size="lg">
											<Avatar className="h-8 w-8 rounded-lg">
												<AvatarImage src="" alt={user.name} />
												<AvatarFallback className="rounded-lg">{getUserInitials()}</AvatarFallback>
											</Avatar>
											<div className="grid flex-1 text-start text-sm leading-tight">
												<span className="truncate font-semibold">{user.name}</span>
												<span className="truncate text-xs">{user.email}</span>
											</div>
										</SidebarMenuButton>
									</DropdownMenuTrigger>
									<DropdownMenuContent className="w-56" align="end" side="right">
										<DropdownMenuLabel>
											<div className="flex flex-col space-y-1">
												<p className="text-xs font-medium leading-none text-muted-foreground">
													Signed in as
												</p>
												<p className="text-sm font-semibold truncate">{user.name}</p>
												<p className="text-xs text-muted-foreground truncate">{user.email}</p>
											</div>
										</DropdownMenuLabel>
										<DropdownMenuSeparator />
										<DropdownMenuItem asChild>
											<Link to="/admin/profile" className="cursor-pointer">
												<User className="mr-2 h-4 w-4" />
												Profile
											</Link>
										</DropdownMenuItem>
										<DropdownMenuItem asChild>
											<Link to="/admin/settings" className="cursor-pointer">
												<Settings className="mr-2 h-4 w-4" />
												Settings
											</Link>
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											className="cursor-pointer text-destructive focus:text-destructive"
											onClick={() => logout()}
										>
											<LogOut className="mr-2 h-4 w-4" />
											Logout
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							) : (
								<SidebarMenuButton size="lg" asChild>
									<Link to="/login">
										<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
											<LogIn className="size-4" />
										</div>
										<div className="grid flex-1 text-start text-sm leading-tight">
											<span className="truncate font-semibold">Sign In</span>
											<span className="truncate text-xs">to access admin</span>
										</div>
									</Link>
								</SidebarMenuButton>
							)}
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>

			<SidebarInset>
				<header className="z-50 h-16 shadow-none">
					<div className="relative flex h-full items-center gap-3 p-4 sm:gap-4">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="h-6" />

						{/* Mobile menu button */}
						<div className="lg:hidden">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="icon" className="size-9 md:size-7">
										<Menu />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start">
									{filteredMenuItems.map((item) => {
										const Icon = item.icon;
										return (
											<DropdownMenuItem key={item.path} asChild>
												<Link to={item.path} className="cursor-pointer">
													<Icon className="mr-2 h-4 w-4" />
													{item.label}
												</Link>
											</DropdownMenuItem>
										);
									})}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>

						{/* Desktop navigation - hidden, show only on mobile */}
						<nav className="hidden items-center space-x-4 lg:flex lg:space-x-4 xl:space-x-6 max-lg:hidden">
							<Link
								to="/admin"
								className={`text-sm font-medium transition-colors hover:text-primary ${
									location.pathname === '/admin' ? '' : 'text-muted-foreground'
								}`}
							>
								Dashboard
							</Link>
							{filteredMenuItems.map((item) => (
								<Link
									key={item.path}
									to={item.path}
									className={`text-sm font-medium transition-colors hover:text-primary ${
										location.pathname === item.path ? '' : 'text-muted-foreground'
									}`}
								>
									{item.label}
								</Link>
							))}
						</nav>

						{/* Right side actions */}
						<div className="ms-auto flex items-center space-x-4">
							{/* Global search */}
							<Dialog open={searchOpen} onOpenChange={setSearchOpen}>
								<Button
									variant="outline"
									className={`relative h-8 w-full justify-start rounded-md bg-muted/25 px-4 py-2 text-sm font-normal text-muted-foreground shadow-none hover:bg-accent sm:w-40 sm:pe-12 md:flex-none lg:w-52 xl:w-64 has-[>svg]:px-3`}
									onClick={() => setSearchOpen(true)}
								>
									<Search className="absolute start-1.5 top-1/2 size-4 -translate-y-1/2" />
									<span className="ms-4">Search</span>
									<kbd className="pointer-events-none absolute end-[0.3rem] top-[0.3rem] hidden h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 select-none group-hover:bg-accent sm:flex">
										<span className="text-xs">⌘</span>K
									</kbd>
								</Button>
								<DialogContent className="sm:max-w-[600px]">
									<DialogHeader>
										<DialogTitle>Search</DialogTitle>
									</DialogHeader>
									<div className="space-y-4">
										<div className="relative">
											<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
											<Input
												placeholder="Search pages, users, settings..."
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												className="pl-10"
												autoFocus
											/>
										</div>
										{searchQuery && (
											<div className="space-y-2">
												<p className="text-sm font-medium">
													{searchResults.length > 0
														? "Search Results"
														: "No results found"}
												</p>
												<div className="space-y-1">
													{searchResults.map((item, index) => {
														const Icon = item.icon;
														const isSelected = index === selectedIndex;
														return (
															<Link
																key={item.path}
																to={item.path}
																onClick={() => {
																	setSearchOpen(false);
																	setSearchQuery("");
																}}
																className={`flex items-center gap-3 rounded-md p-3 transition-colors ${
																	isSelected
																		? "bg-accent"
																		: "hover:bg-accent"
																}`}
															>
																<div className="flex size-9 items-center justify-center rounded-lg bg-muted">
																	<Icon className="h-5 w-5" />
																</div>
																<div>
																	<p className="text-sm font-medium">{item.label}</p>
																	<p className="text-xs text-muted-foreground">
																		{item.path.replace("/admin/", "")}
																	</p>
																</div>
															</Link>
														);
													})}
												</div>
												{searchResults.length > 0 && (
													<p className="text-xs text-muted-foreground">
														Use <kbd className="px-1 py-0.5 rounded bg-muted border">↑↓</kbd> to navigate, <kbd className="px-1 py-0.5 rounded bg-muted border">Enter</kbd> to select
													</p>
												)}
											</div>
										)}
										{!searchQuery && (
											<div className="space-y-2">
												<p className="text-sm font-medium">Quick Links</p>
												<div className="grid grid-cols-2 gap-2">
													{filteredMenuItems.slice(0, 6).map((item) => {
														const Icon = item.icon;
														return (
															<Link
																key={item.path}
																to={item.path}
																onClick={() => setSearchOpen(false)}
																className="flex items-center gap-2 rounded-md border p-3 hover:bg-accent transition-colors"
															>
																<Icon className="h-4 w-4" />
																<span className="text-sm">{item.label}</span>
															</Link>
														);
													})}
												</div>
											</div>
										)}
									</div>
								</DialogContent>
							</Dialog>

							{/* Theme toggle */}
							<ThemeToggle />

							{/* Settings button */}
							<Button variant="ghost" size="icon" className="size-9 rounded-full" asChild>
								<Link to="/admin/settings">
									<Settings />
								</Link>
							</Button>

							{/* User avatar dropdown */}
							{user ? (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" className="relative h-8 w-8 rounded-full px-4 py-2">
											<Avatar className="h-8 w-8">
												<AvatarFallback className="rounded-lg">{getUserInitials()}</AvatarFallback>
											</Avatar>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" side="right" className="w-56">
										<DropdownMenuLabel>
											<div className="flex flex-col space-y-1">
												<p className="text-xs font-medium leading-none text-muted-foreground">
													Signed in as
												</p>
												<p className="text-sm font-semibold truncate">{user.name}</p>
												<p className="text-xs text-muted-foreground truncate">{user.email}</p>
											</div>
										</DropdownMenuLabel>
										<DropdownMenuSeparator />
										<DropdownMenuItem asChild>
											<Link to="/admin/profile" className="cursor-pointer">
												<User className="mr-2 h-4 w-4" />
												Profile
											</Link>
										</DropdownMenuItem>
										<DropdownMenuItem asChild>
											<Link to="/admin/settings" className="cursor-pointer">
												<Settings className="mr-2 h-4 w-4" />
												Settings
											</Link>
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											className="cursor-pointer text-destructive focus:text-destructive"
											onClick={() => logout()}
										>
											<LogOut className="mr-2 h-4 w-4" />
											Logout
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							) : (
								<Button variant="ghost" size="icon" className="size-9 rounded-full" asChild>
									<Link to="/login">
										<LogIn />
									</Link>
								</Button>
							)}
						</div>
					</div>
				</header>

				<main className="flex flex-1 flex-col gap-4 p-4 pt-0">
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
			</SidebarInset>
		</SidebarProvider>
	);
}

function AdminDashboard() {
	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
				<p className="text-muted-foreground">Welcome to your admin dashboard</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card className="overflow-hidden">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">Total Users</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold tracking-tight">1,234</div>
						<p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
							<span className="text-green-600">+12%</span> from last month
						</p>
					</CardContent>
				</Card>

				<Card className="overflow-hidden">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold tracking-tight">89</div>
						<p className="text-xs text-muted-foreground mt-1">Currently online</p>
					</CardContent>
				</Card>

				<Card className="overflow-hidden">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">Revenue</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold tracking-tight">$45.2K</div>
						<p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
							<span className="text-green-600">+23%</span> from last month
						</p>
					</CardContent>
				</Card>

				<Card className="overflow-hidden">
					<CardHeader className="pb-3">
						<CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold tracking-tight">3.2%</div>
						<p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
							<span className="text-green-600">+0.5%</span> from last month
						</p>
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
