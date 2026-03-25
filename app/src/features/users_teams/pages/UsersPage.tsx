"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  KeyRound,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCog,
  Users as UsersIcon,
  XCircle,
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
import {
  usersTeamsApi,
  type RoleRecord,
  type TeamRecord,
  type UserRecord,
} from "../api";

type UserSortKey = "name" | "email" | "status" | "created_at";

type UserFormState = {
  username: string;
  email: string;
  full_name: string;
  password: string;
  roles: string[];
  team_ids: string[];
  is_active: boolean;
};

const emptyForm: UserFormState = {
  username: "",
  email: "",
  full_name: "",
  password: "",
  roles: [],
  team_ids: [],
  is_active: true,
};

export default function UsersPage() {
  const { showNotification } = useNotification();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<UserSortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [deleteCandidate, setDeleteCandidate] = useState<UserRecord | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void loadAll();
  }, [page, searchTerm, statusFilter, sortBy, sortDir]);

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalUsers / 10)),
    [totalUsers],
  );

  async function loadAll() {
    setIsLoading(true);
    try {
      const [usersResult, rolesResult, teamsResult] = await Promise.all([
        usersTeamsApi.listUsers({
          page,
          page_size: 10,
          search: searchTerm,
          status: statusFilter,
          sort_by: sortBy,
          sort_dir: sortDir,
        }),
        usersTeamsApi.listRoles({ page: 1, page_size: 100 }),
        usersTeamsApi.listTeams({ page: 1, page_size: 100 }),
      ]);
      setUsers(usersResult.items);
      setTotalUsers(usersResult.meta?.total ?? usersResult.items.length);
      setRoles(rolesResult.items);
      setTeams(teamsResult.items);
      if (!selectedUserId && usersResult.items[0]) {
        selectUser(usersResult.items[0], teamsResult.items);
      }
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to load IAM users",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function selectUser(user: UserRecord, availableTeams: TeamRecord[] = teams) {
    setSelectedUserId(user.id);
    setIsCreating(false);
    setForm({
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      password: "",
      roles: [...user.roles],
      team_ids: availableTeams
        .filter((team) => user.teams.includes(team.name))
        .map((team) => team.id),
      is_active: user.is_active,
    });
  }

  function startCreate() {
    setIsCreating(true);
    setSelectedUserId(null);
    setForm({
      ...emptyForm,
      roles: roles.find((role) => role.slug === "viewer") ? ["viewer"] : [],
    });
  }

  function updateField<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSort(nextSortBy: UserSortKey) {
    setPage(1);
    if (sortBy === nextSortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(nextSortBy);
    setSortDir("asc");
  }

  function renderSortIcon(column: UserSortKey) {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5" />;
    }
    return sortDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  }

  function toggleRole(slug: string) {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(slug)
        ? current.roles.filter((item) => item !== slug)
        : [...current.roles, slug],
    }));
  }

  function toggleTeam(teamID: string) {
    setForm((current) => ({
      ...current,
      team_ids: current.team_ids.includes(teamID)
        ? current.team_ids.filter((item) => item !== teamID)
        : [...current.team_ids, teamID],
    }));
  }

  async function handleSubmit() {
    const payload = {
      username: form.username.trim(),
      email: form.email.trim(),
      full_name: form.full_name.trim(),
      password: form.password,
      roles: form.roles,
      team_ids: form.team_ids,
      is_active: form.is_active,
    };
    if (!payload.username || !payload.email || !payload.full_name) {
      showNotification({
        type: "error",
        message: "Missing required fields",
        description: "Username, email and full name are required.",
      });
      return;
    }
    if (payload.roles.length === 0) {
      showNotification({
        type: "error",
        message: "Missing roles",
        description: "Assign at least one role before saving.",
      });
      return;
    }
    if (isCreating && payload.password.length < 8) {
      showNotification({
        type: "error",
        message: "Password too short",
        description: "New users need a password with at least 8 characters.",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (isCreating) {
        const created = await usersTeamsApi.createUser(payload);
        const nextUsers = [...users, created];
        setUsers(nextUsers);
        selectUser(created);
        showNotification({
          type: "success",
          message: "User created",
          description: `${created.username} is ready for sign-in.`,
        });
      } else if (selectedUser) {
        const updated = await usersTeamsApi.updateUser(selectedUser.id, payload);
        const nextUsers = users.map((item) => (item.id === updated.id ? updated : item));
        setUsers(nextUsers);
        setSelectedUserId(updated.id);
        setForm((current) => ({ ...current, password: "" }));
        showNotification({
          type: "success",
          message: "User updated",
          description: `${updated.username} has been saved.`,
        });
      }
    } catch (err) {
      showNotification({
        type: "error",
        message: isCreating ? "Unable to create user" : "Unable to update user",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteUser(user: UserRecord) {
    try {
      await usersTeamsApi.deleteUser(user.id);
      const nextUsers = users.filter((item) => item.id !== user.id);
      setUsers(nextUsers);
      if (selectedUserId === user.id) {
        if (nextUsers[0]) {
          selectUser(nextUsers[0]);
        } else {
          startCreate();
        }
      }
      showNotification({
        type: "success",
        message: "User deleted",
        description: `${user.username} was removed.`,
      });
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to delete user",
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
            <UsersIcon className="h-6 w-6 text-indigo-500" />
            Users
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage identities, role grants, team membership and account lifecycle.
          </p>
        </div>
        <Button variant="primary" onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create User
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Input
              icon={<Search className="h-4 w-4 text-zinc-400" />}
              placeholder="Search by username, mail, role, team"
              value={searchInput}
              onChange={(event) => {
                setPage(1);
                setSearchInput(event.target.value);
              }}
            />
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-300">
              {totalUsers} users
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-300">
              {users.filter((item) => item.is_active).length} active
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button type="button" onClick={() => handleSort("name")} className="inline-flex items-center gap-1 text-left">
                      User
                      {renderSortIcon("name")}
                    </button>
                  </TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Teams</TableHead>
                  <TableHead>
                    <button type="button" onClick={() => handleSort("status")} className="inline-flex items-center gap-1 text-left">
                      Status
                      {renderSortIcon("status")}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center text-zinc-500">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center text-zinc-500">
                      No users matched this search.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow
                      key={user.id}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40",
                        selectedUserId === user.id && "bg-indigo-50 dark:bg-zinc-900/70",
                      )}
                      onClick={() => selectUser(user)}
                    >
                      <TableCell>
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {user.full_name || user.username}
                        </div>
                        <div className="text-xs text-zinc-500">{user.username}</div>
                        <div className="text-xs text-zinc-500">{user.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {user.roles.map((role) => (
                            <Badge
                              key={role}
                              variant={role === "admin" ? "error" : "outline"}
                            >
                              <Shield className="mr-1 inline h-3 w-3" />
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {user.teams.length > 0 ? user.teams.map((team) => (
                            <Badge key={team} variant="outline">
                              {team}
                            </Badge>
                          )) : <span className="text-xs text-zinc-500">No teams</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                            user.is_active
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
                          )}
                        >
                          {user.is_active ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          {user.is_active ? "Active" : "Disabled"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteCandidate(user);
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
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
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                <UserCog className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                  {isCreating ? "Create user" : selectedUser ? `Edit ${selectedUser.username}` : "Select a user"}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Provision credentials, assign roles and control tenant team access.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Username
                </label>
                <Input
                  value={form.username}
                  onChange={(event) => updateField("username", event.target.value)}
                  placeholder="platform.ops"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Full name
                </label>
                <Input
                  value={form.full_name}
                  onChange={(event) => updateField("full_name", event.target.value)}
                  placeholder="Platform Operations"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Email
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="user@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {isCreating ? "Temporary password" : "Reset password"}
              </label>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder={isCreating ? "Minimum 8 characters" : "Leave empty to keep current password"}
              />
              <p className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <KeyRound className="h-3.5 w-3.5" />
                {isCreating
                  ? "This password is used for first login."
                  : "Entering a new password here will overwrite the current one."}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Roles
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Users can hold multiple roles inside the active organization.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition-colors",
                      form.roles.includes(role.slug)
                        ? "border-indigo-400 bg-indigo-50/80 dark:border-indigo-500/40 dark:bg-indigo-500/10"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={form.roles.includes(role.slug)}
                      onChange={() => toggleRole(role.slug)}
                      className="mt-1 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {role.name}
                        </span>
                        {role.is_system ? <Badge variant="outline">System</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {role.description || "Custom access role"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Teams
              </h3>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                Team membership is used later by ABAC owner/team checks.
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {teams.map((team) => (
                  <label
                    key={team.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-3 transition-colors",
                      form.team_ids.includes(team.id)
                        ? "border-cyan-400 bg-cyan-50/70 dark:border-cyan-500/40 dark:bg-cyan-500/10"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={form.team_ids.includes(team.id)}
                      onChange={() => toggleTeam(team.id)}
                      className="h-4 w-4 rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {team.name}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {team.member_count} members
                      </div>
                    </div>
                  </label>
                ))}
                {teams.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300 px-3 py-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    No teams created yet.
                  </div>
                ) : null}
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => updateField("is_active", event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Account active
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Disabled users cannot sign in or refresh sessions.
                </div>
              </div>
            </label>
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
                if (selectedUser) {
                  selectUser(selectedUser);
                  return;
                }
                startCreate();
              }}
            >
              Reset form
            </Button>
            <Button variant="primary" onClick={() => void handleSubmit()} isLoading={isSaving}>
              {isCreating ? "Create User" : "Save Changes"}
            </Button>
          </div>
        </section>
      </div>
    </div>
    <ConfirmActionDialog
      open={!!deleteCandidate}
      title="Remove user?"
      description={deleteCandidate ? `This removes ${deleteCandidate.username} from the workspace and revokes their access.` : ""}
      confirmLabel="Remove User"
      onClose={() => setDeleteCandidate(null)}
      onConfirm={() => {
        if (!deleteCandidate) return;
        void handleDeleteUser(deleteCandidate).finally(() => setDeleteCandidate(null));
      }}
      pending={false}
      tone="danger"
    />
    </>
  );
}
