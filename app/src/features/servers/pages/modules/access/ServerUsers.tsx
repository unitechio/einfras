import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";

import { useNotification } from "@/core/NotificationContext";
import { accessApi, type TypedControlResult } from "@/shared/api/client";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/Table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";

type ServerUserRow = {
  username: string;
  uid: number;
  gid: number;
  home: string;
  shell: string;
};

type ServerGroupRow = {
  name: string;
  gid: number;
  members: string[];
};

type UserFormState = {
  target: string;
  rename_to: string;
  home: string;
  shell: string;
  groups: string[];          // now a real string array
  password: string;
  ssh_key: string;
  uid: string;               // advanced
  system: boolean;           // system user toggle
  remove_home: boolean;
};

type GroupFormState = {
  target: string;
  rename_to: string;
  members: string;
  gid: string;               // advanced
};

const DEFAULT_USER_FORM: UserFormState = {
  target: "",
  rename_to: "",
  home: "",
  shell: "/bin/bash",
  groups: [],
  password: "",
  ssh_key: "",
  uid: "",
  system: false,
  remove_home: true,
};

const DEFAULT_GROUP_FORM: GroupFormState = {
  target: "",
  rename_to: "",
  members: "",
  gid: "",
};

const LINUX_ACCOUNT_NAME = /^[a-z_][a-z0-9_-]{0,31}$/;

