import { Routes, Route, Navigate, Link } from "react-router-dom";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Info, Contact, LogIn, LogOut, User, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import type { PluginState } from '@/shared/plugin';
import { PluginStatus } from '@/shared/plugin';
import { BlogListPage, BlogPostPage } from '@/pages/blog';

interface BackendPluginState {
	plugins: Array<{ id: string; name: string; version: string }>;
	states: PluginState[];
}

export function UserApp() {
	const { user, logout } = useAuth();
	const [pluginStates, setPluginStates] = useState<PluginState[]>([]);
	const [loading, setLoading] = useState(true);

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
			} finally {
				setLoading(false);
			}
		};

		fetchPluginStates();
	}, []);

	// Check if blog plugin is enabled
	const blogPlugin = pluginStates.find(
		(state) => state.id === '550e8400-e29b-41d4-a716-446655440001' && state.status === 'enabled'
	);
	const isBlogEnabled = !!blogPlugin;

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<header className="border-b">
				<div className="container mx-auto px-4 py-4 flex items-center justify-between">
					<h1 className="text-2xl font-bold">User Portal</h1>
					<nav className="flex gap-4 items-center">
						<Button variant="ghost" size="sm" asChild>
							<Link to="/">
								<Home className="w-4 h-4 mr-2" />
								Home
							</Link>
						</Button>
						{isBlogEnabled && (
							<Button variant="ghost" size="sm" asChild>
								<Link to="/blog">
									<BookOpen className="w-4 h-4 mr-2" />
									Blog
								</Link>
							</Button>
						)}
						<Button variant="ghost" size="sm" asChild>
							<Link to="/about">
								<Info className="w-4 h-4 mr-2" />
								About
							</Link>
						</Button>
						<Button variant="ghost" size="sm" asChild>
							<Link to="/contact">
								<Contact className="w-4 h-4 mr-2" />
								Contact
							</Link>
						</Button>
						<div className="w-px h-6 bg-border" />
						{user ? (
							<div className="flex items-center gap-3">
								<div className="flex items-center gap-2 text-sm">
									<User className="w-4 h-4" />
									<span>{user.name}</span>
								</div>
								<Button variant="outline" size="sm" onClick={logout}>
									<LogOut className="w-4 h-4 mr-2" />
									Logout
								</Button>
							</div>
						) : (
							<div className="flex gap-2">
								<Button variant="ghost" size="sm" asChild>
									<Link to="/login">
										<LogIn className="w-4 h-4 mr-2" />
										Login
									</Link>
								</Button>
								<Button size="sm" asChild>
									<Link to="/register">Sign Up</Link>
								</Button>
							</div>
						)}
					</nav>
				</div>
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-4 py-8">
				<Routes>
					<Route path="/" element={<UserHome />} />
					<Route path="/about" element={<UserAbout />} />
					<Route path="/contact" element={<UserContact />} />
					<Route path="/blog" element={<BlogListPage isEnabled={isBlogEnabled} />} />
					<Route path="/blog/:slug" element={<BlogPostPage isEnabled={isBlogEnabled} />} />
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</main>

			{/* Footer */}
			<footer className="border-t mt-12">
				<div className="container mx-auto px-4 py-6 text-center text-muted-foreground">
					<p>&copy; 2025 User Portal. All rights reserved.</p>
				</div>
			</footer>
		</div>
	);
}

function UserHome() {
	return (
		<div className="space-y-8">
			<div className="text-center space-y-4">
				<h2 className="text-4xl font-bold">Welcome to User Portal</h2>
				<p className="text-xl text-muted-foreground">
					Your gateway to amazing services and features
				</p>
			</div>

			<div className="grid md:grid-cols-3 gap-6 mt-12">
				<Card>
					<CardHeader>
						<CardTitle>Feature 1</CardTitle>
						<CardDescription>Explore our amazing features</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							Lorem ipsum dolor sit amet, consectetur adipiscing elit.
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Feature 2</CardTitle>
						<CardDescription>Discover what we offer</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Feature 3</CardTitle>
						<CardDescription>Get started today</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							Ut enim ad minim veniam, quis nostrud exercitation ullamco.
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function UserAbout() {
	return (
		<div className="max-w-2xl mx-auto space-y-6">
			<h2 className="text-3xl font-bold">About Us</h2>
			<p className="text-muted-foreground">
				We are dedicated to providing the best user experience possible.
				Our platform is designed with you in mind, offering intuitive
				interfaces and powerful features.
			</p>
		</div>
	);
}

function UserContact() {
	return (
		<div className="max-w-2xl mx-auto space-y-6">
			<h2 className="text-3xl font-bold">Contact Us</h2>
			<Card>
				<CardContent className="pt-6 space-y-4">
					<div>
						<p className="font-medium">Email</p>
						<p className="text-muted-foreground">support@example.com</p>
					</div>
					<div>
						<p className="font-medium">Phone</p>
						<p className="text-muted-foreground">+1 (555) 123-4567</p>
					</div>
					<div>
						<p className="font-medium">Address</p>
						<p className="text-muted-foreground">123 Main Street, City, State 12345</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
