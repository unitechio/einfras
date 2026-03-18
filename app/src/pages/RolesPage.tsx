"use client";

import { useState, useMemo } from "react";
import {
    Search,
    X,
    Plus,
    AlertTriangle,
    Shield,
    ChevronDown,
    ChevronRight,
    Edit2,
    Trash2,
    Check,
    Info,
} from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { cn } from "@/lib/utils";

interface Permission {
    id: string;
    category: string;
    name: string;
    description: string;
}

interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    isSystem?: boolean;
}

const AVAILABLE_PERMISSIONS: Permission[] = [
    // Environment Permissions
    {
        id: "env_read",
        category: "Environment",
        name: "Read",
        description: "View environment details and resources",
    },
    {
        id: "env_create",
        category: "Environment",
        name: "Create",
        description: "Create new environments",
    },
    {
        id: "env_update",
        category: "Environment",
        name: "Update",
        description: "Modify environment settings",
    },
    {
        id: "env_delete",
        category: "Environment",
        name: "Delete",
        description: "Remove environments",
    },
    {
        id: "env_manage_access",
        category: "Environment",
        name: "Manage Access",
        description: "Control user and team access to environments",
    },

    // Container Permissions
    {
        id: "container_read",
        category: "Container",
        name: "Read",
        description: "View container information",
    },
    {
        id: "container_create",
        category: "Container",
        name: "Create",
        description: "Deploy new containers",
    },
    {
        id: "container_start_stop",
        category: "Container",
        name: "Start/Stop",
        description: "Control container lifecycle",
    },
    {
        id: "container_delete",
        category: "Container",
        name: "Delete",
        description: "Remove containers",
    },
    {
        id: "container_exec",
        category: "Container",
        name: "Execute Commands",
        description: "Run commands inside containers",
    },
    {
        id: "container_logs",
        category: "Container",
        name: "View Logs",
        description: "Access container logs",
    },

    // Image Permissions
    {
        id: "image_read",
        category: "Image",
        name: "Read",
        description: "View image information",
    },
    {
        id: "image_pull",
        category: "Image",
        name: "Pull",
        description: "Download images from registries",
    },
    {
        id: "image_push",
        category: "Image",
        name: "Push",
        description: "Upload images to registries",
    },
    {
        id: "image_delete",
        category: "Image",
        name: "Delete",
        description: "Remove images",
    },

    // Volume Permissions
    {
        id: "volume_read",
        category: "Volume",
        name: "Read",
        description: "View volume information",
    },
    {
        id: "volume_create",
        category: "Volume",
        name: "Create",
        description: "Create new volumes",
    },
    {
        id: "volume_delete",
        category: "Volume",
        name: "Delete",
        description: "Remove volumes",
    },
    {
        id: "volume_browse",
        category: "Volume",
        name: "Browse",
        description: "Browse volume contents",
    },

    // Network Permissions
    {
        id: "network_read",
        category: "Network",
        name: "Read",
        description: "View network information",
    },
    {
        id: "network_create",
        category: "Network",
        name: "Create",
        description: "Create new networks",
    },
    {
        id: "network_delete",
        category: "Network",
        name: "Delete",
        description: "Remove networks",
    },

    // Stack Permissions
    {
        id: "stack_read",
        category: "Stack",
        name: "Read",
        description: "View stack information",
    },
    {
        id: "stack_create",
        category: "Stack",
        name: "Create",
        description: "Deploy new stacks",
    },
    {
        id: "stack_update",
        category: "Stack",
        name: "Update",
        description: "Modify stack configurations",
    },
    {
        id: "stack_delete",
        category: "Stack",
        name: "Delete",
        description: "Remove stacks",
    },

    // User Management Permissions
    {
        id: "user_read",
        category: "User Management",
        name: "Read",
        description: "View user information",
    },
    {
        id: "user_create",
        category: "User Management",
        name: "Create",
        description: "Create new users",
    },
    {
        id: "user_update",
        category: "User Management",
        name: "Update",
        description: "Modify user settings",
    },
    {
        id: "user_delete",
        category: "User Management",
        name: "Delete",
        description: "Remove users",
    },

    // Team Management Permissions
    {
        id: "team_read",
        category: "Team Management",
        name: "Read",
        description: "View team information",
    },
    {
        id: "team_create",
        category: "Team Management",
        name: "Create",
        description: "Create new teams",
    },
    {
        id: "team_update",
        category: "Team Management",
        name: "Update",
        description: "Modify team settings",
    },
    {
        id: "team_delete",
        category: "Team Management",
        name: "Delete",
        description: "Remove teams",
    },

    // Role Management Permissions
    {
        id: "role_read",
        category: "Role Management",
        name: "Read",
        description: "View role information",
    },
    {
        id: "role_create",
        category: "Role Management",
        name: "Create",
        description: "Create new roles",
    },
    {
        id: "role_update",
        category: "Role Management",
        name: "Update",
        description: "Modify role permissions",
    },
    {
        id: "role_delete",
        category: "Role Management",
        name: "Delete",
        description: "Remove roles",
    },

    // Settings Permissions
    {
        id: "settings_read",
        category: "Settings",
        name: "Read",
        description: "View system settings",
    },
    {
        id: "settings_update",
        category: "Settings",
        name: "Update",
        description: "Modify system settings",
    },

    // Registry Permissions
    {
        id: "registry_read",
        category: "Registry",
        name: "Read",
        description: "View registry information",
    },
    {
        id: "registry_create",
        category: "Registry",
        name: "Create",
        description: "Add new registries",
    },
    {
        id: "registry_update",
        category: "Registry",
        name: "Update",
        description: "Modify registry settings",
    },
    {
        id: "registry_delete",
        category: "Registry",
        name: "Delete",
        description: "Remove registries",
    },
];

