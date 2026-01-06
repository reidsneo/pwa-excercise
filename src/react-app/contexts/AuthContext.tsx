import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";

interface Permission {
	id: number;
	name: string;
	description: string | null;
	resource: string;
	action: string;
}

interface User {
	id: number;
	email: string;
	name: string;
	roleId: number | null;
	role?: {
		id: number;
		name: string;
		description: string | null;
	};
	permissions?: Permission[];
}

interface AuthContextType {
	user: User | null;
	token: string | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	login: (email: string, password: string) => Promise<void>;
	register: (email: string, password: string, name: string) => Promise<void>;
	logout: () => Promise<void>;
	reloadUser: () => Promise<void>;
	hasPermission: (resource: string, action: string) => boolean;
	hasAnyPermission: (permissions: Array<{ resource: string; action: string }>) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const hasFetchedRef = useRef(false);

	// Load token from localStorage on mount
	useEffect(() => {
		const storedToken = localStorage.getItem("auth_token");
		console.log("Loading token from localStorage:", storedToken ? "Found token" : "No token found");
		if (storedToken) {
			setToken(storedToken);
			// Don't set isLoading to false here - let the fetchUser effect handle it
		} else {
			setIsLoading(false);
		}
	}, []);

	// Fetch user data when token changes
	useEffect(() => {
		let isMounted = true;

		async function fetchUser() {
			if (!token) {
				setUser(null);
				setIsLoading(false);
				hasFetchedRef.current = false;
				return;
			}

			// Prevent double-fetch in React StrictMode
			if (hasFetchedRef.current) {
				console.log("Already fetched user for this token, skipping");
				return;
			}

			hasFetchedRef.current = true;
			console.log("Fetching user data with token... Token length:", token.length);

			try {
				const response = await fetch("/api/auth/me", {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});

				console.log("Auth response status:", response.status);
				const responseText = await response.text();
				console.log("Auth response text:", responseText);

				if (response.ok) {
					const data = JSON.parse(responseText);
					console.log("User data received:", data);
					console.log("User object:", data.user);
					if (isMounted) {
						setUser(data.user);
					}
				} else {
					// Token is invalid, clear it
					console.error("Auth check failed:", response.status, response.statusText);
					if (isMounted) {
						localStorage.removeItem("auth_token");
						setToken(null);
						setUser(null);
						hasFetchedRef.current = false;
					}
				}
			} catch (error) {
				console.error("Failed to fetch user:", error);
				if (isMounted) {
					setUser(null);
					hasFetchedRef.current = false;
				}
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		}

		fetchUser();

		return () => {
			isMounted = false;
		};
	}, [token]);

	const login = async (email: string, password: string) => {
		const response = await fetch("/api/auth/login", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ email, password }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || "Login failed");
		}

		const data = await response.json();
		setToken(data.token);
		setUser(data.user);
		localStorage.setItem("auth_token", data.token);
	};

	const register = async (email: string, password: string, name: string) => {
		const response = await fetch("/api/auth/register", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ email, password, name }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || "Registration failed");
		}

		const data = await response.json();
		setToken(data.token);
		setUser(data.user);
		localStorage.setItem("auth_token", data.token);
	};

	const logout = async () => {
		try {
			await fetch("/api/auth/logout", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
		} catch (error) {
			console.error("Logout error:", error);
		} finally {
			setUser(null);
			setToken(null);
			localStorage.removeItem("auth_token");
		}
	};

	const reloadUser = async () => {
		if (!token) return;

		const response = await fetch("/api/auth/me", {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		if (response.ok) {
			const data = await response.json();
			setUser(data.user);
		}
	};

	const hasPermission = (resource: string, action: string): boolean => {
		if (!user?.permissions) return false;
		return user.permissions.some(
			(p) => p.resource === resource && p.action === action
		);
	};

	const hasAnyPermission = (permissions: Array<{ resource: string; action: string }>): boolean => {
		if (!user?.permissions) return false;
		return permissions.some(({ resource, action }) =>
			user.permissions?.some((p) => p.resource === resource && p.action === action)
		);
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				token,
				isLoading,
				isAuthenticated: !!user,
				login,
				register,
				logout,
				reloadUser,
				hasPermission,
				hasAnyPermission,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
