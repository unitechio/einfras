"use client";

import { useState, useMemo } from "react";
import {
  Search,
  RefreshCw,
  Trash2,
  Check,
  X,
  Plus,
  AlertTriangle,
  HelpCircle,
  Users as UsersIcon,
  User as UserIcon,
  ChevronDown,
  Info,
} from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { cn } from "@/lib/utils"; // Assuming cn utility is available or I'll implement it

interface User {
  id: string;
  name: string;
  role: "administrator" | "standard";
  authentication: string;
}

export default function UsersPage() {
  const { showNotification } = useNotification();

  // State for adding a new user
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    isAdmin: false,
    teams: [] as string[],
  });

  // State for user list
  const [users, setUsers] = useState<User[]>([
    {
      id: "1",
      name: "admin",
      role: "administrator",
      authentication: "Internal",
    },
    {
      id: "2",
      name: "unitech",
      role: "administrator",
      authentication: "Internal",
    },
  ]);

  // State for search and selection
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Validation logic
  const isUsernameValid = formData.username.length >= 3;
  const isPasswordValid = formData.password.length >= 6;
  const isConfirmValid =
    formData.confirmPassword.length > 0 &&
    formData.confirmPassword === formData.password;
  const isFormValid = isUsernameValid && isPasswordValid && isConfirmValid;

  const handleCreateUser = () => {
    if (!isFormValid) return;

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: formData.username,
      role: formData.isAdmin ? "administrator" : "standard",
      authentication: "Internal",
    };

    setUsers([...users, newUser]);
    setFormData({
      username: "",
      password: "",
      confirmPassword: "",
      isAdmin: false,
      teams: [],
    });
    setShowAddForm(false);

    showNotification({
      type: "success",
      message: "User created successfully",
      description: `User ${newUser.name} has been added to the system.`,
    });
  };

  const handleDeleteUsers = () => {
    setUsers(users.filter((u) => !selectedUserIds.has(u.id)));
    setSelectedUserIds(new Set());
    setShowDeleteConfirm(false);
    showNotification({
      type: "success",
      message: "Users removed",
      description: "Selected users have been deleted.",
    });
  };

  const toggleUserSelection = (id: string) => {
    const newSelection = new Set(selectedUserIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedUserIds(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedUserIds.size === filteredUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [users, searchTerm]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          Users{" "}
          <RefreshCw
            size={16}
            className="text-zinc-500 cursor-pointer hover:text-white transition-colors"
          />
        </h1>
      </div>

      {/* Add User Section */}
      <div className="bg-[#1c1c1c] border border-zinc-800 rounded-sm overflow-hidden">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white hover:bg-zinc-800/50 transition-colors border-b border-zinc-800"
        >
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center cursor-pointer">
            <Plus size={16} className="text-white" />
          </div>
          <span className="text-white text-lg">Add a new user</span>
        </button>

        {showAddForm && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-[160px_1fr] items-center gap-4">
              <label className="text-sm text-white">
                Username<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none transition-all pr-10"
                />
                {formData.username && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 border-l-2 border-white">
                    {isUsernameValid ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <X size={16} className="text-red-500" />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[160px_1fr] items-start gap-4">
              <label className="text-sm text-white pt-2">
                Password<span className="text-red-500">*</span>
              </label>
              <div className="space-y-1">
                <div className="relative">
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none transition-all pr-10"
                  />
                  {formData.password && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isPasswordValid ? (
                        <Check size={16} className="text-green-500" />
                      ) : (
                        <X size={16} className="text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {!isPasswordValid && formData.password && (
                  <p className="text-[#f1c40f] text-[11px] flex items-center gap-1 font-bold">
                    <AlertTriangle size={12} /> Password is required (min 6
                    chars)
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[160px_1fr] items-center gap-4">
              <label className="text-sm text-white">
                Confirm password<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 outline-none transition-all pr-10"
                />
                {formData.confirmPassword && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isConfirmValid ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <X size={16} className="text-red-500" />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-[160px_1fr] items-center gap-4">
              <div className="flex items-center gap-1">
                <label className="text-sm text-white">Administrator</label>
                <HelpCircle size={16} className="text-zinc-500 cursor-help" />
              </div>
              <div
                onClick={() =>
                  setFormData({ ...formData, isAdmin: !formData.isAdmin })
                }
                className={cn(
                  "w-10 h-5 rounded-full relative cursor-pointer transition-colors duration-200",
                  formData.isAdmin ? "bg-blue-600" : "bg-zinc-800",
                )}
              >
                <div
                  className={cn(
                    "absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform duration-200",
                    formData.isAdmin ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </div>
            </div>

            <div
              className={cn(
                "grid transition-all duration-300 ease-in-out",
                formData.isAdmin
                  ? "grid-rows-[0fr] opacity-0"
                  : "grid-rows-[1fr] opacity-100",
              )}
            >
              <div className="overflow-hidden space-y-6">
                <div className="grid grid-cols-[160px_1fr] items-center gap-4 pt-2">
                  <label className="text-sm text-white">Add to team(s)</label>
                  <div className="relative">
                    <select className="w-full bg-[#121212] border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-500 outline-none cursor-not-allowed appearance-none">
                      <option>Select...</option>
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                    />
                  </div>
                </div>

                <div className="text-[#3498db] text-xs flex gap-2 items-start max-w-2xl font-medium">
                  <Info size={14} className="shrink-0 mt-0.5" />
                  <p className="text-white">
                    Note: non-administrator users who aren't in a team don't
                    have access to any environments by default. Head over to the{" "}
                    <span className="underline cursor-pointer">
                      Environments view
                    </span>{" "}
                    to manage their accesses.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <h3 className="text-sm font-bold text-white mb-4">Actions</h3>
              <button
                onClick={handleCreateUser}
                disabled={!isFormValid}
                className={cn(
                  "px-4 py-1.5 rounded text-sm transition-all flex items-center gap-2 cursor-pointer",
                  isFormValid
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-700 hover:text-gray-100"
                    : "bg-gray-900 text-gray-600 cursor-not-allowed border border-gray-800",
                )}
              >
                <Plus size={14} /> Create user
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Users List Section */}
      <div className="bg-[#1c1c1c] border border-zinc-800 rounded-sm overflow-hidden pt-4 pb-2">
        <div className="flex items-center justify-between px-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center">
              <UsersIcon size={16} />
            </div>
            <span className="text-sm font-bold text-white">Users</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#121212] border border-zinc-800 rounded px-8 py-2 text-xs text-zinc-300 focus:border-zinc-700 outline-none w-48 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              disabled={selectedUserIds.size === 0}
              onClick={() => setShowDeleteConfirm(true)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all shadow-lg",
                selectedUserIds.size > 0
                  ? "bg-red-600 text-white hover:bg-red-700 shadow-red-900/20"
                  : "bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed opacity-50",
              )}
            >
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-left">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={
                      selectedUserIds.size === filteredUsers.length &&
                      filteredUsers.length > 0
                    }
                    onChange={toggleAllSelection}
                    className="w-4 h-4 rounded border-zinc-800 bg-[#121212] accent-blue-600 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase">
                  Name <span className="inline-block ml-1">↑↓</span>
                </th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase">
                  Role <span className="inline-block ml-1">↑↓</span>
                </th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-400 uppercase">
                  Authentication <span className="inline-block ml-1">↑↓</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className={cn(
                    "hover:bg-zinc-800/30 transition-colors",
                    selectedUserIds.has(user.id) ? "bg-blue-900/10" : "",
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                      className="w-4 h-4 rounded border-zinc-800 bg-[#121212] accent-blue-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-bold text-blue-400 cursor-pointer hover:underline">
                      {user.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-zinc-300">
                      <UserIcon size={14} className="text-zinc-500" />
                      {user.role}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-zinc-300">
                      {user.authentication}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-zinc-500 text-sm"
                  >
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Mock */}
        <div className="flex items-center justify-end px-4 py-4 gap-4">
          <div className="flex items-center gap-2 border border-zinc-800 rounded px-2 py-1 bg-[#121212]">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
              Items per page
            </span>
            <select className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer pr-1">
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
            <ChevronDown size={12} className="text-zinc-500" />
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#1c1c1c] border border-zinc-800 rounded-sm shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={20} />
                Confirm Removal
              </h2>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-zinc-300 text-sm leading-relaxed">
                Are you sure you want to remove the selected{" "}
                <span className="text-white font-bold">
                  {selectedUserIds.size}
                </span>{" "}
                user(s)? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 bg-zinc-900/30 border-t border-zinc-800 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUsers}
                className="px-6 py-2 rounded text-xs font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-900/20 transition-all"
              >
                Remove users
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
