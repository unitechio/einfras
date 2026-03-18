import { useState, useEffect } from "react";
import { mockSecurityService } from "../shared/mockServerService";
import type { ServerUser, ServerGroup } from "../shared/mockServerService";
import {
  Shield,
  User,
  Plus,
  Users,
  Trash2,
  Edit,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/Tabs";

export default function ServerUsers() {
  const [activeTab, setActiveTab] = useState<"users" | "groups">("users");
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [groups, setGroups] = useState<ServerGroup[]>([]);
  const [_loading, setLoading] = useState(true);

  // Modals
  const [showUserModal, setShowUserModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showUserGroupsModal, setShowUserGroupsModal] = useState(false);
  const [showGroupMembersModal, setShowGroupMembersModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);

  // Selection
  const [selectedUser, setSelectedUser] = useState<ServerUser | null>(null);
  const [selectedUserForPermissions, setSelectedUserForPermissions] =
    useState<ServerUser | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ServerGroup | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, groupsData] = await Promise.all([
        mockSecurityService.getUsers(),
        (mockSecurityService as any).getGroups(),
      ]);
      setUsers(usersData);
      setGroups(groupsData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg border border-indigo-100/50 dark:border-indigo-500/20">
              <Shield className="text-indigo-500" size={20} />
            </div>
            Access Control
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-[13px] mt-2">
            Manage system users, groups, and precise permissions.
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "users" ? (
            <Button variant="primary" onClick={() => setShowUserModal(true)}>
              <Plus size={16} className="mr-2" /> Add User
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setShowGroupModal(true)}>
              <Plus size={16} className="mr-2" /> Add Group
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
        <TabsList>
          <TabsTrigger value="users" icon={User}>
            Users
          </TabsTrigger>
          <TabsTrigger value="groups" icon={Users}>
            Groups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
        <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Groups</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Last Login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.username} className="group">
                  <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200/60 dark:border-zinc-800/60 dark:bg-[#1A1A1A] flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                      <User size={14} />
                    </div>
                    {user.username}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'error' : user.role === 'operator' ? 'default' : 'outline'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 items-center">
                      {user.groups?.map((g) => (
                        <code
                          key={g}
                          className="px-1.5 py-0.5 rounded border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-800/50 text-[11px] text-zinc-600 dark:text-zinc-400"
                        >
                          {g}
                        </code>
                      ))}
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowUserGroupsModal(true);
                        }}
                        className="ml-1 p-1 text-zinc-400 hover:text-zinc-900 rounded dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100"
                        title="Manage Groups"
                      >
                        <Users size={12} />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 items-center">
                      {user.permissions.slice(0, 3).map((p) => (
                        <code
                          key={p}
                          className="px-1.5 py-0.5 rounded border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-800/50 text-[11px] text-zinc-600 dark:text-zinc-400"
                        >
                          {p}
                        </code>
                      ))}
                      {user.permissions.length > 3 && (
                        <code className="px-1.5 py-0.5 rounded border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-800/50 text-[11px] text-zinc-600 dark:text-zinc-400">
                           +{user.permissions.length - 3}
                        </code>
                      )}
                      <button
                        onClick={() => {
                          setSelectedUserForPermissions(user);
                          setShowPermissionsModal(true);
                        }}
                        className="ml-2 p-1 text-zinc-400 hover:text-zinc-900 rounded dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit Permissions"
                      >
                        <Shield size={12} />
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-zinc-500 dark:text-zinc-400">
                    {new Date(user.lastLogin).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </TabsContent>

        <TabsContent value="groups">
        <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group Name</TableHead>
                <TableHead>GID</TableHead>
                <TableHead>App Permissions</TableHead>
                <TableHead>Members</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.name} className="group">
                  <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 dark:text-blue-400">
                      <Users size={14} />
                    </div>
                    {group.name}
                  </TableCell>
                  <TableCell>
                     <span className="font-mono text-[12px] text-zinc-500 dark:text-zinc-400">{group.id}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {group.permissions.map((p) => (
                        <code
                          key={p}
                          className="px-1.5 py-0.5 rounded border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-800/50 text-[11px] text-zinc-600 dark:text-zinc-400"
                        >
                          {p}
                        </code>
                      ))}
                      {group.permissions.length === 0 && (
                        <span className="text-zinc-400 dark:text-zinc-600 text-[12px]">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {group.members.map((m) => (
                        <span
                          key={m}
                          className="px-2 py-0.5 rounded-full border border-blue-200/60 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[11px] font-medium flex items-center gap-1"
                        >
                          <User size={10} /> {m}
                        </span>
                      ))}
                      {group.members.length === 0 && (
                        <span className="text-[12px] text-zinc-400 dark:text-zinc-600">No members</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon"
                        onClick={() => {
                          setSelectedGroup(group);
                          setShowEditGroupModal(true);
                        }}
                        className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="Edit Group"
                      >
                        <Edit size={14} />
                      </Button>
                      <Button variant="ghost" size="icon"
                        onClick={() => {
                          setSelectedGroup(group);
                          setShowGroupMembersModal(true);
                        }}
                        className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="Manage Members"
                      >
                        <UserPlus size={14} />
                      </Button>
                      <Button variant="ghost" size="icon"
                        onClick={async () => {
                          if (confirm(`Delete group ${group.name}?`)) {
                            await (mockSecurityService as any).deleteGroup(group.id);
                            loadData();
                          }
                        }}
                        className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete Group"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </TabsContent>
      </Tabs>

      {/* Add User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121212] rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200/60 dark:border-zinc-800/60 space-y-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              Add New User
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
                  Username
                </label>
                <input
                  id="newUser"
                  type="text"
                  className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-[#121212] dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300"
                  placeholder="jdoe"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">Role</label>
                <select
                  id="newRole"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-[#121212] dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300 font-medium text-zinc-900 dark:text-zinc-100"
                >
                  <option value="read-only">Read Only</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowUserModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  const username = (
                    document.getElementById("newUser") as HTMLInputElement
                  ).value;
                  const role = (
                    document.getElementById("newRole") as HTMLSelectElement
                  ).value as any;
                  if (username) {
                    await (mockSecurityService as any).addUser({
                      username,
                      role,
                      permissions: ["default"],
                    });
                    setShowUserModal(false);
                    loadData();
                  }
                }}
              >
                Add User
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121212] rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200/60 dark:border-zinc-800/60 space-y-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              Add Group
            </h3>
            <div>
              <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
                Group Name
              </label>
              <input
                id="newGroup"
                type="text"
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-[#121212] dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300"
                placeholder="developers"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowGroupModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  const group = (
                    document.getElementById("newGroup") as HTMLInputElement
                  ).value;
                  if (group) {
                    await (mockSecurityService as any).addGroup(group);
                    setShowGroupModal(false);
                    loadData();
                  }
                }}
              >
                Create Group
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroupModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121212] rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200/60 dark:border-zinc-800/60 space-y-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
              Edit Group
            </h3>
            <div>
              <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
                Group Name
              </label>
              <input
                id="editGroupName"
                type="text"
                defaultValue={selectedGroup.name}
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-[#121212] dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60 mt-4">
              <Button
                variant="ghost"
                onClick={() => setShowEditGroupModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  const newName = (
                    document.getElementById("editGroupName") as HTMLInputElement
                  ).value;
                  if (newName) {
                    await (mockSecurityService as any).updateGroup(
                      selectedGroup.id,
                      newName,
                    );
                    setShowEditGroupModal(false);
                    loadData();
                  }
                }}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Group Members Modal */}
      {showGroupMembersModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121212] rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200/60 dark:border-zinc-800/60 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                  Manage Members
                </h3>
                <p className="text-[13px] text-zinc-500 mt-1">
                  Group:{" "}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-[#1A1A1A] px-1.5 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-800/50">{selectedGroup.name}</span>
                </p>
              </div>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Users className="text-blue-500" size={20} />
              </div>
            </div>

            <div className="flex gap-2">
              <select
                id="addMemberSelect"
                className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-[#121212] dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300 font-medium text-zinc-900 dark:text-zinc-100"
              >
                <option value="">Select user to add...</option>
                {users
                  .filter((u) => !selectedGroup.members.includes(u.username))
                  .map((u) => (
                    <option key={u.username} value={u.username}>
                      {u.username}
                    </option>
                  ))}
              </select>
              <Button
                variant="outline"
                onClick={async () => {
                  const username = (
                    document.getElementById(
                      "addMemberSelect",
                    ) as HTMLSelectElement
                  ).value;
                  if (username) {
                    await (mockSecurityService as any).addGroupMember(
                      selectedGroup.id,
                      username,
                    );
                    loadData();
                    // Update local state temporarily for UI responsiveness
                    const updatedGroup = {
                      ...selectedGroup,
                      members: [...selectedGroup.members, username],
                    };
                    setSelectedGroup(updatedGroup);
                  }
                }}
                className="bg-white dark:bg-[#121212]"
              >
                Add
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pt-2">
              {selectedGroup.members.length === 0 ? (
                <p className="text-center text-zinc-500 text-sm py-4">
                  No members in this group.
                </p>
              ) : (
                selectedGroup.members.map((member) => (
                  <div
                    key={member}
                    className="flex justify-between items-center p-2 border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50 dark:bg-zinc-800/30"
                  >
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-zinc-400" />
                      <span className="text-sm font-medium">{member}</span>
                    </div>
                    <button
                      onClick={async () => {
                        if (
                          confirm(
                            `Remove ${member} from ${selectedGroup.name}?`,
                          )
                        ) {
                          await (mockSecurityService as any).removeGroupMember(
                            selectedGroup.id,
                            member,
                          );
                          loadData();
                          const updatedGroup = {
                            ...selectedGroup,
                            members: selectedGroup.members.filter(
                              (m) => m !== member,
                            ),
                          };
                          setSelectedGroup(updatedGroup);
                        }
                      }}
                      className="text-zinc-400 hover:text-red-500 p-1"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800/60 mt-4">
              <Button
                variant="primary"
                onClick={() => setShowGroupMembersModal(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* User Permissions Modal */}
      {showPermissionsModal && selectedUserForPermissions && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121212] rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200/60 dark:border-zinc-800/60 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                  Edit Permissions
                </h3>
                <p className="text-[13px] text-zinc-500 mt-1">
                  Managing access for{" "}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-[#1A1A1A] px-1.5 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-800/50">
                    {selectedUserForPermissions.username}
                  </span>
                </p>
              </div>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <Shield className="text-indigo-500" size={20} />
              </div>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto p-1">
              {[
                "read",
                "write",
                "execute",
                "manage_users",
                "manage_services",
                "view_logs",
                "ssh_access",
                "sudo",
              ].map((perm) => (
                <label
                  key={perm}
                  className="flex items-center gap-3 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    defaultChecked={
                      selectedUserForPermissions.permissions.includes(perm) ||
                      (perm === "read" &&
                        selectedUserForPermissions.permissions.includes("all"))
                    }
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="text-sm font-medium">
                    {perm.replace("_", " ").toUpperCase()}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 mt-4">
              <Button
                variant="ghost"
                onClick={() => setShowPermissionsModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  alert(
                    `Permissions updated for ${selectedUserForPermissions.username}`,
                  );
                  setShowPermissionsModal(false);
                }}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* User Groups Modal */}
      {showUserGroupsModal && selectedUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121212] rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200/60 dark:border-zinc-800/60 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                  Manage Groups
                </h3>
                <p className="text-[13px] text-zinc-500 mt-1">
                  Assign groups for{" "}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-[#1A1A1A] px-1.5 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-800/50">{selectedUser.username}</span>
                </p>
              </div>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Users className="text-blue-500" size={20} />
              </div>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {groups.map((group) => (
                <label
                  key={group.name}
                  className="flex items-center gap-3 p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    defaultChecked={selectedUser.groups?.includes(group.name)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        selectedUser.groups = [
                          ...(selectedUser.groups || []),
                          group.name,
                        ];
                      } else {
                        selectedUser.groups =
                          selectedUser.groups?.filter(
                            (g) => g !== group.name,
                          ) || [];
                      }
                    }}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div>
                    <div className="font-medium text-sm text-zinc-900 dark:text-white">
                      {group.name}
                    </div>
                    <div className="text-xs text-zinc-500">GID: {group.id}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 mt-4">
              <Button
                variant="ghost"
                onClick={() => setShowUserGroupsModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  await (mockSecurityService as any).updateUserGroups(
                    selectedUser.username,
                    selectedUser.groups,
                  );
                  setShowUserGroupsModal(false);
                  loadData();
                }}
              >
                Save assignments
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
