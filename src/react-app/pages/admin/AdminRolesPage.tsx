import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Plus, Pencil, Trash2, Shield, ShieldCheck, ShieldAlert } from "lucide-react";

interface Role {
	id: number;
	name: string;
	description: string | null;
}

interface Permission {
	id: number;
	name: string;
	description: string | null;
	resource: string;
	action: string;
}

export function AdminRoles() {
	const { token } = useAuth();
	const [roles, setRoles] = useState<Role[]>([]);
	const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
	const [rolePermissions, setRolePermissions] = useState<Record<number, Permission[]>>({});
	const [isLoading, setIsLoading] = useState(true);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [showPermissionsModal, setShowPermissionsModal] = useState(false);
	const [selectedRole, setSelectedRole] = useState<Role | null>(null);
	const [formData, setFormData] = useState({
		name: "",
		description: "",
	});
	const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);

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

	const fetchAllPermissions = async () => {
		try {
			const response = await fetch("/api/admin/permissions", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				setAllPermissions(data.permissions);
			}
		} catch (error) {
			console.error("Failed to fetch permissions:", error);
		}
	};

	const fetchRolePermissions = async (roleId: number) => {
		try {
			const response = await fetch(`/api/admin/roles/${roleId}/permissions`, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				setRolePermissions((prev) => ({
					...prev,
					[roleId]: data.permissions,
				}));
				return data.permissions;
			}
		} catch (error) {
			console.error("Failed to fetch role permissions:", error);
		}
		return [];
	};

	const loadAllPermissions = async () => {
		const perms: Record<number, Permission[]> = {};
		for (const role of roles) {
			perms[role.id] = await fetchRolePermissions(role.id);
		}
		setRolePermissions(perms);
	};

	useEffect(() => {
		fetchRoles();
		fetchAllPermissions();
		setIsLoading(false);
	}, []);

	useEffect(() => {
		if (roles.length > 0) {
			loadAllPermissions();
		}
	}, [roles]);

	const handleCreateRole = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		try {
			const response = await fetch("/api/admin/roles", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(formData),
			});

			if (response.ok) {
				await fetchRoles();
				setShowCreateModal(false);
				setFormData({ name: "", description: "" });
			} else {
				const error = await response.json();
				alert(error.error || "Failed to create role");
			}
		} catch (error) {
			console.error("Failed to create role:", error);
			alert("Failed to create role");
		} finally {
			setIsLoading(false);
		}
	};

	const handleUpdateRole = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		try {
			const response = await fetch(`/api/admin/roles/${selectedRole?.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(formData),
			});

			if (response.ok) {
				await fetchRoles();
				setShowEditModal(false);
				setSelectedRole(null);
				setFormData({ name: "", description: "" });
			} else {
				const error = await response.json();
				alert(error.error || "Failed to update role");
			}
		} catch (error) {
			console.error("Failed to update role:", error);
			alert("Failed to update role");
		} finally {
			setIsLoading(false);
		}
	};

	const handleDeleteRole = async (roleId: number) => {
		if (!confirm("Are you sure you want to delete this role?")) return;

		try {
			const response = await fetch(`/api/admin/roles/${roleId}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				await fetchRoles();
			} else {
				const error = await response.json();
				alert(error.error || "Failed to delete role");
			}
		} catch (error) {
			console.error("Failed to delete role:", error);
			alert("Failed to delete role");
		}
	};

	const openEditModal = (role: Role) => {
		setSelectedRole(role);
		setFormData({
			name: role.name,
			description: role.description || "",
		});
		setShowEditModal(true);
	};

	const openPermissionsModal = async (role: Role) => {
		setSelectedRole(role);
		const perms = rolePermissions[role.id] || [];
		setSelectedPermissions(perms.map((p) => p.id));
		setShowPermissionsModal(true);
	};

	const handleAssignPermissions = async () => {
		if (!selectedRole) return;

		setIsLoading(true);

		try {
			// Get the currently assigned permissions for this role
			const currentPerms = rolePermissions[selectedRole.id] || [];
			const currentPermIds = new Set(currentPerms.map((p) => p.id));
			const selectedPermSet = new Set(selectedPermissions);

			// Remove permissions that were unchecked (are in current but not in selected)
			const toRemove = currentPerms.filter((p) => !selectedPermSet.has(p.id));

			for (const perm of toRemove) {
				const response = await fetch(`/api/admin/roles/${selectedRole.id}/permissions/${perm.id}`, {
					method: "DELETE",
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});
				if (!response.ok) {
					const error = await response.json();
					console.error("Failed to remove permission:", error);
				}
			}

			// Add new permissions that aren't currently assigned (are in selected but not in current)
			const toAdd = selectedPermissions.filter((id) => !currentPermIds.has(id));

			for (const permId of toAdd) {
				const response = await fetch(`/api/admin/roles/${selectedRole.id}/permissions`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ permissionId: permId }),
				});
				if (!response.ok) {
					const error = await response.json();
					console.error("Failed to add permission:", error);
				}
			}

			// Reload permissions to get updated state
			await fetchRolePermissions(selectedRole.id);
			setShowPermissionsModal(false);
			setSelectedRole(null);
			setSelectedPermissions([]);
		} catch (error) {
			console.error("Failed to assign permissions:", error);
			alert("Failed to assign permissions");
		} finally {
			setIsLoading(false);
		}
	};

	const togglePermission = (permId: number) => {
		setSelectedPermissions((prev) => {
			return prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId];
		});
	};

	if (isLoading && roles.length === 0) {
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
					<h2 className="text-3xl font-bold">Role Management</h2>
					<p className="text-muted-foreground">Manage user roles and permissions</p>
				</div>
				<Button onClick={() => setShowCreateModal(true)}>
					<Plus className="w-4 h-4 mr-2" />
					Add Role
				</Button>
			</div>

			<Card>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b bg-muted/50">
									<th className="p-4 text-left font-medium">Name</th>
									<th className="p-4 text-left font-medium">Description</th>
									<th className="p-4 text-left font-medium">Permissions</th>
									<th className="p-4 text-left font-medium">Actions</th>
								</tr>
							</thead>
							<tbody>
								{roles.map((role) => (
									<tr key={role.id} className="border-b hover:bg-muted/30">
										<td className="p-4">
											<div className="flex items-center gap-2">
												<Shield className="w-4 h-4 text-primary" />
												<span className="font-medium">{role.name}</span>
											</div>
										</td>
										<td className="p-4 text-muted-foreground">{role.description || "-"}</td>
										<td className="p-4">
											<span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
												{(rolePermissions[role.id] || []).length} permissions
											</span>
										</td>
										<td className="p-4">
											<div className="flex gap-2">
												<Button
													size="sm"
													variant="outline"
													onClick={() => openPermissionsModal(role)}
												>
													<ShieldCheck className="w-3 h-3" />
												</Button>
												<Button
													size="sm"
													variant="outline"
													onClick={() => openEditModal(role)}
												>
													<Pencil className="w-3 h-3" />
												</Button>
												<Button
													size="sm"
													variant="outline"
													onClick={() => handleDeleteRole(role.id)}
												>
													<Trash2 className="w-3 h-3 text-destructive" />
												</Button>
											</div>
										</td>
									</tr>
								))}
								{roles.length === 0 && (
									<tr>
										<td colSpan={4} className="p-8 text-center text-muted-foreground">
											No roles found. Create your first role to get started.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>

			{/* Create Role Modal */}
			{showCreateModal && (
				<div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
					<Card className="w-full max-w-md">
						<CardHeader>
							<CardTitle>Create New Role</CardTitle>
							<CardDescription>Add a new role to the system</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleCreateRole} className="space-y-4">
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
									<Label htmlFor="create-description">Description</Label>
									<Input
										id="create-description"
										value={formData.description}
										onChange={(e) => setFormData({ ...formData, description: e.target.value })}
									/>
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
										{isLoading ? "Creating..." : "Create Role"}
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Edit Role Modal */}
			{showEditModal && selectedRole && (
				<div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
					<Card className="w-full max-w-md">
						<CardHeader>
							<CardTitle>Edit Role</CardTitle>
							<CardDescription>Update role information</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleUpdateRole} className="space-y-4">
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
									<Label htmlFor="edit-description">Description</Label>
									<Input
										id="edit-description"
										value={formData.description}
										onChange={(e) => setFormData({ ...formData, description: e.target.value })}
									/>
								</div>
								<div className="flex gap-2 justify-end">
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setShowEditModal(false);
											setSelectedRole(null);
											setFormData({ name: "", description: "" });
										}}
									>
										Cancel
									</Button>
									<Button type="submit" disabled={isLoading}>
										{isLoading ? "Updating..." : "Update Role"}
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Permissions Modal */}
			{showPermissionsModal && selectedRole && (
				<div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
					<Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<ShieldAlert className="w-5 h-5" />
								Manage Permissions
							</CardTitle>
							<CardDescription>
								Assign permissions to role: <strong>{selectedRole.name}</strong>
							</CardDescription>
						</CardHeader>
						<CardContent className="flex-1 overflow-y-auto">
							<div className="space-y-4">
								{allPermissions.length === 0 ? (
									<p className="text-center text-muted-foreground py-8">
										No permissions available. Create permissions first.
									</p>
								) : (
									allPermissions.map((permission) => (
										<div
											key={permission.id}
											className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50"
										>
											<input
												type="checkbox"
												id={`perm-${permission.id}`}
												checked={selectedPermissions.includes(permission.id)}
												onChange={() => togglePermission(permission.id)}
												className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
											/>
											<div className="flex-1">
												<div
													className="font-medium cursor-pointer flex items-center gap-2"
													onClick={() => togglePermission(permission.id)}
												>
													{permission.name}
													<span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
														{permission.resource}:{permission.action}
													</span>
												</div>
												{permission.description && (
													<p className="text-sm text-muted-foreground mt-1">
														{permission.description}
													</p>
												)}
											</div>
										</div>
									))
								)}
							</div>
						</CardContent>
						<div className="p-4 border-t flex gap-2 justify-end">
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									setShowPermissionsModal(false);
									setSelectedRole(null);
									setSelectedPermissions([]);
								}}
							>
								Cancel
							</Button>
							<Button onClick={handleAssignPermissions} disabled={isLoading}>
								{isLoading ? "Saving..." : "Save Permissions"}
							</Button>
						</div>
					</Card>
				</div>
			)}
		</div>
	);
}
