"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Layers3,
  Plus,
  Search,
  Trash2,
  UsersIcon,
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
import { usersTeamsApi, type TeamRecord, type UserRecord } from "../api";

type TeamSortKey = "name" | "slug";

type TeamFormState = {
  name: string;
  slug: string;
  description: string;
  member_ids: string[];
};

const emptyForm: TeamFormState = {
  name: "",
  slug: "",
  description: "",
  member_ids: [],
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function TeamsPage() {
  const { showNotification } = useNotification();
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalTeams, setTotalTeams] = useState(0);
  const [sortBy, setSortBy] = useState<TeamSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [form, setForm] = useState<TeamFormState>(emptyForm);
  const [deleteCandidate, setDeleteCandidate] = useState<TeamRecord | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void loadData();
  }, [page, searchTerm, sortBy, sortDir]);

  const selectedTeam = useMemo(
    () => teams.find((item) => item.id === selectedTeamId) ?? null,
    [selectedTeamId, teams],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalTeams / 10)),
    [totalTeams],
  );

  async function loadData() {
    setIsLoading(true);
    try {
      const [teamsResult, usersResult] = await Promise.all([
        usersTeamsApi.listTeams({
          page,
          page_size: 10,
          search: searchTerm,
          sort_by: sortBy,
          sort_dir: sortDir,
        }),
        usersTeamsApi.listUsers({ page: 1, page_size: 100 }),
      ]);
      setTeams(teamsResult.items);
      setTotalTeams(teamsResult.meta?.total ?? teamsResult.items.length);
      setUsers(usersResult.items);
      if (!selectedTeamId && teamsResult.items[0]) {
        applyTeamToForm(teamsResult.items[0]);
      }
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to load teams",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function applyTeamToForm(team: TeamRecord) {
    setSelectedTeamId(team.id);
    setIsCreating(false);
    setForm({
      name: team.name,
      slug: team.slug,
      description: team.description,
      member_ids: [...team.member_ids],
    });
  }

  function startCreate() {
    setSelectedTeamId(null);
    setIsCreating(true);
    setForm(emptyForm);
  }

  function toggleMember(userID: string) {
    setForm((current) => ({
      ...current,
      member_ids: current.member_ids.includes(userID)
        ? current.member_ids.filter((item) => item !== userID)
        : [...current.member_ids, userID],
    }));
  }

  function handleSort(nextSortBy: TeamSortKey) {
    setPage(1);
    if (sortBy === nextSortBy) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(nextSortBy);
    setSortDir("asc");
  }

  function renderSortIcon(column: TeamSortKey) {
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
      member_ids: form.member_ids,
    };
    if (!payload.name || !payload.slug) {
      showNotification({
        type: "error",
        message: "Missing required fields",
        description: "Team name and slug are required.",
      });
      return;
    }
    setIsSaving(true);
    try {
      if (isCreating) {
        const created = await usersTeamsApi.createTeam(payload);
        const nextTeams = [...teams, created];
        setTeams(nextTeams);
        applyTeamToForm(created);
        showNotification({
          type: "success",
          message: "Team created",
          description: `${created.name} is ready to receive members.`,
        });
      } else if (selectedTeam) {
        const updated = await usersTeamsApi.updateTeam(selectedTeam.id, payload);
        setTeams((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        applyTeamToForm(updated);
        showNotification({
          type: "success",
          message: "Team updated",
          description: `${updated.name} membership was synced.`,
        });
      }
    } catch (err) {
      showNotification({
        type: "error",
        message: isCreating ? "Unable to create team" : "Unable to update team",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(team: TeamRecord) {
    try {
      await usersTeamsApi.deleteTeam(team.id);
      const nextTeams = teams.filter((item) => item.id !== team.id);
      setTeams(nextTeams);
      if (selectedTeamId === team.id) {
        if (nextTeams[0]) {
          applyTeamToForm(nextTeams[0]);
        } else {
          startCreate();
        }
      }
      showNotification({
        type: "success",
        message: "Team deleted",
        description: `${team.name} was removed.`,
      });
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to delete team",
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
            Teams
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Organize people into access groups that power ownership and ABAC checks.
          </p>
        </div>
        <Button variant="primary" onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Team
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              icon={<Search className="h-4 w-4 text-zinc-400" />}
              placeholder="Search team name or slug"
              value={searchInput}
              onChange={(event) => {
                setPage(1);
                setSearchInput(event.target.value);
              }}
            />
            <div className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-300">
              {totalTeams} teams
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button type="button" onClick={() => handleSort("name")} className="inline-flex items-center gap-1 text-left">
                      Team
                      {renderSortIcon("name")}
                    </button>
                  </TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-40 text-center text-zinc-500">
                      Loading teams...
                    </TableCell>
                  </TableRow>
                ) : teams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-40 text-center text-zinc-500">
                      No teams found.
                    </TableCell>
                  </TableRow>
                ) : (
                  teams.map((team) => (
                    <TableRow
                      key={team.id}
                      onClick={() => applyTeamToForm(team)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40",
                        selectedTeamId === team.id && "bg-indigo-50 dark:bg-zinc-900/70",
                      )}
                    >
                      <TableCell>
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {team.name}
                        </div>
                        <div className="text-xs text-zinc-500">{team.slug}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {team.description || "No description"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{team.member_count} members</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteCandidate(team);
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
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300">
                <Layers3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                  {isCreating ? "Create team" : selectedTeam ? `Edit ${selectedTeam.name}` : "Select a team"}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Membership here will flow into tenant-scoped team checks.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Team name
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
                placeholder="Production Operators"
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
                placeholder="production-operators"
              />
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
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                placeholder="Handles prod server changes, shell access and on-call response."
              />
            </div>

            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Team members
              </h3>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                Select the users who should inherit this team context.
              </p>
              <div className="grid max-h-96 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                {users.map((user) => (
                  <label
                    key={user.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition-colors",
                      form.member_ids.includes(user.id)
                        ? "border-cyan-400 bg-cyan-50/70 dark:border-cyan-500/40 dark:bg-cyan-500/10"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={form.member_ids.includes(user.id)}
                      onChange={() => toggleMember(user.id)}
                      className="mt-1 h-4 w-4 rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {user.full_name || user.username}
                      </div>
                      <div className="text-xs text-zinc-500">{user.email}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {user.roles.map((role) => (
                          <Badge key={role} variant="outline">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </label>
                ))}
                {users.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300 px-3 py-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    No users available yet.
                  </div>
                ) : null}
              </div>
            </div>
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
                if (selectedTeam) {
                  applyTeamToForm(selectedTeam);
                  return;
                }
                startCreate();
              }}
            >
              Reset form
            </Button>
            <Button variant="primary" onClick={() => void handleSubmit()} isLoading={isSaving}>
              {isCreating ? "Create Team" : "Save Changes"}
            </Button>
          </div>
        </section>
      </div>
    </div>
    <ConfirmActionDialog
      open={!!deleteCandidate}
      title="Remove team?"
      description={deleteCandidate ? `This removes team ${deleteCandidate.name} and its member mapping.` : ""}
      confirmLabel="Remove Team"
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
