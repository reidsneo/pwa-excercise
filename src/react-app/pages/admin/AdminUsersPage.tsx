import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Plus, Pencil, Trash2, MoreHorizontal, Search, Filter, Check, ChevronsUpDown, ArrowUpDown } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

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
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [userToDelete, setUserToDelete] = useState<User | null>(null);
	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		roleId: "",
	});

	// Filter states
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedRole, setSelectedRole] = useState<string>("all");
	const [selectedStatus, setSelectedStatus] = useState<string>("all");

	// Multi-select state
	const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
	const [isAllSelected, setIsAllSelected] = useState(false);

	// Sorting state
	const [sortColumn, setSortColumn] = useState<"name" | "email" | "role" | null>(null);
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

	// Filter and sort users
	const filteredAndSortedUsers = users.filter((user) => {
		const matchesSearch =
			searchQuery === "" ||
			user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			user.email.toLowerCase().includes(searchQuery.toLowerCase());

		const matchesRole =
			selectedRole === "all" ||
			(selectedRole === "none" && !user.role) ||
			user.role?.name === selectedRole;

		// For now, all users are considered "active" since we don't have a status field
		const matchesStatus =
			selectedStatus === "all" || selectedStatus === "active";

		return matchesSearch && matchesRole && matchesStatus;
	}).sort((a, b) => {
		if (!sortColumn) return 0;

		let aVal: string;
		let bVal: string;

		switch (sortColumn) {
			case "name":
				aVal = a.name;
				bVal = b.name;
				break;
			case "email":
				aVal = a.email;
				bVal = b.email;
				break;
			case "role":
				aVal = a.role?.name || "";
				bVal = b.role?.name || "";
				break;
			default:
				return 0;
		}

		if (sortDirection === "asc") {
			return aVal.localeCompare(bVal);
		} else {
			return bVal.localeCompare(aVal);
		}
	});

	// Toggle user selection
	const toggleUserSelection = (userId: number) => {
		const newSelection = new Set(selectedUserIds);
		if (newSelection.has(userId)) {
			newSelection.delete(userId);
		} else {
			newSelection.add(userId);
		}
		setSelectedUserIds(newSelection);
	};

	// Toggle all users selection
	const toggleAllUsers = () => {
		if (isAllSelected) {
			setSelectedUserIds(new Set());
			setIsAllSelected(false);
		} else {
			setSelectedUserIds(new Set(filteredAndSortedUsers.map(u => u.id)));
			setIsAllSelected(true);
		}
	};

	// Handle column sort
	const handleSort = (column: "name" | "email" | "role") => {
		if (sortColumn === column) {
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			setSortColumn(column);
			setSortDirection("asc");
		}
	};

	// Bulk delete users
	const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

	const handleBulkDelete = async () => {
		setIsLoading(true);
		try {
			await Promise.all(
				Array.from(selectedUserIds).map((userId) =>
					fetch(`/api/admin/users/${userId}`, {
						method: "DELETE",
						headers: {
							Authorization: `Bearer ${token}`,
						},
					})
				)
			);

			setSelectedUserIds(new Set());
			setIsAllSelected(false);
			setShowBulkDeleteDialog(false);
			await fetchUsers();
		} catch (error) {
			console.error("Failed to delete users:", error);
		} finally {
			setIsLoading(false);
		}
	};

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
		setUserToDelete(users.find((u) => u.id === userId) || null);
		setShowDeleteDialog(true);
	};

	const confirmDeleteUser = async () => {
		if (!userToDelete) return;

		try {
			const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				await fetchUsers();
				setShowDeleteDialog(false);
				setUserToDelete(null);
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
		<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">User List</h2>
					<p className="text-muted-foreground">Manage your users and their roles here.</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						onClick={() => setShowCreateModal(true)}
					>
						<Plus className="w-4 h-4 mr-2" />
						Add User
					</Button>
				</div>
			</div>

			<div className="flex flex-1 flex-col gap-4">
				{/* Toolbar */}
				<div className="flex items-center justify-between">
					<div className="flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2">
						<div className="relative">
							<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Filter users..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="h-8 w-[150px] lg:w-[250px] pl-8"
							/>
						</div>
						<div className="flex gap-x-2">
							{/* Status filter */}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm" className="h-8 border-dashed">
										<Filter className="mr-2 h-4 w-4" />
										Status
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start">
									<DropdownMenuItem onClick={() => setSelectedStatus("all")}>
										All Status
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setSelectedStatus("active")}>
										Active
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
							{/* Role filter */}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm" className="h-8 border-dashed">
										<Filter className="mr-2 h-4 w-4" />
										Role
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start">
									<DropdownMenuItem onClick={() => setSelectedRole("all")}>
										All Roles
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setSelectedRole("none")}>
										No Role
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									{roles.map((role) => (
										<DropdownMenuItem key={role.id} onClick={() => setSelectedRole(role.name)}>
											{role.name}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
					{/* Clear filters button */}
					{(searchQuery || selectedRole !== "all" || selectedStatus !== "all") && (
						<Button
							variant="ghost"
							size="sm"
							className="h-8"
							onClick={() => {
								setSearchQuery("");
								setSelectedRole("all");
								setSelectedStatus("all");
							}}
						>
							Clear
						</Button>
					)}
				</div>

				{/* Results count and bulk actions */}
				<div className="flex items-center justify-between">
					<div className="text-sm text-muted-foreground">
						{filteredAndSortedUsers.length} {filteredAndSortedUsers.length === 1 ? "user" : "users"} found
					</div>

					{/* Bulk actions bar */}
					{selectedUserIds.size > 0 && (
						<div className="flex items-center gap-2">
							<span className="text-sm text-muted-foreground">
								{selectedUserIds.size} {selectedUserIds.size === 1 ? "user" : "users"} selected
							</span>
							<Button
								variant="outline"
								size="sm"
								className="h-8"
								onClick={() => {
									setSelectedUserIds(new Set());
									setIsAllSelected(false);
								}}
							>
								Clear selection
							</Button>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm" className="h-8">
										Bulk Actions
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onClick={() => setShowBulkDeleteDialog(true)} className="text-destructive">
										<Trash2 className="mr-2 h-4 w-4" />
										Delete {selectedUserIds.size} {selectedUserIds.size === 1 ? "user" : "users"}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					)}
				</div>

				{/* Table */}
				<div className="overflow-hidden rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-12">
									<Checkbox
										checked={isAllSelected && filteredAndSortedUsers.length > 0}
										onCheckedChange={toggleAllUsers}
										aria-label="Select all users"
									/>
								</TableHead>
								<TableHead>
									<Button
										variant="ghost"
										size="sm"
										className="-ml-3 h-8 data-[state=open]:bg-accent"
										onClick={() => handleSort("name")}
									>
										Name
										{sortColumn === "name" && (
											<ArrowUpDown className="ml-2 h-4 w-4" />
										)}
									</Button>
								</TableHead>
								<TableHead>
									<Button
										variant="ghost"
										size="sm"
										className="-ml-3 h-8 data-[state=open]:bg-accent"
										onClick={() => handleSort("email")}
									>
										Email
										{sortColumn === "email" && (
											<ArrowUpDown className="ml-2 h-4 w-4" />
										)}
									</Button>
								</TableHead>
								<TableHead>
									<Button
										variant="ghost"
										size="sm"
										className="-ml-3 h-8 data-[state=open]:bg-accent"
										onClick={() => handleSort("role")}
									>
										Role
										{sortColumn === "role" && (
											<ArrowUpDown className="ml-2 h-4 w-4" />
										)}
									</Button>
								</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredAndSortedUsers.map((user) => (
								<TableRow key={user.id}>
									<TableCell>
										<Checkbox
											checked={selectedUserIds.has(user.id)}
											onCheckedChange={() => toggleUserSelection(user.id)}
											aria-label={`Select ${user.name}`}
										/>
									</TableCell>
									<TableCell className="font-medium">{user.name}</TableCell>
									<TableCell>{user.email}</TableCell>
									<TableCell>
										{user.role?.name ? (
											<span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary text-primary-foreground hover:bg-primary/80">
												{user.role.name}
											</span>
										) : (
											<span className="text-muted-foreground">No role</span>
										)}
									</TableCell>
									<TableCell className="text-right">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" className="h-8 w-8 p-0">
													<span className="sr-only">Open menu</span>
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem onClick={() => openEditModal(user)}>
													<Pencil className="mr-2 h-4 w-4" />
													Edit
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													onClick={() => handleDeleteUser(user.id)}
													className="text-destructive focus:text-destructive"
												>
													<Trash2 className="mr-2 h-4 w-4" />
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))}
							{filteredAndSortedUsers.length === 0 && (
								<TableRow>
									<TableCell colSpan={5} className="h-24 text-center">
										{users.length === 0 ? (
											"No users found. Create your first user to get started."
										) : (
											"No users match your filters."
										)}
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</div>

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

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete User</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete the user <strong>"{userToDelete?.name}"</strong> ({userToDelete?.email})? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={confirmDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Bulk Delete Confirmation Dialog */}
			<AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Users</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete <strong>{selectedUserIds.size} users</strong>? This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => setShowBulkDeleteDialog(false)}>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
