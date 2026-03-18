"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Shield,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  Info,
  X,
} from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/Table";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/ui/Badge";

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
    description: "Control user and team access",
  },
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
  {
    id: "user_read",
    category: "User",
    name: "Read",
    description: "View user information",
  },
  {
    id: "user_create",
    category: "User",
    name: "Create",
    description: "Create new users",
  },
  {
    id: "user_update",
    category: "User",
    name: "Update",
    description: "Modify user settings",
  },
  {
    id: "user_delete",
    category: "User",
    name: "Delete",
    description: "Remove users",
  },
  {
    id: "team_read",
    category: "Team",
    name: "Read",
    description: "View team information",
  },
  {
    id: "team_create",
    category: "Team",
    name: "Create",
    description: "Create new teams",
  },
  {
    id: "team_update",
    category: "Team",
    name: "Update",
    description: "Modify team settings",
  },
  {
    id: "team_delete",
    category: "Team",
    name: "Delete",
    description: "Remove teams",
  },
  {
    id: "role_read",
    category: "Role",
    name: "Read",
    description: "View role information",
  },
  {
    id: "role_create",
    category: "Role",
    name: "Create",
    description: "Create new roles",
  },
  {
    id: "role_update",
    category: "Role",
    name: "Update",
    description: "Modify role permissions",
  },
  {
    id: "role_delete",
    category: "Role",
    name: "Delete",
    description: "Remove roles",
  },
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
      description:
        "Operational Control of all existing resources in an environment",
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
      if (!grouped[perm.category]) grouped[perm.category] = [];
      grouped[perm.category].push(perm);
    });
    return grouped;
  }, []);

  const handleCreateRole = () => {
    if (!formData.name.trim()) return;
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
    if (!selectedRole || !formData.name.trim()) return;
    const updatedRoles = roles.map((r) =>
      r.id === selectedRole.id ? { ...r, ...formData } : r,
    );
    setRoles(updatedRoles);
    showNotification({
      type: "success",
      message: "Role updated",
      description: "Role has been updated successfully.",
    });
  };

  const handleDeleteRole = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete the role ${name}?`)) {
      setRoles(roles.filter((r) => r.id !== id));
      if (selectedRole?.id === id) {
        setSelectedRole(null);
        setFormData({ name: "", description: "", permissions: [] });
      }
      showNotification({
        type: "error",
        message: "Role deleted",
        description: "Role has been removed successfully.",
      });
    }
  };

  const togglePermission = (permId: string) => {
    const newPermissions = formData.permissions.includes(permId)
      ? formData.permissions.filter((p) => p !== permId)
      : [...formData.permissions, permId];
    setFormData({ ...formData, permissions: newPermissions });
  };

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) newExpanded.delete(category);
    else newExpanded.add(category);
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
        ...new Set([...formData.permissions, ...categoryPerms]),
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Shield className="h-6 w-6 text-indigo-500" />
            Roles
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Define RBAC user permissions for system and host access.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" size="md" onClick={startCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Role
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <div className="w-full">
            <Input
              icon={<Search className="h-4 w-4 text-zinc-400" />}
              placeholder="Search roles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
            <div className="max-h-150 overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role Definition</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoles.map((role) => (
                    <TableRow
                      key={role.id}
                      onClick={() => startEdit(role)}
                      className={cn(
                        "cursor-pointer group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors",
                        selectedRole?.id === role.id &&
                          "bg-indigo-50 dark:bg-zinc-800",
                      )}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                selectedRole?.id === role.id
                                  ? "text-indigo-600 dark:text-indigo-400"
                                  : "text-zinc-900 dark:text-zinc-100",
                              )}
                            >
                              {role.name}
                            </span>
                            {role.isSystem && (
                              <Badge variant="outline">System</Badge>
                            )}
                          </div>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                            {role.description}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {!role.isSystem && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) =>
                              handleDeleteRole(role.id, role.name, e)
                            }
                            className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm flex flex-col h-175">
          {selectedRole || isCreating ? (
            <>
              <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-[#121212]">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Edit2 size={16} className="text-indigo-500" />
                  {isCreating
                    ? "Draft New Role"
                    : `Edit Role: ${selectedRole?.name}`}
                </h2>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedRole(null);
                  }}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md transition-colors p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                <div>
                  <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5 block">
                    Name
                  </label>
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    disabled={selectedRole?.isSystem}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5 block">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    disabled={selectedRole?.isSystem}
                    className="w-full bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3 block">
                    Role Permissions
                  </label>
                  <div className="space-y-3">
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
                            className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden bg-zinc-50/30 dark:bg-zinc-900/10"
                          >
                            <div
                              className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                              onClick={() => toggleCategory(category)}
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown
                                    size={14}
                                    className="text-zinc-500"
                                  />
                                ) : (
                                  <ChevronRight
                                    size={14}
                                    className="text-zinc-500"
                                  />
                                )}
                                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                  {category}
                                </span>
                                {someSelected && (
                                  <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 px-1.5 py-0.5 rounded-full font-medium">
                                    {
                                      categoryPerms.filter((p) =>
                                        formData.permissions.includes(p),
                                      ).length
                                    }{" "}
                                    / {categoryPerms.length}
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
                                  "text-[10px] font-medium px-2 py-1 rounded transition-colors",
                                  allSelected
                                    ? "text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/20"
                                    : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 focus:outline-none",
                                  selectedRole?.isSystem &&
                                    "opacity-50 cursor-not-allowed",
                                )}
                              >
                                {allSelected ? "CLEAR" : "ALL"}
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="border-t border-zinc-200 dark:border-zinc-800 p-2 space-y-1 bg-white dark:bg-[#121212]">
                                {perms.map((perm) => (
                                  <label
                                    key={perm.id}
                                    className="flex items-start gap-3 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 rounded cursor-pointer transition-colors"
                                  >
                                    <div className="pt-0.5">
                                      <input
                                        type="checkbox"
                                        checked={formData.permissions.includes(
                                          perm.id,
                                        )}
                                        onChange={() =>
                                          togglePermission(perm.id)
                                        }
                                        disabled={selectedRole?.isSystem}
                                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-600 dark:focus:ring-indigo-500 disabled:opacity-50"
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                        {perm.name}
                                      </div>
                                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug mt-0.5">
                                        {perm.description}
                                      </div>
                                    </div>
                                  </label>
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
                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg">
                    <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      This is a predefined system role and cannot be modified.
                      You can view its permission details visually above.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2 bg-zinc-50/50 dark:bg-[#121212] rounded-b-xl">
                {!selectedRole?.isSystem && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreating(false);
                        setSelectedRole(null);
                      }}
                    >
                      Discard
                    </Button>
                    <Button
                      variant="primary"
                      disabled={!formData.name.trim()}
                      onClick={isCreating ? handleCreateRole : handleUpdateRole}
                      className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white"
                    >
                      {isCreating ? "Save Role" : "Update Role"}
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400 dark:text-zinc-500">
              <Shield size={48} className="mb-4 opacity-20" />
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-300 mb-1">
                Configuration Inspector
              </h3>
              <p className="text-xs max-w-62.5">
                Select a role from the left to view or edit permissions, or
                generate a new one.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
