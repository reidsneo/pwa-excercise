import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

interface ProtectedRouteProps {
	children: React.ReactNode;
	requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
	const { user, token, isLoading } = useAuth();

	useEffect(() => {
		console.log("ProtectedRoute state:", { isLoading, hasToken: !!token, hasUser: !!user, user, requireAdmin });
	}, [isLoading, token, user, requireAdmin]);

	// Show loading while checking auth
	if (isLoading) {
		console.log("ProtectedRoute: Still loading, showing spinner");
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	// No token - redirect to login
	if (!token) {
		console.log("ProtectedRoute: No token, redirecting to login");
		return <Navigate to="/login" replace />;
	}

	// Has token but no user yet - still loading
	if (!user) {
		console.log("ProtectedRoute: Has token but no user yet, showing spinner");
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	// Check if user has admin role (optional)
	if (requireAdmin && user.roleId !== 1) {
		console.log("ProtectedRoute: User is not admin (roleId:", user.roleId, "), redirecting to home");
		return <Navigate to="/" replace />;
	}

	console.log("ProtectedRoute: Access granted, rendering children");
	return <>{children}</>;
}