/* ─── tiny multi-select ─── */
function MultiGroupSelect({
  options,
  selected,
  onChange,
  disabled,
}: {
  options: { name: string; gid: number }[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(
    (opt) =>
      opt.name.toLowerCase().includes(search.toLowerCase()) ||
      String(opt.gid).includes(search),
  );

  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter((g) => g !== name) : [...selected, name]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full min-h-[36px] items-center justify-between gap-2 rounded-xl border border-zinc-200/70 bg-white px-3 py-1.5 text-left text-sm text-zinc-700 shadow-sm transition hover:border-indigo-400/60 dark:border-zinc-800/70 dark:bg-zinc-900 dark:text-zinc-200 disabled:opacity-50"
      >
        <div className="flex flex-wrap gap-1">
          {selected.length === 0 ? (
            <span className="text-zinc-400 text-[13px]">Select groups…</span>
          ) : (
            selected.map((g) => (
              <span
                key={g}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800/60 dark:text-indigo-300"
              >
                {g}
                <X
                  size={10}
                  className="cursor-pointer hover:text-indigo-900 dark:hover:text-indigo-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(g);
                  }}
                />
              </span>
            ))
          )}
        </div>
        {open ? <ChevronUp size={14} className="shrink-0 text-zinc-400" /> : <ChevronDown size={14} className="shrink-0 text-zinc-400" />}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-zinc-200/60 bg-white shadow-xl dark:border-zinc-800/60 dark:bg-zinc-900">
          <div className="p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groups…"
              className="w-full rounded-lg border border-zinc-200/60 bg-zinc-50 px-3 py-1.5 text-[13px] outline-none dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-200"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-center text-[12px] text-zinc-400">No groups found</li>
            ) : (
              filtered.map((opt) => {
                const isSelected = selected.includes(opt.name);
                return (
                  <li
                    key={opt.name}
                    onClick={() => toggle(opt.name)}
                    className={`flex cursor-pointer items-center justify-between px-4 py-2 text-[13px] transition hover:bg-indigo-50 dark:hover:bg-indigo-900/20 ${isSelected ? "bg-indigo-50/60 dark:bg-indigo-900/10" : ""}`}
                  >
                    <span className="font-medium text-zinc-800 dark:text-zinc-100">{opt.name}</span>
                    <span className="text-[11px] text-zinc-400">GID {opt.gid}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─── main component ─── */
export default function ServerUsers() {
  const { serverId = "" } = useParams();
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<"users" | "groups">("users");
  const [users, setUsers] = useState<ServerUserRow[]>([]);
  const [groups, setGroups] = useState<ServerGroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userActionLoading, setUserActionLoading] = useState(false);
  const [groupActionLoading, setGroupActionLoading] = useState(false);
  const [userFormMode, setUserFormMode] = useState<"create" | "edit">("create");
  const [groupFormMode, setGroupFormMode] = useState<"create" | "edit">("create");
  const [userForm, setUserForm] = useState<UserFormState>(DEFAULT_USER_FORM);
  const [groupForm, setGroupForm] = useState<GroupFormState>(DEFAULT_GROUP_FORM);
  const [userSearch, setUserSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [deleteUserCandidate, setDeleteUserCandidate] = useState<string | null>(null);
  const [deleteGroupCandidate, setDeleteGroupCandidate] = useState<string | null>(null);
  const [showUserAdvanced, setShowUserAdvanced] = useState(false);
  const [showGroupAdvanced, setShowGroupAdvanced] = useState(false);

  const loadData = async (): Promise<{ users: ServerUserRow[]; groups: ServerGroupRow[] }> => {
    if (!serverId) return { users: [], groups: [] };
    setLoading(true);
    try {
      const [usersResponse, groupsResponse] = await Promise.all([
        accessApi.action(serverId, { action: "list-users" }),
        accessApi.action(serverId, { action: "list-groups" }),
      ]);
      const usersResult = (usersResponse.result ?? null) as TypedControlResult<ServerUserRow[]> | null;
      const groupsResult = (groupsResponse.result ?? null) as TypedControlResult<ServerGroupRow[]> | null;
      const nextUsers = normalizeUsers(usersResult?.data);
      const nextGroups = normalizeGroups(groupsResult?.data);
      setUsers(nextUsers);
      setGroups(nextGroups);
      return { users: nextUsers, groups: nextGroups };
    } catch (error) {
      showNotification({
        type: "error",
        message: "Unable to load access inventory",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setLoading(false);
    }
    return { users: [], groups: [] };
  };

  useEffect(() => {
    void loadData();
  }, [serverId]);

  /* group options for multi-select */
  const groupOptions = useMemo(
    () => groups.map((g) => ({ name: g.name, gid: g.gid })).sort((a, b) => a.name.localeCompare(b.name)),
    [groups],
  );

  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((user) =>
      [user.username, user.home, user.shell, String(user.uid), String(user.gid)].some((value) =>
        String(value).toLowerCase().includes(keyword),
      ),
    );
  }, [users, userSearch]);

  const filteredGroups = useMemo(() => {
    const keyword = groupSearch.trim().toLowerCase();
    if (!keyword) return groups;
    return groups.filter(
      (group) =>
        group.name.toLowerCase().includes(keyword) ||
        String(group.gid).includes(keyword) ||
        group.members.some((member) => member.toLowerCase().includes(keyword)),
    );
  }, [groups, groupSearch]);

  const resetUserForm = () => {
    setUserFormMode("create");
    setUserForm(DEFAULT_USER_FORM);
    setShowUserAdvanced(false);
  };
  const resetGroupForm = () => {
    setGroupFormMode("create");
    setGroupForm(DEFAULT_GROUP_FORM);
    setShowGroupAdvanced(false);
  };

  const submitUserAction = async () => {
    if (!serverId || !userForm.target.trim()) return;
    if (!LINUX_ACCOUNT_NAME.test(userForm.target.trim())) {
      showNotification({
        type: "error",
        message: "Invalid username",
        description: "Use Linux-safe account names like deploy, app_user, or ops-admin.",
      });
      return;
    }
    setUserActionLoading(true);
    try {
      const target = userForm.target.trim();
      const action = userFormMode === "create" ? "add-user" : "update-user";
      await accessApi.action(serverId, {
        action,
        target,
        payload: JSON.stringify({
          target,
          rename_to: userForm.rename_to.trim(),
          home: userForm.home.trim(),
          shell: userForm.shell.trim(),
          groups: userForm.groups,
          password: userForm.password.trim() || undefined,
          ssh_key: userForm.ssh_key.trim() || undefined,
          uid: userForm.uid.trim() ? Number(userForm.uid.trim()) : undefined,
          system: userForm.system || undefined,
          remove_home: userForm.remove_home,
        }),
      });
      const snapshot = await loadData();
      const expectedUser = userForm.rename_to.trim() || target;
      const exists = snapshot.users.some((user) => user.username === expectedUser);
      const wasVerified = userFormMode === "edit" ? true : exists;
      showNotification({
        type: wasVerified ? "success" : "warning",
        message: userFormMode === "create" ? "User workflow completed" : "User workflow updated",
        description: wasVerified
          ? `${expectedUser} is now visible in the latest inventory snapshot.`
          : `${expectedUser} command succeeded, but the refreshed inventory has not reflected the change yet.`,
      });
      resetUserForm();
    } catch (error) {
      showNotification({
        type: "error",
        message: userFormMode === "create" ? "Unable to create user" : "Unable to update user",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setUserActionLoading(false);
    }
  };

  const submitGroupAction = async () => {
    if (!serverId || !groupForm.target.trim()) return;
    if (!LINUX_ACCOUNT_NAME.test(groupForm.target.trim())) {
      showNotification({
        type: "error",
        message: "Invalid group name",
        description: "Use Linux-safe group names like deploy, docker, or app-admin.",
      });
      return;
    }
    setGroupActionLoading(true);
    try {
      const target = groupForm.target.trim();
      const action = groupFormMode === "create" ? "add-group" : "update-group";
      await accessApi.action(serverId, {
        action,
        target,
        payload: JSON.stringify({
          target,
          rename_to: groupForm.rename_to.trim(),
          members: splitCsv(groupForm.members),
          gid: groupForm.gid.trim() ? Number(groupForm.gid.trim()) : undefined,
        }),
      });
      const snapshot = await loadData();
      const expectedGroup = groupForm.rename_to.trim() || target;
      const exists = snapshot.groups.some((group) => group.name === expectedGroup);
      const wasVerified = groupFormMode === "edit" ? true : exists;
      showNotification({
        type: wasVerified ? "success" : "warning",
        message: groupFormMode === "create" ? "Group workflow completed" : "Group workflow updated",
        description: wasVerified
          ? `${expectedGroup} is now visible in the latest inventory snapshot.`
          : `${expectedGroup} command succeeded, but the refreshed inventory has not reflected the change yet.`,
      });
      resetGroupForm();
    } catch (error) {
      showNotification({
        type: "error",
        message: groupFormMode === "create" ? "Unable to create group" : "Unable to update group",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setGroupActionLoading(false);
    }
  };

  const deleteUser = async (username: string) => {
    if (!serverId) return;
    setUserActionLoading(true);
    try {
      await accessApi.action(serverId, {
        action: "delete-user",
        target: username,
        payload: JSON.stringify({ target: username, remove_home: true }),
      });
      showNotification({ type: "success", message: "User deleted", description: `${username} has been removed from the node.` });
      await loadData();
    } catch (error) {
      showNotification({ type: "error", message: "Unable to delete user", description: error instanceof Error ? error.message : "Request failed." });
    } finally {
      setUserActionLoading(false);
    }
  };

  const deleteGroup = async (groupName: string) => {
    if (!serverId) return;
    setGroupActionLoading(true);
    try {
      await accessApi.action(serverId, {
        action: "delete-group",
        target: groupName,
        payload: JSON.stringify({ target: groupName }),
      });
      showNotification({ type: "success", message: "Group deleted", description: `${groupName} has been removed from the node.` });
      await loadData();
    } catch (error) {
      showNotification({ type: "error", message: "Unable to delete group", description: error instanceof Error ? error.message : "Request failed." });
    } finally {
      setGroupActionLoading(false);
    }
  };

  const editUser = (user: ServerUserRow) => {
    setActiveTab("users");
    setUserFormMode("edit");
    setUserForm({
      target: user.username,
      rename_to: "",
      home: user.home,
      shell: user.shell,
      groups: groups.filter((g) => g.members.includes(user.username)).map((g) => g.name),
      password: "",
      ssh_key: "",
      uid: String(user.uid),
      system: user.uid < 1000,
      remove_home: true,
    });
    setShowUserAdvanced(false);
  };

  const editGroup = (group: ServerGroupRow) => {
    setActiveTab("groups");
    setGroupFormMode("edit");
    setGroupForm({ target: group.name, rename_to: "", members: group.members.join(", "), gid: String(group.gid) });
    setShowGroupAdvanced(false);
  };

  return (
    <div className="space-y-6">
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            <div className="rounded-lg border border-indigo-100/50 bg-indigo-50 p-2 dark:border-indigo-500/20 dark:bg-indigo-500/10">
              <Shield className="text-indigo-500" size={20} />
            </div>
            Access Control
          </h2>
          <p className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-400">
            Manage Linux users and groups directly on the node via typed agent operations.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={loading || userActionLoading || groupActionLoading}>
          <RefreshCw size={16} className={`mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "users" | "groups")}>
        <TabsList>
          <TabsTrigger value="users" icon={User}>Users</TabsTrigger>
          <TabsTrigger value="groups" icon={Users}>Groups</TabsTrigger>
        </TabsList>

        {/* ─────────── USERS TAB ─────────── */}
        <TabsContent value="users">
          <div className="mb-4 rounded-xl border border-zinc-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {userFormMode === "create" ? "Add user" : `Edit user ${userForm.target}`}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Home, shell and group membership will be applied directly on the node.
                </div>
              </div>
              {userFormMode === "edit" && (
                <Button variant="outline" onClick={resetUserForm}>Cancel Edit</Button>
              )}
            </div>

            {/* Core fields */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Username *</label>
                <Input
                  value={userForm.target}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, target: e.target.value }))}
                  placeholder="e.g. deploy"
                  disabled={userActionLoading || userFormMode === "edit"}
                />
              </div>
              {userFormMode === "edit" && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Rename to</label>
                  <Input
                    value={userForm.rename_to}
                    onChange={(e) => setUserForm((prev) => ({ ...prev, rename_to: e.target.value }))}
                    placeholder="new username (optional)"
                    disabled={userActionLoading}
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Home directory</label>
                <Input
                  value={userForm.home}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, home: e.target.value }))}
                  placeholder="/home/username"
                  disabled={userActionLoading}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Shell</label>
                <Input
                  value={userForm.shell}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, shell: e.target.value }))}
                  placeholder="/bin/bash"
                  disabled={userActionLoading}
                />
              </div>

              {/* Password */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Password 🔥
                </label>
                <Input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="leave blank to skip"
                  disabled={userActionLoading}
                />
              </div>

              {/* Groups multi-select */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Groups ({groupOptions.length} available)
                </label>
                <MultiGroupSelect
                  options={groupOptions}
                  selected={userForm.groups}
                  onChange={(next) => setUserForm((prev) => ({ ...prev, groups: next }))}
                  disabled={userActionLoading}
                />
              </div>
            </div>

            {/* SSH key field */}
            <div className="mt-3">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                SSH Public Key 🔥 <span className="normal-case font-normal text-zinc-400">(optional — will be appended to authorized_keys)</span>
              </label>
              <textarea
                rows={3}
                value={userForm.ssh_key}
                onChange={(e) => setUserForm((prev) => ({ ...prev, ssh_key: e.target.value }))}
                placeholder="ssh-ed25519 AAAA... or ssh-rsa AAAA..."
                disabled={userActionLoading}
                className="w-full rounded-xl border border-zinc-200/60 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700 outline-none transition focus:border-indigo-400/60 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-200"
              />
            </div>

            {/* Flags row */}
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-300 select-none">
                <input
                  type="checkbox"
                  checked={userForm.remove_home}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, remove_home: e.target.checked }))}
                  className="h-4 w-4 accent-indigo-500"
                  disabled={userActionLoading}
                />
                Remove home on delete
              </label>
            </div>

            {/* Advanced section */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowUserAdvanced((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              >
                <Settings2 size={13} />
                {showUserAdvanced ? "Hide" : "Show"} advanced options
                {showUserAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showUserAdvanced && (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800/60 dark:bg-zinc-900/40">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">UID (advanced)</label>
                    <Input
                      value={userForm.uid}
                      onChange={(e) => setUserForm((prev) => ({ ...prev, uid: e.target.value }))}
                      placeholder="auto-assigned if blank"
                      disabled={userActionLoading}
                      type="number"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-300 select-none">
                      <input
                        type="checkbox"
                        checked={userForm.system}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, system: e.target.checked }))}
                        className="h-4 w-4 accent-indigo-500"
                        disabled={userActionLoading}
                      />
                      System user <span className="text-[11px] text-zinc-400">(UID &lt; 1000, no-login shell)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={() => void submitUserAction()} disabled={!userForm.target.trim() || userActionLoading}>
                {userActionLoading ? <RefreshCw size={14} className="mr-2 animate-spin" /> : <Plus size={14} className="mr-2" />}
                {userFormMode === "create" ? "Add User" : "Save User"}
              </Button>
            </div>
          </div>

          {/* User table */}
          <div className="overflow-hidden rounded-xl border border-zinc-200/60 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700 dark:border-zinc-800/60 dark:bg-[#121212]">
            <div className="border-b border-zinc-200/60 p-4 dark:border-zinc-800/60">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
                <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search by username, UID, shell, home…" className="pl-10" />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>UID</TableHead>
                  <TableHead>GID</TableHead>
                  <TableHead>Home</TableHead>
                  <TableHead>Shell</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-[13px] font-medium text-zinc-500 animate-pulse">Loading users…</TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-[13px] font-medium text-zinc-500">
                      {users.length === 0 ? "No users returned by the access API." : "No users match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.username} className="group">
                      <TableCell className="flex items-center gap-3 font-semibold text-zinc-900 dark:text-zinc-100">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200/60 bg-zinc-100 text-zinc-500 dark:border-zinc-800/60 dark:bg-[#1A1A1A] dark:text-zinc-400">
                          <User size={14} />
                        </div>
                        {user.username}
                      </TableCell>
                      <TableCell><Badge variant="outline">{user.uid}</Badge></TableCell>
                      <TableCell><Badge variant="default">{user.gid}</Badge></TableCell>
                      <TableCell className="font-mono text-[12px] text-zinc-500">{user.home}</TableCell>
                      <TableCell className="font-mono text-[12px] text-zinc-500">{user.shell}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => editUser(user)}>
                            <Pencil size={14} className="mr-1" />Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => setDeleteUserCandidate(user.username)}>
                            <Trash2 size={14} className="mr-1" />Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ─────────── GROUPS TAB ─────────── */}
        <TabsContent value="groups">
          <div className="mb-4 rounded-xl border border-zinc-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {groupFormMode === "create" ? "Add group" : `Edit group ${groupForm.target}`}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Create groups, rename them, or update member lists directly on the node.
                </div>
              </div>
              {groupFormMode === "edit" && (
                <Button variant="outline" onClick={resetGroupForm}>Cancel Edit</Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Group name *</label>
                <Input
                  value={groupForm.target}
                  onChange={(e) => setGroupForm((prev) => ({ ...prev, target: e.target.value }))}
                  placeholder="e.g. docker"
                  disabled={groupActionLoading || groupFormMode === "edit"}
                />
              </div>
              {groupFormMode === "edit" && (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Rename to</label>
                  <Input
                    value={groupForm.rename_to}
                    onChange={(e) => setGroupForm((prev) => ({ ...prev, rename_to: e.target.value }))}
                    placeholder="new name (optional)"
                    disabled={groupActionLoading}
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Members (comma-separated)</label>
                <Input
                  value={groupForm.members}
                  onChange={(e) => setGroupForm((prev) => ({ ...prev, members: e.target.value }))}
                  placeholder="alice, bob, deploy"
                  disabled={groupActionLoading}
                />
              </div>
            </div>

            {/* Advanced */}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowGroupAdvanced((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
              >
                <Settings2 size={13} />
                {showGroupAdvanced ? "Hide" : "Show"} advanced options
                {showGroupAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showGroupAdvanced && (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800/60 dark:bg-zinc-900/40">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">GID (advanced)</label>
                    <Input
                      value={groupForm.gid}
                      onChange={(e) => setGroupForm((prev) => ({ ...prev, gid: e.target.value }))}
                      placeholder="auto-assigned if blank"
                      disabled={groupActionLoading}
                      type="number"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={() => void submitGroupAction()} disabled={!groupForm.target.trim() || groupActionLoading}>
                {groupActionLoading ? <RefreshCw size={14} className="mr-2 animate-spin" /> : <Plus size={14} className="mr-2" />}
                {groupFormMode === "create" ? "Add Group" : "Save Group"}
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200/60 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700 dark:border-zinc-800/60 dark:bg-[#121212]">
            <div className="border-b border-zinc-200/60 p-4 dark:border-zinc-800/60">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
                <Input value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} placeholder="Search by group, GID, member…" className="pl-10" />
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>GID</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-[13px] font-medium text-zinc-500 animate-pulse">Loading groups…</TableCell>
                  </TableRow>
                ) : filteredGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-[13px] font-medium text-zinc-500">
                      {groups.length === 0 ? "No group data available." : "No groups match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGroups.map((group) => (
                    <TableRow key={group.name}>
                      <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">{group.name}</TableCell>
                      <TableCell><Badge variant="outline">{group.gid}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {group.members.length === 0 ? (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">No members</span>
                          ) : (
                            group.members.map((member) => (
                              <span
                                key={member}
                                className="rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-400"
                              >
                                {member}
                              </span>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => editGroup(group)}>
                            <Pencil size={14} className="mr-1" />Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => setDeleteGroupCandidate(group.name)}>
                            <Trash2 size={14} className="mr-1" />Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmActionDialog
        open={!!deleteUserCandidate}
        title="Delete system user?"
        description={deleteUserCandidate ? `This removes Linux user ${deleteUserCandidate} from the node.` : ""}
        confirmLabel="Delete User"
        onClose={() => setDeleteUserCandidate(null)}
        onConfirm={() => {
          if (!deleteUserCandidate) return;
          void deleteUser(deleteUserCandidate).finally(() => setDeleteUserCandidate(null));
        }}
        pending={userActionLoading}
        tone="danger"
      />
      <ConfirmActionDialog
        open={!!deleteGroupCandidate}
        title="Delete system group?"
        description={deleteGroupCandidate ? `This removes Linux group ${deleteGroupCandidate} from the node.` : ""}
        confirmLabel="Delete Group"
        onClose={() => setDeleteGroupCandidate(null)}
        onConfirm={() => {
          if (!deleteGroupCandidate) return;
          void deleteGroup(deleteGroupCandidate).finally(() => setDeleteGroupCandidate(null));
        }}
        pending={groupActionLoading}
        tone="danger"
      />
    </div>
  );
}

function splitCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizeUsers(value: unknown): ServerUserRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      username: String(row.username ?? ""),
      uid: Number(row.uid ?? 0),
      gid: Number(row.gid ?? 0),
      home: String(row.home ?? ""),
      shell: String(row.shell ?? ""),
    };
  });
}

function normalizeGroups(value: unknown): ServerGroupRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      name: String(row.name ?? ""),
      gid: Number(row.gid ?? 0),
      members: Array.isArray(row.members) ? row.members.map((member) => String(member)) : [],
    };
  });
}
