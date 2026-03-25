import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Pencil, Plus, RefreshCw, Search, Shield, Trash2, User, Users } from "lucide-react";

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
  groups: string;
  remove_home: boolean;
};

type GroupFormState = {
  target: string;
  rename_to: string;
  members: string;
};

const DEFAULT_USER_FORM: UserFormState = {
  target: "",
  rename_to: "",
  home: "",
  shell: "/bin/bash",
  groups: "",
  remove_home: true,
};

const DEFAULT_GROUP_FORM: GroupFormState = {
  target: "",
  rename_to: "",
  members: "",
};

const LINUX_ACCOUNT_NAME = /^[a-z_][a-z0-9_-]{0,31}$/;

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

  const availableGroupNames = useMemo(() => groups.map((group) => group.name).sort(), [groups]);
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
    return groups.filter((group) =>
      group.name.toLowerCase().includes(keyword) ||
      String(group.gid).includes(keyword) ||
      group.members.some((member) => member.toLowerCase().includes(keyword)),
    );
  }, [groups, groupSearch]);

  const resetUserForm = () => {
    setUserFormMode("create");
    setUserForm(DEFAULT_USER_FORM);
  };

  const resetGroupForm = () => {
    setGroupFormMode("create");
    setGroupForm(DEFAULT_GROUP_FORM);
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
          groups: splitCsv(userForm.groups),
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
          : `${expectedUser} command succeeded, but the refreshed inventory has not reflected the change yet. Check node privileges and refresh once more.`,
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
          : `${expectedGroup} command succeeded, but the refreshed inventory has not reflected the change yet. Check node privileges and refresh once more.`,
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
      showNotification({
        type: "success",
        message: "User deleted",
        description: `${username} has been removed from the node.`,
      });
      await loadData();
    } catch (error) {
      showNotification({
        type: "error",
        message: "Unable to delete user",
        description: error instanceof Error ? error.message : "Request failed.",
      });
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
      showNotification({
        type: "success",
        message: "Group deleted",
        description: `${groupName} has been removed from the node.`,
      });
      await loadData();
    } catch (error) {
      showNotification({
        type: "error",
        message: "Unable to delete group",
        description: error instanceof Error ? error.message : "Request failed.",
      });
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
      groups: groups.filter((group) => group.members.includes(user.username)).map((group) => group.name).join(", "),
      remove_home: true,
    });
  };

  const editGroup = (group: ServerGroupRow) => {
    setActiveTab("groups");
    setGroupFormMode("edit");
    setGroupForm({
      target: group.name,
      rename_to: "",
      members: group.members.join(", "),
    });
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
            User và group giờ có thể thao tác trực tiếp qua agent typed operations, không chỉ xem inventory read-only nữa.
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

        <TabsContent value="users">
          <div className="mb-4 rounded-xl border border-zinc-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {userFormMode === "create" ? "Add user" : `Edit user ${userForm.target}`}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Home, shell và group membership sẽ được apply trực tiếp trên node.
                </div>
              </div>
              {userFormMode === "edit" ? (
                <Button variant="outline" onClick={resetUserForm}>Cancel Edit</Button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Input value={userForm.target} onChange={(event) => setUserForm((prev) => ({ ...prev, target: event.target.value }))} placeholder="username" disabled={userActionLoading} />
              <Input value={userForm.rename_to} onChange={(event) => setUserForm((prev) => ({ ...prev, rename_to: event.target.value }))} placeholder="rename to (optional)" disabled={userActionLoading || userFormMode === "create"} />
              <Input value={userForm.home} onChange={(event) => setUserForm((prev) => ({ ...prev, home: event.target.value }))} placeholder="/home/username" disabled={userActionLoading} />
              <Input value={userForm.shell} onChange={(event) => setUserForm((prev) => ({ ...prev, shell: event.target.value }))} placeholder="/bin/bash" disabled={userActionLoading} />
              <Input value={userForm.groups} onChange={(event) => setUserForm((prev) => ({ ...prev, groups: event.target.value }))} placeholder="sudo, docker" disabled={userActionLoading} />
              <div className="flex items-center gap-3 rounded-xl border border-zinc-200/70 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800/70 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={userForm.remove_home}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, remove_home: event.target.checked }))}
                  className="h-4 w-4"
                  disabled={userActionLoading}
                />
                Remove home when deleting
              </div>
            </div>
            {availableGroupNames.length > 0 ? (
              <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Available groups: {availableGroupNames.slice(0, 10).join(", ")}
                {availableGroupNames.length > 10 ? "..." : ""}
              </div>
            ) : null}
            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={() => void submitUserAction()} disabled={!userForm.target.trim() || userActionLoading}>
                {userActionLoading ? <RefreshCw size={14} className="mr-2 animate-spin" /> : <Plus size={14} className="mr-2" />}
                {userFormMode === "create" ? "Add User" : "Save User"}
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200/60 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700 dark:border-zinc-800/60 dark:bg-[#121212]">
            <div className="border-b border-zinc-200/60 p-4 dark:border-zinc-800/60">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={15} />
                <Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search by username, UID, shell, home..." className="pl-10" />
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
                    <TableCell colSpan={6} className="py-8 text-center text-[13px] font-medium text-zinc-500 animate-pulse">
                      Loading users...
                    </TableCell>
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
                            <Pencil size={14} className="mr-1" />
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => setDeleteUserCandidate(user.username)}>
                            <Trash2 size={14} className="mr-1" />
                            Delete
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

        <TabsContent value="groups">
          <div className="mb-4 rounded-xl border border-zinc-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {groupFormMode === "create" ? "Add group" : `Edit group ${groupForm.target}`}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Bạn có thể tạo group mới, đổi tên group, hoặc chỉnh member list trực tiếp từ đây.
                </div>
              </div>
              {groupFormMode === "edit" ? (
                <Button variant="outline" onClick={resetGroupForm}>Cancel Edit</Button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Input value={groupForm.target} onChange={(event) => setGroupForm((prev) => ({ ...prev, target: event.target.value }))} placeholder="group name" disabled={groupActionLoading} />
              <Input value={groupForm.rename_to} onChange={(event) => setGroupForm((prev) => ({ ...prev, rename_to: event.target.value }))} placeholder="rename to (optional)" disabled={groupActionLoading || groupFormMode === "create"} />
              <Input value={groupForm.members} onChange={(event) => setGroupForm((prev) => ({ ...prev, members: event.target.value }))} placeholder="alice, bob, deploy" disabled={groupActionLoading} />
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
                <Input value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} placeholder="Search by group, GID, member..." className="pl-10" />
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
                    <TableCell colSpan={4} className="py-8 text-center text-[13px] font-medium text-zinc-500 animate-pulse">
                      Loading groups...
                    </TableCell>
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
                            <Pencil size={14} className="mr-1" />
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => setDeleteGroupCandidate(group.name)}>
                            <Trash2 size={14} className="mr-1" />
                            Delete
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
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
