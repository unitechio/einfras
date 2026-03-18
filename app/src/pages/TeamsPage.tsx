"use client";

import { useState, useMemo } from "react";
import {
  Search,
  RefreshCw,
  Trash2,
  X,
  Plus,
  AlertTriangle,
  Users as UsersIcon,
} from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
}

export default function TeamsPage() {
  const { showNotification } = useNotification();

  const [showAddForm, setShowAddForm] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teams, setTeams] = useState<Team[]>([
    { id: "1", name: "KTCN" },
    { id: "2", name: "NOC" },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(
    new Set(),
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isTeamNameValid = teamName.trim().length >= 1;

  const handleCreateTeam = () => {
    if (!isTeamNameValid) return;

    const newTeam: Team = {
      id: Math.random().toString(36).substr(2, 9),
      name: teamName.trim(),
    };

    setTeams([...teams, newTeam]);
    setTeamName("");
    setShowAddForm(false);

    showNotification({
      type: "success",
      message: "Team created successfully",
      description: `Team ${newTeam.name} has been added.`,
    });
  };

  const handleDeleteTeams = () => {
    setTeams(teams.filter((t) => !selectedTeamIds.has(t.id)));
    setSelectedTeamIds(new Set());
    setShowDeleteConfirm(false);
    showNotification({
      type: "success",
      message: "Teams removed",
      description: "Selected teams have been deleted.",
    });
  };

  const toggleTeamSelection = (id: string) => {
    const newSelection = new Set(selectedTeamIds);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedTeamIds(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedTeamIds.size === filteredTeams.length) {
      setSelectedTeamIds(new Set());
    } else {
      setSelectedTeamIds(new Set(filteredTeams.map((t) => t.id)));
    }
  };

  const filteredTeams = useMemo(() => {
    return teams.filter((t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [teams, searchTerm]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          Teams{" "}
          <RefreshCw
            size={16}
            className="text-gray- cursor-pointer hover:text-white transition-colors"
          />
        </h1>
      </div>

      {/* Add Team Section */}
      <div className="bg-[#1c1c1c] border border-gray- rounded-sm overflow-hidden">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white hover:bg-gray-/50 transition-colors border-b border-gray-"
        >
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center cursor-pointer">
            <Plus size={16} className="text-white" />
          </div>
          <span className="text-white text-lg">Add a new team</span>
        </button>

        {showAddForm && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-[160px_1fr] items-center gap-4">
              <label className="text-sm font-bold text-white">
                Name<span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. development"
                  className="w-full bg-[#121212] border border-gray- rounded px-3 py-2 text-sm text-gray- focus:border-gray- outline-none transition-all"
                />
              </div>
            </div>

            {!isTeamNameValid && teamName.length > 0 && (
              <p className="text-[#f1c40f] text-[11px] flex items-center gap-1 font-bold">
                <AlertTriangle size={12} /> This field is required.
              </p>
            )}

            <div className="pt-4 border-t border-gray-">
              <h3 className="text-sm font-bold text-white mb-4">Actions</h3>
              <button
                onClick={handleCreateTeam}
                disabled={!isTeamNameValid}
                className={cn(
                  "px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2",
                  isTeamNameValid
                    ? "bg-gray- text-white hover:bg-gray-"
                    : "bg-gray-00 text-gray- cursor-not-allowed border border-gray-",
                )}
              >
                <Plus size={14} /> Create team
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Teams List Section */}
      <div className="bg-[#1c1c1c] border border-gray- rounded-sm overflow-hidden pt-4 pb-2">
        <div className="flex items-center justify-between px-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center">
              <UsersIcon size={16} />
            </div>
            <span className="text-sm font-bold text-white">Teams</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#121212] border border-gray- rounded px-8 py-2 text-xs text-gray- focus:border-gray- outline-none w-48 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray- hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <button
              disabled={selectedTeamIds.size === 0}
              onClick={() => setShowDeleteConfirm(true)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all shadow-lg",
                selectedTeamIds.size > 0
                  ? "bg-red-600 text-white hover:bg-red-700 shadow-red-900/20"
                  : "bg-gray- text-gray- border border-gray- cursor-not-allowed opacity-50",
              )}
            >
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray- text-left">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={
                      selectedTeamIds.size === filteredTeams.length &&
                      filteredTeams.length > 0
                    }
                    onChange={toggleAllSelection}
                    className="w-4 h-4 rounded border-gray- bg-[#121212] accent-blue-600 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray- uppercase">
                  Name <span className="inline-block ml-1">↑↓</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-/50">
              {filteredTeams.map((team) => (
                <tr
                  key={team.id}
                  className={cn(
                    "hover:bg-gray-/30 transition-colors",
                    selectedTeamIds.has(team.id) ? "bg-blue-900/10" : "",
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedTeamIds.has(team.id)}
                      onChange={() => toggleTeamSelection(team.id)}
                      className="w-4 h-4 rounded border-gray- bg-[#121212] accent-blue-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-bold text-blue-400 cursor-pointer hover:underline">
                      {team.name}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredTeams.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-12 text-center text-gray- text-sm"
                  >
                    No teams found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-end px-4 py-4 gap-4">
          <div className="flex items-center gap-2 border border-gray- rounded px-2 py-1 bg-[#121212]">
            <span className="text-[10px] font-bold text-gray- uppercase tracking-tighter">
              Items per page
            </span>
            <select className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer pr-1">
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#1c1c1c] border border-gray- rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gray-/50 border-b border-gray- flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={20} /> Confirm
                Removal
              </h2>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-gray- hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray- text-sm leading-relaxed">
                Are you sure you want to remove the selected{" "}
                <span className="text-white font-bold">
                  {selectedTeamIds.size}
                </span>{" "}
                team(s)? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-/30 border-t border-gray- flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded text-xs font-bold text-gray- hover:text-white hover:bg-gray- transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTeams}
                className="px-6 py-2 rounded text-xs font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-900/20 transition-all"
              >
                Remove teams
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

