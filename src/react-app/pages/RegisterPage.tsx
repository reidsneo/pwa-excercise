import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";

export function RegisterPage() {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);
	const [tenantSlug, setTenantSlug] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			setIsLoading(false);
			return;
		}

		if (password.length < 6) {
			setError("Password must be at least 6 characters");
			setIsLoading(false);
			return;
		}

		try {
			const response = await fetch("/api/auth/register", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email, password, name, companyName }),
			});

			if (!response.ok) {
				const err = await response.json();
				throw new Error(err.error || "Registration failed");
			}

			const data = await response.json();

			// Store token
			localStorage.setItem("auth_token", data.token);

			// Show success message with tenant info
			setTenantSlug(data.tenantSlug || "");
			setSuccess(true);

			// Navigate after 2 seconds
			setTimeout(() => {
				navigate("/admin");
			}, 2000);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Registration failed");
		} finally {
			setIsLoading(false);
		}
	};

	if (success) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background p-4">
				<Card className="w-full max-w-md">
					<CardHeader className="space-y-1 text-center">
						<CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
						<CardTitle className="text-2xl font-bold">Account Created!</CardTitle>
						<CardDescription>
							{tenantSlug && (
								<>
									Your workspace is ready at: <span className="font-mono text-primary">{tenantSlug}.localhost:8787</span>
								</>
							)}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-center text-sm text-muted-foreground">
							Redirecting to dashboard...
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="space-y-1">
					<CardTitle className="text-2xl font-bold">Create an account</CardTitle>
					<CardDescription>Enter your information to register</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						{error && (
							<div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
								{error}
							</div>
						)}
						<div className="space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								type="text"
								placeholder="John Doe"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								disabled={isLoading}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="companyName">Company Name (Optional)</Label>
							<Input
								id="companyName"
								type="text"
								placeholder="Acme Inc"
								value={companyName}
								onChange={(e) => setCompanyName(e.target.value)}
								disabled={isLoading}
							/>
							<p className="text-xs text-muted-foreground">Used for your workspace URL</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								placeholder="name@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								disabled={isLoading}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								disabled={isLoading}
							/>
							<p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="confirmPassword">Confirm Password</Label>
							<Input
								id="confirmPassword"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								required
								disabled={isLoading}
							/>
						</div>
						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Creating account...
								</>
							) : (
								"Create account"
							)}
						</Button>
						<div className="text-sm text-center text-muted-foreground">
							Already have an account?{" "}
							<Link to="/login" className="text-primary hover:underline">
								Sign in
							</Link>
						</div>
						<div className="text-sm text-center text-muted-foreground">
							<Link to="/" className="text-primary hover:underline">
								Back to home
							</Link>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