export default function RolesPage() {
    const { showNotification } = useNotification();

    const [roles, setRoles] = useState<Role[]>([
        {
            id: "1",
            name: "Environment administrator",
            description: "Full control of all resources in an environment",
            permissions: [
                "env_read",
                "env_update",
                "container_read",
                "container_create",
                "container_start_stop",
                "container_delete",
                "container_exec",
                "container_logs",
                "image_read",
                "image_pull",
                "image_push",
                "image_delete",
                "volume_read",
                "volume_create",
                "volume_delete",
                "volume_browse",
                "network_read",
                "network_create",
                "network_delete",
                "stack_read",
                "stack_create",
                "stack_update",
                "stack_delete",
            ],
            isSystem: true,
        },
        {
            id: "2",
            name: "Operator",
            description: "Operational Control of all existing resources in an environment",
            permissions: [
                "env_read",
                "container_read",
                "container_start_stop",
                "container_logs",
                "image_read",
                "volume_read",
                "volume_browse",
                "network_read",
                "stack_read",
            ],
            isSystem: true,
        },
        {
            id: "3",
            name: "Helpdesk",
            description: "Read-only access of all resources in an environment",
            permissions: [
                "env_read",
                "container_read",
                "container_logs",
                "image_read",
                "volume_read",
                "network_read",
                "stack_read",
            ],
            isSystem: true,
        },
        {
            id: "4",
            name: "Read-only user",
            description: "Read-only access of assigned resources in an environment",
            permissions: ["env_read", "container_read", "image_read"],
            isSystem: true,
        },
        {
            id: "5",
            name: "Standard user",
            description: "Full control of assigned resources in an environment",
            permissions: [
                "env_read",
                "container_read",
                "container_create",
                "container_start_stop",
                "container_delete",
                "container_logs",
                "image_read",
                "image_pull",
                "volume_read",
                "volume_create",
                "network_read",
                "stack_read",
                "stack_create",
                "stack_update",
            ],
            isSystem: true,
        },
    ]);

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        permissions: [] as string[],
    });

    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
        new Set(),
    );

    const filteredRoles = useMemo(() => {
        return roles.filter((r) =>
            r.name.toLowerCase().includes(searchTerm.toLowerCase()),
        );
    }, [roles, searchTerm]);

    const permissionsByCategory = useMemo(() => {
        const grouped: Record<string, Permission[]> = {};
        AVAILABLE_PERMISSIONS.forEach((perm) => {
            if (!grouped[perm.category]) {
                grouped[perm.category] = [];
            }
            grouped[perm.category].push(perm);
        });
        return grouped;
    }, []);

    const handleCreateRole = () => {
        if (!formData.name.trim()) {
            showNotification({
                type: "error",
                message: "Validation Error",
                description: "Role name is required",
            });
            return;
        }

        const newRole: Role = {
            id: Math.random().toString(36).substr(2, 9),
            name: formData.name,
            description: formData.description,
            permissions: formData.permissions,
            isSystem: false,
        };

        setRoles([...roles, newRole]);
        setFormData({ name: "", description: "", permissions: [] });
        setIsCreating(false);

        showNotification({
            type: "success",
            message: "Role created",
            description: `Role ${newRole.name} has been created successfully.`,
        });
    };

    const handleUpdateRole = () => {
        if (!selectedRole) return;

        const updatedRoles = roles.map((r) =>
            r.id === selectedRole.id
                ? { ...r, name: formData.name, description: formData.description, permissions: formData.permissions }
                : r,
        );

        setRoles(updatedRoles);
        setSelectedRole(null);

        showNotification({
            type: "success",
            message: "Role updated",
            description: "Role has been updated successfully.",
        });
    };

    const handleDeleteRole = () => {
        if (!roleToDelete) return;

        setRoles(roles.filter((r) => r.id !== roleToDelete.id));
        setRoleToDelete(null);
        setShowDeleteConfirm(false);

        showNotification({
            type: "success",
            message: "Role deleted",
            description: "Role has been removed successfully.",
        });
    };

    const togglePermission = (permId: string) => {
        const newPermissions = formData.permissions.includes(permId)
            ? formData.permissions.filter((p) => p !== permId)
            : [...formData.permissions, permId];
        setFormData({ ...formData, permissions: newPermissions });
    };

    const toggleCategory = (category: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(category)) {
            newExpanded.delete(category);
        } else {
            newExpanded.add(category);
        }
        setExpandedCategories(newExpanded);
    };

    const selectAllInCategory = (category: string) => {
        const categoryPerms = permissionsByCategory[category].map((p) => p.id);
        const allSelected = categoryPerms.every((p) =>
            formData.permissions.includes(p),
        );

        if (allSelected) {
            setFormData({
                ...formData,
                permissions: formData.permissions.filter(
                    (p) => !categoryPerms.includes(p),
                ),
            });
        } else {
            const newPerms = [
                ...formData.permissions,
                ...categoryPerms.filter((p) => !formData.permissions.includes(p)),
            ];
            setFormData({ ...formData, permissions: newPerms });
        }
    };

    const startEdit = (role: Role) => {
        setSelectedRole(role);
        setFormData({
            name: role.name,
            description: role.description,
            permissions: role.permissions,
        });
        setIsCreating(false);
    };

    const startCreate = () => {
        setIsCreating(true);
        setSelectedRole(null);
        setFormData({ name: "", description: "", permissions: [] });
    };

    const cancelEdit = () => {
        setSelectedRole(null);
        setIsCreating(false);
        setFormData({ name: "", description: "", permissions: [] });
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <Shield size={20} /> Roles
                </h1>
                <button
                    onClick={startCreate}
                    className="flex items-center gap-2 px-4 py-2 rounded text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-all"
                >
                    <Plus size={14} /> Create new role
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Roles List */}
                <div className="bg-[#1c1c1c] border border-gray- rounded-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-[#121212] border border-gray- rounded px-8 py-2 text-xs text-gray- focus:border-gray- outline-none transition-all"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray- hover:text-white"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="overflow-y-auto max-h-[600px]">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 bg-[#1c1c1c]">
                                <tr className="border-b border-gray- text-left">
                                    <th className="px-4 py-3 text-xs font-bold text-gray- uppercase">
                                        Name <span className="inline-block ml-1">↑↓</span>
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray- uppercase">
                                        Description <span className="inline-block ml-1">↑↓</span>
                                    </th>
                                    <th className="px-4 py-3 w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-/50">
                                {filteredRoles.map((role) => (
                                    <tr
                                        key={role.id}
                                        className={cn(
                                            "hover:bg-gray-/30 transition-colors cursor-pointer",
                                            selectedRole?.id === role.id ? "bg-blue-900/20" : "",
                                        )}
                                        onClick={() => startEdit(role)}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-blue-400">
                                                    {role.name}
                                                </span>
                                                {role.isSystem && (
                                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-gray- text-gray- rounded">
                                                        SYSTEM
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs text-gray-">
                                                {role.description}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {!role.isSystem && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRoleToDelete(role);
                                                        setShowDeleteConfirm(true);
                                                    }}
                                                    className="text-red-500 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Role Editor */}
                <div className="bg-[#1c1c1c] border border-gray- rounded-sm overflow-hidden">
                    {(selectedRole || isCreating) ? (
                        <div className="h-full flex flex-col">
                            <div className="px-4 py-3 border-b border-gray- flex items-center justify-between">
                                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                    <Edit2 size={14} />
                                    {isCreating ? "Create New Role" : `Edit Role: ${selectedRole?.name}`}
                                </h2>
                                <button
                                    onClick={cancelEdit}
                                    className="text-gray- hover:text-white transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-white mb-2 block">
                                        Name<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) =>
                                            setFormData({ ...formData, name: e.target.value })
                                        }
                                        disabled={selectedRole?.isSystem}
                                        className="w-full bg-[#121212] border border-gray- rounded px-3 py-2 text-sm text-gray- focus:border-gray- outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-white mb-2 block">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) =>
                                            setFormData({ ...formData, description: e.target.value })
                                        }
                                        disabled={selectedRole?.isSystem}
                                        rows={3}
                                        className="w-full bg-[#121212] border border-gray- rounded px-3 py-2 text-sm text-gray- focus:border-gray- outline-none transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-white mb-2 block">
                                        Permissions
                                    </label>
                                    <div className="space-y-2">
                                        {Object.entries(permissionsByCategory).map(
                                            ([category, perms]) => {
                                                const categoryPerms = perms.map((p) => p.id);
                                                const allSelected = categoryPerms.every((p) =>
                                                    formData.permissions.includes(p),
                                                );
                                                const someSelected = categoryPerms.some((p) =>
                                                    formData.permissions.includes(p),
                                                );
                                                const isExpanded = expandedCategories.has(category);

                                                return (
                                                    <div
                                                        key={category}
                                                        className="bg-[#121212] border border-gray- rounded overflow-hidden"
                                                    >
                                                        <div
                                                            className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-/30 transition-colors"
                                                            onClick={() => toggleCategory(category)}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                {isExpanded ? (
                                                                    <ChevronDown size={14} className="text-gray-" />
                                                                ) : (
                                                                    <ChevronRight size={14} className="text-gray-" />
                                                                )}
                                                                <span className="text-xs font-bold text-white">
                                                                    {category}
                                                                </span>
                                                                {someSelected && (
                                                                    <span className="text-[10px] text-blue-400">
                                                                        ({categoryPerms.filter((p) => formData.permissions.includes(p)).length}/{categoryPerms.length})
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    selectAllInCategory(category);
                                                                }}
                                                                disabled={selectedRole?.isSystem}
                                                                className={cn(
                                                                    "text-[10px] font-bold px-2 py-1 rounded transition-colors",
                                                                    allSelected
                                                                        ? "bg-blue-600 text-white"
                                                                        : "bg-gray- text-gray- hover:bg-gray-",
                                                                    selectedRole?.isSystem && "opacity-50 cursor-not-allowed"
                                                                )}
                                                            >
                                                                {allSelected ? "Deselect All" : "Select All"}
                                                            </button>
                                                        </div>

                                                        {isExpanded && (
                                                            <div className="border-t border-gray- p-2 space-y-1">
                                                                {perms.map((perm) => (
                                                                    <div
                                                                        key={perm.id}
                                                                        className="flex items-start gap-2 p-2 hover:bg-gray-/30 rounded transition-colors"
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={formData.permissions.includes(
                                                                                perm.id,
                                                                            )}
                                                                            onChange={() => togglePermission(perm.id)}
                                                                            disabled={selectedRole?.isSystem}
                                                                            className="w-4 h-4 mt-0.5 rounded border-gray- bg-[#121212] accent-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        />
                                                                        <div className="flex-1">
                                                                            <div className="text-xs font-bold text-white">
                                                                                {perm.name}
                                                                            </div>
                                                                            <div className="text-[10px] text-gray-">
                                                                                {perm.description}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            },
                                        )}
                                    </div>
                                </div>

                                {selectedRole?.isSystem && (
                                    <div className="flex items-start gap-2 p-3 bg-blue-900/20 border border-blue-800/30 rounded">
                                        <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
                                        <p className="text-xs text-blue-300">
                                            This is a system role and cannot be modified. You can create a new role based on this configuration.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="px-4 py-3 border-t border-gray- flex justify-end gap-2">
                                <button
                                    onClick={cancelEdit}
                                    className="px-4 py-2 rounded text-xs font-bold text-gray- hover:text-white hover:bg-gray- transition-all"
                                >
                                    Cancel
                                </button>
                                {!selectedRole?.isSystem && (
                                    <button
                                        onClick={isCreating ? handleCreateRole : handleUpdateRole}
                                        disabled={!formData.name.trim()}
                                        className={cn(
                                            "px-6 py-2 rounded text-xs font-bold transition-all flex items-center gap-2",
                                            formData.name.trim()
                                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                                : "bg-gray- text-gray- cursor-not-allowed border border-gray-",
                                        )}
                                    >
                                        <Check size={14} />
                                        {isCreating ? "Create Role" : "Update Role"}
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center p-8">
                            <div className="text-center text-gray-">
                                <Shield size={48} className="mx-auto mb-4 opacity-50" />
                                <p className="text-sm">Select a role to edit or create a new one</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && roleToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#1c1c1c] border border-gray- rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 bg-gray-/50 border-b border-gray- flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <AlertTriangle className="text-red-500" size={20} /> Confirm
                                Deletion
                            </h2>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="text-gray- hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-gray- text-sm leading-relaxed">
                                Are you sure you want to delete the role{" "}
                                <span className="text-white font-bold">{roleToDelete.name}</span>
                                ? This action cannot be undone.
                            </p>
                        </div>
                        <div className="px-6 py-4 bg-gray-/30 border-t border-gray- flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 rounded text-xs font-bold text-gray- hover:text-white hover:bg-gray- transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteRole}
                                className="px-6 py-2 rounded text-xs font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-900/20 transition-all"
                            >
                                Delete role
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

