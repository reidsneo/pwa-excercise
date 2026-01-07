import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { UserApp } from "./apps/user/UserApp";
import { AdminApp } from "./apps/admin/AdminApp";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect, useState } from "react";
import { PluginRegistry, PluginLoader } from "./plugins";
import { usePluginRoutes } from "./plugins/PluginRoutes";
import { ToastProvider } from "./hooks/use-toast.tsx";

// -----------------------------------------------------------------------------
// Plugin Initialization Component
// -----------------------------------------------------------------------------

function PluginInitializer({ children }: { children: React.ReactNode }) {
	const [initialized, setInitialized] = useState(false);

	useEffect(() => {
		const initPlugins = async () => {
			// Initialize the registry
			await PluginRegistry.initialize();

			// Load all plugins
			await PluginLoader.load({
				pluginsDir: '/src/plugins',
				lazyLoad: true,
			});

			setInitialized(true);
		};

		initPlugins();
	}, []);

	if (!initialized) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
					<p className="text-muted-foreground">Loading plugins...</p>
				</div>
			</div>
		);
	}

	// Pass pluginRoutes to children via render prop
	return <>{children}</>;
}

function App() {
	// PWA registration
	useRegisterSW({
		onRegistered(r: ServiceWorkerRegistration | undefined) {
			console.log("SW Registered: " + r);
		},
		onRegisterError(error: unknown) {
			console.log("SW registration error", error);
		},
	});

	const pluginRoutes = usePluginRoutes();

	return (
		<PluginInitializer>
			<ToastProvider>
				<AuthProvider>
					<BrowserRouter>
						<Routes>
							{/* Core Routes */}
							<Route path="/" element={<UserApp />} />
							<Route path="/user/*" element={<UserApp />} />
							<Route path="/login" element={<LoginPage />} />
							<Route path="/register" element={<RegisterPage />} />
							<Route
								path="/admin/*"
								element={
									<ProtectedRoute requireAdmin={true}>
										<AdminApp />
									</ProtectedRoute>
								}
							/>

							{/* Plugin Routes */}
							{pluginRoutes.map((route: { path?: string; element?: React.ReactNode }, index: number) => (
								<Route key={`plugin-${index}`} path={route.path || ''} element={route.element} />
							))}

							{/* Catch-all */}
							<Route path="*" element={<Navigate to="/" replace />} />
						</Routes>
					</BrowserRouter>
				</AuthProvider>
			</ToastProvider>
		</PluginInitializer>
	);
}

export default App;
