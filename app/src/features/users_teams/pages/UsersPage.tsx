"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Trash2,
  Shield,
  Lock,
  Settings2,
  Users as UsersIcon,
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
import { Badge } from "@/shared/ui/Badge";

interface User {
  id: string;
  name: string;
  role: "administrator" | "standard";
  authentication: string;
  created: string;
}

export default function UsersPage() {
  const { showNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState("");

  const [users, setUsers] = useState<User[]>([
    {
      id: "1",
      name: "admin",
      role: "administrator",
      authentication: "Internal",
      created: "2026-03-10",
    },
    {
      id: "2",
      name: "unitech",
      role: "administrator",
      authentication: "Internal",
      created: "2026-03-12",
    },
    {
      id: "3",
      name: "jdoe",
      role: "standard",
      authentication: "OIDC",
      created: "2026-03-15",
    },
  ]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [users, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <UsersIcon className="h-6 w-6 text-indigo-500" />
            Users
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage user accounts, authentication types, and administrative
            roles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={() =>
              showNotification({
                type: "info",
                message: "Create User",
                description: "Opening user creation form...",
              })
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="w-full sm:max-w-xs">
          <Input
            icon={<Search className="h-4 w-4 text-zinc-400" />}
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Authentication</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <UsersIcon size={32} className="mb-3 opacity-20" />
                    <p className="text-[13px] font-medium">No users found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="group">
                  <TableCell>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-pointer">
                      {user.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.role === "administrator" ? "error" : "outline"
                      }
                    >
                      <Shield className="w-3 h-3 mr-1 inline" />
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                      <Lock size={12} />
                      {user.authentication}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                    {user.created}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-zinc-800"
                        title="Manage User"
                        onClick={() =>
                          showNotification({
                            type: "info",
                            message: "Manage User",
                            description: `Open settings for ${user.name}`,
                          })
                        }
                      >
                        <Settings2 size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete User"
                        onClick={() => {
                          if (confirm(`Remove user ${user.name}?`)) {
                            setUsers(users.filter((u) => u.id !== user.id));
                            showNotification({
                              type: "error",
                              message: "User Deleted",
                              description: `Removed user ${user.name}`,
                            });
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
