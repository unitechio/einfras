import { useState, useEffect } from "react";
import {
  mockSecurityService,
  ServerUser,
  ServerGroup,
} from "../shared/mockServerService";
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

export default function ServerUsers() {
  const [activeTab, setActiveTab] = useState<"users" | "groups">("users");
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [groups, setGroups] = useState<ServerGroup[]>([]);
  const [loading, setLoading] = useState(true);

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

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400";
      case "operator":
        return "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            Access Control
          </h2>
          <p className="text-zinc-500 text-sm">
            Manage users, groups, and permissions.
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "users" ? (
            <button
              onClick={() => setShowUserModal(true)}
              className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              <Plus size={16} /> Add User
            </button>
          ) : (
            <button
              onClick={() => setShowGroupModal(true)}
              className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              <Plus size={16} /> Add Group
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("users")}
            className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 cursor-pointer
                            ${
                              activeTab === "users"
                                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                            }
                        `}
          >
            <User size={16} />
            Users
          </button>
          <button
            onClick={() => setActiveTab("groups")}
            className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 cursor-pointer
                            ${
                              activeTab === "groups"
                                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
                            }
                        `}
          >
            <Users size={16} />
            Groups
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === "users" ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 font-medium border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Groups</th>
                <th className="px-6 py-4">Permissions</th>
                <th className="px-6 py-4">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {users.map((user) => (
                <tr
                  key={user.username}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                      <User size={16} />
                    </div>
                    {user.username}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 items-center">
                      {user.groups?.map((g) => (
                        <code
                          key={g}
                          className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs"
                        >
                          {g}
                        </code>
                      ))}
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowUserGroupsModal(true);
                        }}
                        className="ml-1 p-1 text-zinc-400 hover:text-blue-500 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="Manage Groups"
                      >
                        <Users size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 items-center">
                      {user.permissions.map((p) => (
                        <code
                          key={p}
                          className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs"
                        >
                          {p}
                        </code>
                      ))}
                      <button
                        onClick={() => {
                          setSelectedUserForPermissions(user);
                          setShowPermissionsModal(true);
                        }}
                        className="ml-2 p-1 text-zinc-400 hover:text-blue-500 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Edit Permissions"
                      >
                        <Shield size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-500">
                    {new Date(user.lastLogin).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 font-medium border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-4">Group Name</th>
                <th className="px-6 py-4">GID</th>
                <th className="px-6 py-4">App Permissions</th>
                <th className="px-6 py-4">Members</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {groups.map((group) => (
                <tr
                  key={group.name}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-zinc-900 dark:text-white flex items-center gap-3">
                    <Users size={16} className="text-zinc-400" />
                    {group.name}
                  </td>
                  <td className="px-6 py-4 font-mono text-zinc-500">
                    {group.id}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {group.permissions.map((p) => (
                        <code
                          key={p}
                          className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs"
                        >
                          {p}
                        </code>
                      ))}
                      {group.permissions.length === 0 && (
                        <span className="text-zinc-400 text-xs">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {group.members.map((m) => (
                        <span
                          key={m}
                          className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1"
                        >
                          <User size={10} /> {m}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedGroup(group);
                          setShowEditGroupModal(true);
                        }}
                        className="p-1 text-zinc-400 hover:text-blue-500 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="Edit Group"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedGroup(group);
                          setShowGroupMembersModal(true);
                        }}
                        className="p-1 text-zinc-400 hover:text-green-500 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="Manage Members"
                      >
                        <UserPlus size={14} />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm(`Delete group ${group.name}?`)) {
                            await (mockSecurityService as any).deleteGroup(
                              group.id,
                            );
                            loadData();
                          }
                        }}
                        className="p-1 text-zinc-400 hover:text-red-500 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="Delete Group"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-sm max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Add New User
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Username
                </label>
                <input
                  id="newUser"
                  type="text"
                  className="w-full p-2 rounded border bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                  placeholder="jdoe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  id="newRole"
                  className="w-full p-2 rounded border bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                >
                  <option value="read-only">Read Only</option>
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
              >
                Cancel
              </button>
              <button
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
                className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                Add User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-sm max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Add Group
            </h3>
            <div>
              <label className="block text-sm font-medium mb-1">
                Group Name
              </label>
              <input
                id="newGroup"
                type="text"
                className="w-full p-2 rounded border bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                placeholder="developers"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowGroupModal(false)}
                className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
              >
                Cancel
              </button>
              <button
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
                className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded hover:opacity-90"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroupModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              Edit Group
            </h3>
            <div>
              <label className="block text-sm font-medium mb-1">
                Group Name
              </label>
              <input
                id="editGroupName"
                type="text"
                defaultValue={selectedGroup.name}
                className="w-full p-2 rounded border bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowEditGroupModal(false)}
                className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
              >
                Cancel
              </button>
              <button
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
                className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Group Members Modal */}
      {showGroupMembersModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-sm max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Manage Members
                </h3>
                <p className="text-sm text-zinc-500">
                  Group:{" "}
                  <span className="font-semibold">{selectedGroup.name}</span>
                </p>
              </div>
              <Users className="text-blue-500" size={24} />
            </div>

            <div className="flex gap-2">
              <select
                id="addMemberSelect"
                className="flex-1 p-2 rounded border bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-sm"
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
              <button
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
                className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-sm font-medium"
              >
                Add
              </button>
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

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowGroupMembersModal(false)}
                className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Permissions Modal */}
      {showPermissionsModal && selectedUserForPermissions && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Edit Permissions
                </h3>
                <p className="text-sm text-zinc-500">
                  Managing access for{" "}
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {selectedUserForPermissions.username}
                  </span>
                </p>
              </div>
              <Shield className="text-blue-500" size={24} />
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

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  alert(
                    `Permissions updated for ${selectedUserForPermissions.username}`,
                  );
                  setShowPermissionsModal(false);
                }}
                className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Groups Modal */}
      {showUserGroupsModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                  Manage Groups
                </h3>
                <p className="text-sm text-zinc-500">
                  Assign groups for{" "}
                  <span className="font-semibold">{selectedUser.username}</span>
                </p>
              </div>
              <Users className="text-blue-500" size={24} />
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
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowUserGroupsModal(false)}
                className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await (mockSecurityService as any).updateUserGroups(
                    selectedUser.username,
                    selectedUser.groups,
                  );
                  setShowUserGroupsModal(false);
                  loadData();
                }}
                className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                Save assignments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
