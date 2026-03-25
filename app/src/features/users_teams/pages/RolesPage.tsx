"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Info,
  Plus,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/Table";
import { usersTeamsApi, type RoleRecord } from "../api";

type RoleSortKey = "name" | "slug" | "is_system";

type Permission = {
  id: string;
  category: string;
  name: string;
  description: string;
};

type RoleFormState = {
  name: string;
  slug: string;
  description: string;
  permissions: string[];
};

const emptyForm: RoleFormState = {
  name: "",
  slug: "",
  description: "",
  permissions: [],
};

const availablePermissions: Permission[] = [
  { id: "server:read", category: "Server", name: "Read", description: "View server inventory and details" },
  { id: "server:write", category: "Server", name: "Write", description: "Create and update servers" },
  { id: "server:delete", category: "Server", name: "Delete", description: "Delete servers" },
  { id: "server:execute", category: "Server", name: "Execute", description: "SSH and terminal actions" },
  { id: "firewall:read", category: "Firewall", name: "Read", description: "View firewall rules" },
  { id: "firewall:write", category: "Firewall", name: "Write", description: "Create and update firewall rules" },
  { id: "firewall:delete", category: "Firewall", name: "Delete", description: "Delete firewall rules" },
  { id: "ssh_key:read", category: "SSH", name: "Read", description: "View SSH keys and access records" },
  { id: "ssh_key:write", category: "SSH", name: "Write", description: "Manage SSH keys" },
  { id: "ssh_key:execute", category: "SSH", name: "Execute", description: "Use SSH access to a resource" },
  { id: "audit_log:read", category: "Audit", name: "Read", description: "Read audit logs" },
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function RolesPage() {
  const { showNotification } = useNotification();
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalRoles, setTotalRoles] = useState(0);
  const [systemFilter, setSystemFilter] = useState("");
  const [sortBy, setSortBy] = useState<RoleSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Server", "Firewall"]));
  const [form, setForm] = useState<RoleFormState>(emptyForm);
  const [deleteCandidate, setDeleteCandidate] = useState<RoleRecord | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void loadRoles();
  }, [page, searchTerm, systemFilter, sortBy, sortDir]);

  const selectedRole = useMemo(
    () => roles.find((item) => item.id === selectedRoleId) ?? null,
    [selectedRoleId, roles],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalRoles / 10)),
    [totalRoles],
  );

  const permissionsByCategory = useMemo(() => {
    return availablePermissions.reduce<Record<string, Permission[]>>((acc, permission) => {
      acc[permission.category] ??= [];
      acc[permission.category].push(permission);
      return acc;
    }, {});
  }, []);

  async function loadRoles() {
    setIsLoading(true);
    try {
      const result = await usersTeamsApi.listRoles({
        page,
        page_size: 10,
        search: searchTerm,
        system: systemFilter === "" ? undefined : systemFilter === "true",
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      setRoles(result.items);
      setTotalRoles(result.meta?.total ?? result.items.length);
      if (!selectedRoleId && result.items[0]) {
        applyRoleToForm(result.items[0]);
      }
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to load roles",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function applyRoleToForm(role: RoleRecord) {
    setSelectedRoleId(role.id);
    setIsCreating(false);
    setForm({
      name: role.name,
      slug: role.slug,
      description: role.description,
      permissions: [...role.permissions],
    });
  }

  function startCreate() {
    setSelectedRoleId(null);
    setIsCreating(true);
    setForm(emptyForm);
  }

  function togglePermission(permissionID: string) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permissionID)
        ? current.permissions.filter((item) => item !== permissionID)
        : [...current.permissions, permissionID],
    }));
  }

  function toggleCategory(category: string) {
    setExpandedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function toggleAllInCategory(category: string) {
    const categoryIDs = permissionsByCategory[category].map((permission) => permission.id);
    const allSelected = categoryIDs.every((permissionID) => form.permissions.includes(permissionID));
    setForm((current) => ({
      ...current,
      permissions: allSelected
        ? current.permissions.filter((permissionID) => !categoryIDs.includes(permissionID))
        : [...new Set([...current.permissions, ...categoryIDs])],
    }));
  }

  function handleSort(nextSortBy: RoleSortKey) {
    setPage(1);
    if (sortBy === nextSortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(nextSortBy);
    setSortDir("asc");
  }

  function renderSortIcon(column: RoleSortKey) {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5" />;
    }
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  }

  async function handleSubmit() {
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description.trim(),
      permissions: [...form.permissions].sort(),
    };
    if (!payload.name || !payload.slug) {
      showNotification({
        type: "error",
        message: "Missing role fields",
        description: "Role name and slug are required.",
      });
      return;
    }
    setIsSaving(true);
    try {
      if (isCreating) {
        const created = await usersTeamsApi.createRole(payload);
        setRoles((current) => [...current, created]);
        applyRoleToForm(created);
        showNotification({
          type: "success",
          message: "Role created",
          description: `${created.name} has been added.`,
        });
      } else if (selectedRole) {
        const updated = await usersTeamsApi.updateRole(selectedRole.id, payload);
        setRoles((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        applyRoleToForm(updated);
        showNotification({
          type: "success",
          message: "Role updated",
          description: `${updated.name} permissions were saved.`,
        });
      }
    } catch (err) {
      showNotification({
        type: "error",
        message: isCreating ? "Unable to create role" : "Unable to update role",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(role: RoleRecord) {
    try {
      await usersTeamsApi.deleteRole(role.id);
      const nextRoles = roles.filter((item) => item.id !== role.id);
      setRoles(nextRoles);
      if (selectedRoleId === role.id) {
        if (nextRoles[0]) {
          applyRoleToForm(nextRoles[0]);
        } else {
          startCreate();
        }
      }
      showNotification({
        type: "success",
        message: "Role deleted",
        description: `${role.name} was removed.`,
      });
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to delete role",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <>
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            <Shield className="h-6 w-6 text-indigo-500" />
            Roles
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Define reusable permission bundles without hardcoding access in product logic.
          </p>
        </div>
        <Button variant="primary" onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Input
              icon={<Search className="h-4 w-4 text-zinc-400" />}
              placeholder="Search roles"
              value={searchInput}
              onChange={(event) => {
                setPage(1);
                setSearchInput(event.target.value);
              }}
            />
            <select
              value={systemFilter}
              onChange={(event) => {
                setPage(1);
                setSystemFilter(event.target.value);
              }}
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100"
            >
              <option value="">All roles</option>
              <option value="true">System</option>
              <option value="false">Custom</option>
            </select>
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-300">
              {totalRoles} roles
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-300">
              {roles.filter((item) => item.is_system).length} system
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button type="button" onClick={() => handleSort("name")} className="inline-flex items-center gap-1 text-left">
                      Role
                      {renderSortIcon("name")}
                    </button>
                  </TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">
                    <button type="button" onClick={() => handleSort("is_system")} className="ml-auto inline-flex items-center gap-1 text-left">
                      Type
                      {renderSortIcon("is_system")}
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-40 text-center text-zinc-500">
                      Loading roles...
                    </TableCell>
                  </TableRow>
                ) : roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-40 text-center text-zinc-500">
                      No roles found.
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => (
                    <TableRow
                      key={role.id}
                      onClick={() => applyRoleToForm(role)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40",
                        selectedRoleId === role.id && "bg-indigo-50 dark:bg-zinc-900/70",
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {role.name}
                          </span>
                          {role.is_system ? <Badge variant="outline">System</Badge> : null}
                        </div>
                        <div className="text-xs text-zinc-500">{role.slug}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {role.description || "No description"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{role.permissions.length} permissions</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant={role.is_system ? "outline" : "default"}>
                            {role.is_system ? "System" : "Custom"}
                          </Badge>
                          {!role.is_system ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                              onClick={(event) => {
                                event.stopPropagation();
                            setDeleteCandidate(role);
                          }}
                            >
                              <Trash2 size={14} />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="border-b border-zinc-200 bg-zinc-50/70 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/30">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
              {isCreating ? "Create role" : selectedRole ? `Edit ${selectedRole.name}` : "Select a role"}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Bundle resource permissions for admin, devops and custom tenant personas.
            </p>
          </div>

          <div className="space-y-5 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Role name
                </label>
                <Input
                  value={form.name}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setForm((current) => ({
                      ...current,
                      name: nextName,
                      slug:
                        isCreating || current.slug === slugify(current.name)
                          ? slugify(nextName)
                          : current.slug,
                    }));
                  }}
                  disabled={selectedRole?.is_system}
                  placeholder="Platform Operator"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Slug
                </label>
                <Input
                  value={form.slug}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, slug: slugify(event.target.value) }))
                  }
                  disabled={selectedRole?.is_system}
                  placeholder="platform-operator"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Description
              </label>
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                disabled={selectedRole?.is_system}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                placeholder="Can operate staging and production resources with execution access."
              />
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Permission matrix
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Resource + action grants used by the backend permission engine.
                </p>
              </div>
              <div className="space-y-3">
                {Object.entries(permissionsByCategory).map(([category, items]) => {
                  const categoryIDs = items.map((permission) => permission.id);
                  const selectedCount = categoryIDs.filter((permissionID) =>
                    form.permissions.includes(permissionID),
                  ).length;
                  const expanded = expandedCategories.has(category);
                  return (
                    <div
                      key={category}
                      className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
                    >
                      <div
                        className="flex cursor-pointer items-center justify-between bg-zinc-50/70 px-4 py-3 transition hover:bg-zinc-100 dark:bg-zinc-900/20 dark:hover:bg-zinc-900/40"
                        onClick={() => toggleCategory(category)}
                      >
                        <div className="flex items-center gap-2">
                          {expanded ? (
                            <ChevronDown className="h-4 w-4 text-zinc-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-zinc-500" />
                          )}
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {category}
                          </span>
                          <Badge variant="outline">
                            {selectedCount}/{categoryIDs.length}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={selectedRole?.is_system}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleAllInCategory(category);
                          }}
                        >
                          {selectedCount === categoryIDs.length ? "Clear" : "Select all"}
                        </Button>
                      </div>
                      {expanded ? (
                        <div className="grid gap-2 p-3 md:grid-cols-2">
                          {items.map((permission) => (
                            <label
                              key={permission.id}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition-colors",
                                form.permissions.includes(permission.id)
                                  ? "border-indigo-400 bg-indigo-50/80 dark:border-indigo-500/40 dark:bg-indigo-500/10"
                                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
                                selectedRole?.is_system && "cursor-not-allowed opacity-70",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={form.permissions.includes(permission.id)}
                                onChange={() => togglePermission(permission.id)}
                                disabled={selectedRole?.is_system}
                                className="mt-1 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div>
                                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                  {permission.name}
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {permission.description}
                                </div>
                                <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                  {permission.id}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedRole?.is_system ? (
              <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                System roles are seeded by the platform and remain read-only in the UI. You can inspect permissions here, but editing is intentionally blocked.
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-200 bg-zinc-50/70 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/30">
            <div className="mr-auto flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Previous
              </Button>
              <span>
                Page {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                Next
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedRole) {
                  applyRoleToForm(selectedRole);
                  return;
                }
                startCreate();
              }}
            >
              Reset form
            </Button>
            {!selectedRole?.is_system ? (
              <Button variant="primary" onClick={() => void handleSubmit()} isLoading={isSaving}>
                {isCreating ? "Create Role" : "Save Changes"}
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    </div>
    <ConfirmActionDialog
      open={!!deleteCandidate}
      title="Delete role?"
      description={deleteCandidate ? `This permanently removes role ${deleteCandidate.name} and its permission bundle.` : ""}
      confirmLabel="Delete Role"
      onClose={() => setDeleteCandidate(null)}
      onConfirm={() => {
        if (!deleteCandidate) return;
        void handleDelete(deleteCandidate).finally(() => setDeleteCandidate(null));
      }}
      pending={false}
      tone="danger"
    />
    </>
  );
}
