import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

interface User {
	id: number;
	email: string;
	name: string;
	roleId: number | null;
	role?: {
		id: number;
		name: string;
	};
}

interface Role {
	id: number;
	name: string;
	description: string | null;
}

export function AdminUsers() {
	const { token } = useAuth();
	const [users, setUsers] = useState<User[]>([]);
	const [roles, setRoles] = useState<Role[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		roleId: "",
	});

	const fetchUsers = async () => {
		try {
			const response = await fetch("/api/admin/users", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				setUsers(data.users.map((u: { user: User; role: Role }) => ({ ...u.user, role: u.role })));
			}
		} catch (error) {
			console.error("Failed to fetch users:", error);
		}
	};

	const fetchRoles = async () => {
		try {
			const response = await fetch("/api/admin/roles", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				setRoles(data.roles);
			}
		} catch (error) {
			console.error("Failed to fetch roles:", error);
		}
	};

	useEffect(() => {
		fetchUsers();
		fetchRoles();
		setIsLoading(false);
	}, []);

	const handleCreateUser = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		try {
			const response = await fetch("/api/admin/users", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(formData),
			});

			if (response.ok) {
				await fetchUsers();
				setShowCreateModal(false);
				setFormData({ name: "", email: "", password: "", roleId: "" });
			} else {
				const error = await response.json();
				alert(error.error || "Failed to create user");
			}
		} catch (error) {
			console.error("Failed to create user:", error);
			alert("Failed to create user");
		} finally {
			setIsLoading(false);
		}
	};

	const handleUpdateUser = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		try {
			const response = await fetch(`/api/admin/users/${selectedUser?.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					name: formData.name,
					roleId: formData.roleId ? parseInt(formData.roleId) : null,
					isActive: true,
				}),
			});

			if (response.ok) {
				await fetchUsers();
				setShowEditModal(false);
				setSelectedUser(null);
				setFormData({ name: "", email: "", password: "", roleId: "" });
			} else {
				const error = await response.json();
				alert(error.error || "Failed to update user");
			}
		} catch (error) {
			console.error("Failed to update user:", error);
			alert("Failed to update user");
		} finally {
			setIsLoading(false);
		}
	};

	const handleDeleteUser = async (userId: number) => {
		if (!confirm("Are you sure you want to delete this user?")) return;

		try {
			const response = await fetch(`/api/admin/users/${userId}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				await fetchUsers();
			} else {
				const error = await response.json();
				alert(error.error || "Failed to delete user");
			}
		} catch (error) {
			console.error("Failed to delete user:", error);
			alert("Failed to delete user");
		}
	};

	const openEditModal = (user: User) => {
		setSelectedUser(user);
		setFormData({
			name: user.name,
			email: user.email,
			password: "",
			roleId: user.roleId?.toString() || "",
		});
		setShowEditModal(true);
	};

	if (isLoading && users.length === 0) {
		return (
			<div className="flex items-center justify-center p-8">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-3xl font-bold">User Management</h2>
					<p className="text-muted-foreground">Manage user accounts and permissions</p>
				</div>
				<Button onClick={() => setShowCreateModal(true)}>
					<Plus className="w-4 h-4 mr-2" />
					Add User
				</Button>
			</div>

			<Card>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b bg-muted/50">
									<th className="p-4 text-left font-medium">Name</th>
									<th className="p-4 text-left font-medium">Email</th>
									<th className="p-4 text-left font-medium">Role</th>
									<th className="p-4 text-left font-medium">Actions</th>
								</tr>
							</thead>
							<tbody>
								{users.map((user) => (
									<tr key={user.id} className="border-b hover:bg-muted/30">
										<td className="p-4">{user.name}</td>
										<td className="p-4">{user.email}</td>
										<td className="p-4">
											<span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
												{user.role?.name || "No role"}
											</span>
										</td>
										<td className="p-4">
											<div className="flex gap-2">
												<Button
													size="sm"
													variant="outline"
													onClick={() => openEditModal(user)}
												>
													<Pencil className="w-3 h-3" />
												</Button>
												<Button
													size="sm"
													variant="outline"
													onClick={() => handleDeleteUser(user.id)}
												>
													<Trash2 className="w-3 h-3 text-destructive" />
												</Button>
											</div>
										</td>
									</tr>
								))}
								{users.length === 0 && (
									<tr>
										<td colSpan={4} className="p-8 text-center text-muted-foreground">
											No users found. Create your first user to get started.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>

			{/* Create User Modal */}
			{showCreateModal && (
				<div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
					<Card className="w-full max-w-md">
						<CardHeader>
							<CardTitle>Create New User</CardTitle>
							<CardDescription>Add a new user to the system</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleCreateUser} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="create-name">Name</Label>
									<Input
										id="create-name"
										value={formData.name}
										onChange={(e) => setFormData({ ...formData, name: e.target.value })}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="create-email">Email</Label>
									<Input
										id="create-email"
										type="email"
										value={formData.email}
										onChange={(e) => setFormData({ ...formData, email: e.target.value })}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="create-password">Password</Label>
									<Input
										id="create-password"
										type="password"
										value={formData.password}
										onChange={(e) => setFormData({ ...formData, password: e.target.value })}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="create-role">Role</Label>
									<select
										id="create-role"
										className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
										value={formData.roleId}
										onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
									>
										<option value="">No role</option>
										{roles.map((role) => (
											<option key={role.id} value={role.id}>
												{role.name}
											</option>
										))}
									</select>
								</div>
								<div className="flex gap-2 justify-end">
									<Button
										type="button"
										variant="outline"
										onClick={() => setShowCreateModal(false)}
									>
										Cancel
									</Button>
									<Button type="submit" disabled={isLoading}>
										{isLoading ? "Creating..." : "Create User"}
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Edit User Modal */}
			{showEditModal && selectedUser && (
				<div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
					<Card className="w-full max-w-md">
						<CardHeader>
							<CardTitle>Edit User</CardTitle>
							<CardDescription>Update user information</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleUpdateUser} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="edit-name">Name</Label>
									<Input
										id="edit-name"
										value={formData.name}
										onChange={(e) => setFormData({ ...formData, name: e.target.value })}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-email">Email</Label>
									<Input
										id="edit-email"
										type="email"
										value={formData.email}
										disabled
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="edit-role">Role</Label>
									<select
										id="edit-role"
										className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
										value={formData.roleId}
										onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
									>
										<option value="">No role</option>
										{roles.map((role) => (
											<option key={role.id} value={role.id}>
												{role.name}
											</option>
										))}
									</select>
								</div>
								<div className="flex gap-2 justify-end">
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setShowEditModal(false);
											setSelectedUser(null);
											setFormData({ name: "", email: "", password: "", roleId: "" });
										}}
									>
										Cancel
									</Button>
									<Button type="submit" disabled={isLoading}>
										{isLoading ? "Updating..." : "Update User"}
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>
				</div>
			)}
		</div>
	);
}
