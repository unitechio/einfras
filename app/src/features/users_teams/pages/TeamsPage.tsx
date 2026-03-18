"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Trash2, UsersIcon, Settings2 } from "lucide-react";
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

interface Team {
  id: string;
  name: string;
  membersCount: number;
}

export default function TeamsPage() {
  const { showNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState("");

  const [teams, setTeams] = useState<Team[]>([
    { id: "1", name: "KTCN", membersCount: 12 },
    { id: "2", name: "NOC", membersCount: 4 },
    { id: "3", name: "DevOps", membersCount: 8 },
  ]);

  const filteredTeams = useMemo(() => {
    return teams.filter((t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [teams, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <UsersIcon className="h-6 w-6 text-indigo-500" />
            Teams
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Group users together for easier access control and management.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            onClick={() =>
              showNotification({
                type: "info",
                message: "Create Team",
                description: "Opening team creation form...",
              })
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Team
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="w-full sm:max-w-xs">
          <Input
            icon={<Search className="h-4 w-4 text-zinc-400" />}
            placeholder="Search teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Name</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <UsersIcon size={32} className="mb-3 opacity-20" />
                    <p className="text-[13px] font-medium">No teams found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredTeams.map((team) => (
                <TableRow key={team.id} className="group">
                  <TableCell>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors cursor-pointer">
                      {team.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400 font-medium bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                      {team.membersCount} users
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-400 dark:hover:bg-zinc-800"
                        title="Manage Team"
                        onClick={() =>
                          showNotification({
                            type: "info",
                            message: "Manage Team",
                            description: `Open settings for ${team.name}`,
                          })
                        }
                      >
                        <Settings2 size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete Team"
                        onClick={() => {
                          if (confirm(`Remove team ${team.name}?`)) {
                            setTeams(teams.filter((t) => t.id !== team.id));
                            showNotification({
                              type: "error",
                              message: "Team Deleted",
                              description: `Removed team ${team.name}`,
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
