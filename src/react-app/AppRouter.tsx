import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { UserApp } from "./apps/user/UserApp";
import { AdminApp } from "./apps/admin/AdminApp";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { useRegisterSW } from "virtual:pwa-register/react";

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

	return (
		<AuthProvider>
			<BrowserRouter>
				<Routes>
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
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</BrowserRouter>
		</AuthProvider>
	);
}

export default App;
