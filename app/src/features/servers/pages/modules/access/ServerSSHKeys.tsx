import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  ClipboardCopy,
  Eye,
  EyeOff,
  Info,
  Key,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";

import { useNotification } from "@/core/NotificationContext";
import { accessApi, type TypedControlResult } from "@/shared/api/client";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";

/* ─── types ─── */
type ServerUserRow = { username: string; uid: number; gid: number; home: string; shell: string };

type SSHKeyEntry = {
  id: string;
  value: string;
  keyType: string;
  comment: string;
  fingerprint: string;
  lineIndex: number;
};

type KeyGenType = "ed25519" | "rsa";

/* ─── helpers ─── */
function parseKey(line: string, index: number): SSHKeyEntry {
  const parts = line.trim().split(/\s+/);
  const keyType = parts[0] ?? "unknown";
  const comment = parts.length >= 3 ? parts.slice(2).join(" ") : "";
  const keyBody = parts[1] ?? "";
  const fingerprint = keyBody.length > 20 ? `${keyBody.slice(0, 8)}…${keyBody.slice(-8)}` : keyBody;
  return {
    id: `${index}-${keyBody.slice(0, 12)}`,
    value: line,
    keyType,
    comment,
    fingerprint,
    lineIndex: index,
  };
}

function riskLevel(username: string, uid: number): { label: string; color: string; icon: string } {
  if (uid === 0 || username === "root") return { label: "High Privilege", color: "red", icon: "🔴" };
  if (uid < 1000) return { label: "System Account", color: "amber", icon: "🟡" };
  return { label: "Standard User", color: "emerald", icon: "🟢" };
}

/* ─── user dropdown ─── */
function UserDropdown({
  users,
  selected,
  onSelect,
  keyCounts,
  disabled,
}: {
  users: ServerUserRow[];
  selected: string;
  onSelect: (username: string) => void;
  keyCounts: Record<string, number>;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = users.filter(
    (u) => u.username.toLowerCase().includes(search.toLowerCase()) || String(u.uid).includes(search),
  );
  const selectedUser = users.find((u) => u.username === selected);
  const risk = selectedUser ? riskLevel(selectedUser.username, selectedUser.uid) : null;

  return (
    <div ref={ref} className="relative min-w-[200px]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200/70 bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:border-blue-400/60 dark:border-zinc-800/70 dark:bg-zinc-900 dark:text-zinc-200 disabled:opacity-50"
      >
        <div className="flex items-center gap-2">
          <User size={14} className="text-zinc-400" />
          <span className="font-semibold">{selected || "Select user"}</span>
          {risk && <span className="text-[11px]">{risk.icon}</span>}
          {selectedUser && (
            <span className="text-[11px] text-zinc-400">UID {selectedUser.uid}</span>
          )}
        </div>
        <ChevronDown size={14} className="shrink-0 text-zinc-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-xl border border-zinc-200/60 bg-white shadow-xl dark:border-zinc-800/60 dark:bg-zinc-900">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={13} />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users…"
                className="w-full rounded-lg border border-zinc-200/60 bg-zinc-50 pl-8 pr-3 py-1.5 text-[13px] outline-none dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-200"
              />
            </div>
          </div>
          <ul className="max-h-60 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-center text-[12px] text-zinc-400">No users found</li>
            ) : (
              filtered.map((u) => {
                const r = riskLevel(u.username, u.uid);
                const keyCount = keyCounts[u.username] ?? 0;
                return (
                  <li
                    key={u.username}
                    onClick={() => { onSelect(u.username); setOpen(false); setSearch(""); }}
                    className={`flex cursor-pointer items-center justify-between px-4 py-2.5 transition hover:bg-blue-50 dark:hover:bg-blue-900/20 ${u.username === selected ? "bg-blue-50/60 dark:bg-blue-900/10" : ""}`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px]">{r.icon}</span>
                        <span className="font-semibold text-[13px] text-zinc-800 dark:text-zinc-100">{u.username}</span>
                        <span className="text-[11px] text-zinc-400">UID {u.uid}</span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{u.home}</div>
                    </div>
                    <span className={`text-[11px] font-medium ${keyCount > 0 ? "text-blue-600 dark:text-blue-400" : "text-zinc-400"}`}>
                      {keyCount > 0 ? `${keyCount} key${keyCount > 1 ? "s" : ""}` : "no keys"}
                    </span>
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

/* ─── key card ─── */
function SSHKeyCard({
  entry,
  onDelete,
  onCopy,
}: {
  entry: SSHKeyEntry;
  onDelete: (entry: SSHKeyEntry) => void;
  onCopy: (text: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const isRedacted = entry.value.includes("…") || entry.value.includes("*");

  const keyTypeBadge =
    entry.keyType === "ssh-ed25519"
      ? { label: "ED25519", bg: "bg-emerald-50 text-emerald-600 border-emerald-200/60 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/60" }
      : entry.keyType === "ssh-rsa"
        ? { label: "RSA", bg: "bg-blue-50 text-blue-600 border-blue-200/60 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/60" }
        : { label: entry.keyType, bg: "bg-zinc-50 text-zinc-600 border-zinc-200/60 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800/60" };

  return (
    <div className="group relative rounded-xl border border-zinc-200/60 bg-white p-5 shadow-sm transition hover:border-blue-500/40 hover:shadow-md dark:border-zinc-800/60 dark:bg-[#121212] dark:hover:border-blue-500/40">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-blue-100/50 bg-blue-50 p-2.5 text-blue-600 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-400">
            <Key size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Key #{entry.lineIndex + 1}
              </h3>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${keyTypeBadge.bg}`}>
                {keyTypeBadge.label}
              </span>
            </div>
            {entry.comment && (
              <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">{entry.comment}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(entry)}
          className="invisible rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 group-hover:visible dark:hover:bg-red-900/20 dark:hover:text-red-400"
          title="Delete key"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Fingerprint / key preview */}
      <div className="mt-4 rounded-lg border border-zinc-200/50 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800/50 dark:bg-[#1A1A1A]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Fingerprint</span>
          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{entry.fingerprint}</span>
        </div>
        {revealed && (
          <div className="mt-2 break-all font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
            {entry.value}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => onCopy(entry.value)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/60 bg-zinc-50 px-2.5 py-1 text-[12px] font-medium text-zinc-600 transition hover:border-blue-400/60 hover:bg-blue-50 hover:text-blue-600 dark:border-zinc-800/60 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-blue-400"
        >
          <ClipboardCopy size={12} />
          Copy
        </button>
        <button
          onClick={() => setRevealed((p) => !p)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/60 bg-zinc-50 px-2.5 py-1 text-[12px] font-medium text-zinc-600 transition hover:border-amber-400/60 hover:bg-amber-50 hover:text-amber-600 dark:border-zinc-800/60 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-amber-400"
        >
          {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
          {revealed ? "Hide" : "Reveal"}
        </button>
        {isRedacted && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-400">
            <Info size={11} />
            Partially hidden for security
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1 text-[11px] text-zinc-400">
        <Calendar size={11} />
        Synced {new Date().toLocaleString()}
      </div>
    </div>
  );
}

/* ─── main component ─── */
export default function ServerSSHKeys() {
  const { serverId = "" } = useParams();
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<ServerUserRow[]>([]);
  const [targetUser, setTargetUser] = useState("root");
  const [preview, setPreview] = useState("");
  const [resultMeta, setResultMeta] = useState<TypedControlResult | null>(null);
  const [keyCounts, setKeyCounts] = useState<Record<string, number>>({});

  /* modals */
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<SSHKeyEntry | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* add key form */
  const [newKeyValue, setNewKeyValue] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  /* generate key form */
  const [genType, setGenType] = useState<KeyGenType>("ed25519");
  const [genComment, setGenComment] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  /* clipboard feedback */
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const inFlightKey = useRef<string | null>(null);

  /* ── load users ── */
  const loadUsers = async () => {
    if (!serverId) return;
    try {
      const response = await accessApi.action(serverId, { action: "list-users" });
      const result = (response.result ?? null) as TypedControlResult<ServerUserRow[]> | null;
      const data = Array.isArray(result?.data) ? result!.data as ServerUserRow[] : [];
      setUsers(data);
    } catch {
      /* non-blocking — SSH Keys can work even if user list fails */
    }
  };

  /* ── load ssh keys ── */
  const loadKeys = async (user = targetUser) => {
    if (!serverId) return;
    const requestKey = `${serverId}:${user}`;
    if (inFlightKey.current === requestKey) return;
    inFlightKey.current = requestKey;
    setLoading(true);
    try {
      const response = await accessApi.action(serverId, { action: "list-ssh-keys", target: user });
      const result = (response.result ?? null) as TypedControlResult | null;
      setPreview(result?.preview ?? "");
      setResultMeta(result);
    } catch (error) {
      showNotification({
        type: "error",
        message: "Unable to load SSH keys",
        description: error instanceof Error ? error.message : "Request failed. The agent may not support list-ssh-keys — ensure the agent is online and has the access skill.",
      });
      setPreview("");
      setResultMeta(null);
    } finally {
      if (inFlightKey.current === requestKey) inFlightKey.current = null;
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [serverId]);

  useEffect(() => {
    void loadKeys(targetUser);
  }, [serverId, targetUser]);

  const entries = useMemo<SSHKeyEntry[]>(() => {
    if (!preview.trim()) return [];
    return preview
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line, i) => parseKey(line, i));
  }, [preview]);

  /* Keep per-user key counts so the dropdown shows them */
  useEffect(() => {
    setKeyCounts((prev) => ({ ...prev, [targetUser]: entries.length }));
  }, [entries, targetUser]);

  const selectedUser = users.find((u) => u.username === targetUser);
  const risk = selectedUser ? riskLevel(selectedUser.username, selectedUser.uid) : null;

  /* ── add key ── */
  const handleAddKey = async () => {
    if (!serverId || !newKeyValue.trim()) return;
    setAddLoading(true);
    try {
      await accessApi.action(serverId, { action: "add-ssh-key", target: targetUser, payload: newKeyValue.trim() });
      showNotification({ type: "success", message: "SSH key added", description: `Authorized key updated for ${targetUser}.` });
      setNewKeyValue("");
      setShowAddModal(false);
      await loadKeys();
    } catch (error) {
      showNotification({ type: "error", message: "Unable to add SSH key", description: error instanceof Error ? error.message : "Request failed." });
    } finally {
      setAddLoading(false);
    }
  };

  /* ── delete key ── */
  const handleDeleteKey = async (entry: SSHKeyEntry) => {
    if (!serverId) return;
    setDeleteLoading(true);
    try {
      await accessApi.action(serverId, {
        action: "delete-ssh-key",
        target: targetUser,
        payload: JSON.stringify({ line_index: entry.lineIndex, key_value: entry.value }),
      });
      showNotification({ type: "success", message: "SSH key removed", description: `Key #${entry.lineIndex + 1} deleted from ${targetUser}.` });
      setDeleteCandidate(null);
      await loadKeys();
    } catch (error) {
      showNotification({ type: "error", message: "Unable to delete key", description: error instanceof Error ? error.message : "Request failed." });
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ── generate key ── */
  const handleGenerateKey = async () => {
    if (!serverId) return;
    setGenLoading(true);
    try {
      await accessApi.action(serverId, {
        action: "generate-ssh-key",
        target: targetUser,
        payload: JSON.stringify({ type: genType, comment: genComment.trim() || `generated-${Date.now()}` }),
      });
      showNotification({ type: "success", message: "SSH key generated", description: `New ${genType.toUpperCase()} key added for ${targetUser}.` });
      setShowGenModal(false);
      setGenComment("");
      await loadKeys();
    } catch (error) {
      showNotification({ type: "error", message: "Unable to generate key", description: error instanceof Error ? error.message : "Request failed." });
    } finally {
      setGenLoading(false);
    }
  };

  /* ── copy ── */
  const handleCopy = (text: string, id?: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId((p) => (p === id ? null : p)), 2000);
      }
      showNotification({ type: "success", message: "Copied to clipboard" });
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            <div className="rounded-lg border border-blue-100/50 bg-blue-50 p-2 dark:border-blue-500/20 dark:bg-blue-500/10">
              <Key className="text-blue-500" size={20} />
            </div>
            SSH Keys
          </h2>
          <p className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-400">
            Manage authorized keys per-user directly on the node.
          </p>
        </div>

        {/* Controls row: user dropdown + refresh + add */}
        <div className="flex flex-wrap items-center gap-2">
          <UserDropdown
            users={users}
            selected={targetUser}
            onSelect={setTargetUser}
            keyCounts={keyCounts}
            disabled={loading}
          />
          {users.length === 0 && (
            <Input
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              placeholder="username"
              className="w-[140px]"
            />
          )}
          <Button variant="outline" onClick={() => void loadKeys()} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setShowGenModal(true)}>
            <Sparkles size={16} className="mr-2 text-amber-500" />
            Generate Key
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} className="mr-2" />
            Add SSH Key
          </Button>
        </div>
      </div>

      {/* ── User Info Card ── */}
      {selectedUser && risk && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200/60 bg-white px-5 py-3.5 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200/60 bg-zinc-100 dark:border-zinc-800/60 dark:bg-zinc-900">
              <User size={16} className="text-zinc-500" />
            </div>
            <div>
              <div className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100">{selectedUser.username}</div>
              <div className="text-[12px] text-zinc-400">{selectedUser.home}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 ml-auto">
            <div className="text-center">
              <div className="text-[18px] font-bold text-zinc-800 dark:text-zinc-100">{entries.length}</div>
              <div className="text-[11px] text-zinc-400">SSH keys</div>
            </div>
            <div className="text-center">
              <div className="text-[18px] font-bold text-zinc-800 dark:text-zinc-100">{selectedUser.uid}</div>
              <div className="text-[11px] text-zinc-400">UID</div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold ${
                risk.color === "red"
                  ? "border-red-200/60 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-400"
                  : risk.color === "amber"
                    ? "border-amber-200/60 bg-amber-50 text-amber-600 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-400"
                    : "border-emerald-200/60 bg-emerald-50 text-emerald-600 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-400"
              }`}
            >
              <Shield size={12} />
              {risk.label}
            </span>
          </div>
        </div>
      )}

      {/* Root warning banner */}
      {(targetUser === "root" || selectedUser?.uid === 0) && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200/60 bg-red-50/60 p-4 dark:border-red-900/40 dark:bg-red-900/10">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
          <div>
            <p className="text-[13px] font-semibold text-red-700 dark:text-red-400">High-privilege account</p>
            <p className="text-[12px] text-red-600 dark:text-red-500">
              You are managing SSH keys for <strong>root</strong>. Keys added here have full access to the node. Proceed with caution.
            </p>
          </div>
        </div>
      )}

      {/* Security notice */}
      {resultMeta?.redactions?.length ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200/50 bg-amber-50/60 px-4 py-2.5 text-[12px] text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-400">
          <Info size={14} />
          For security, SSH keys are partially hidden. Click <strong>"Reveal"</strong> on any key card to view the full value.
          <span className="ml-auto text-[11px] text-amber-500">{resultMeta.redactions.length} segments redacted</span>
        </div>
      ) : null}

      {/* ── Keys grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border border-zinc-200/60 bg-white dark:border-zinc-800/60 dark:bg-[#121212]" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300/60 bg-white py-16 text-center dark:border-zinc-700/60 dark:bg-[#121212]">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-900/20">
            <Key size={28} className="text-blue-400" />
          </div>
          <h3 className="text-[16px] font-bold text-zinc-800 dark:text-zinc-100">
            No SSH keys found for {targetUser}
          </h3>
          <p className="mt-2 max-w-xs text-[13px] text-zinc-500 dark:text-zinc-400">
            Add a new SSH key to enable secure, password-less access to this server.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              <Plus size={15} className="mr-2" />
              Add SSH Key
            </Button>
            <Button variant="outline" onClick={() => setShowGenModal(true)}>
              <Sparkles size={15} className="mr-2 text-amber-500" />
              Generate Key
            </Button>
          </div>
          <p className="mt-4 text-[12px] text-zinc-400">
            Or import by pasting a public key from your local machine
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {entries.map((entry) => (
            <SSHKeyCard
              key={entry.id}
              entry={entry}
              onDelete={(e) => setDeleteCandidate(e)}
              onCopy={(text) => handleCopy(text, entry.id)}
            />
          ))}
        </div>
      )}

      {/* ── Add Key Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200/60 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 dark:border-zinc-800/60 dark:bg-[#121212]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Add SSH Key</h3>
                <p className="text-[12px] text-zinc-500 mt-0.5">Key will be appended to <code className="font-mono">{selectedUser?.home ?? `~${targetUser}`}/.ssh/authorized_keys</code></p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Target user</label>
                <Input value={targetUser} onChange={(e) => setTargetUser(e.target.value)} placeholder="root" />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Public key</label>
                <textarea
                  autoFocus
                  rows={6}
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  placeholder={"ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI...\nor\nssh-rsa AAAAB3NzaC1yc2E..."}
                  className="w-full rounded-xl border border-zinc-200/60 bg-zinc-50 px-3 py-3 font-mono text-xs text-zinc-700 outline-none transition focus:border-blue-400/60 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-200"
                />
                <p className="mt-1.5 text-[11px] text-zinc-400">Paste the content of your <code className="font-mono">~/.ssh/id_ed25519.pub</code> or <code className="font-mono">~/.ssh/id_rsa.pub</code></p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setShowAddModal(false); setNewKeyValue(""); }}>Cancel</Button>
              <Button variant="primary" onClick={() => void handleAddKey()} disabled={!newKeyValue.trim() || addLoading}>
                {addLoading ? <RefreshCw size={14} className="mr-2 animate-spin" /> : <Key size={14} className="mr-2" />}
                Add Key
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate Key Modal ── */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200/60 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 dark:border-zinc-800/60 dark:bg-[#121212]">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-500" />
                  Generate SSH Key
                </h3>
                <p className="text-[12px] text-zinc-500 mt-0.5">Generate a new key pair on the server and append the public key to authorized_keys</p>
              </div>
              <button onClick={() => setShowGenModal(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Key type */}
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Key type</label>
                <div className="flex gap-2">
                  {(["ed25519", "rsa"] as KeyGenType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setGenType(type)}
                      className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                        genType === type
                          ? "border-blue-500/60 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-900/20 dark:text-blue-300"
                          : "border-zinc-200/60 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800/60 dark:bg-zinc-900 dark:text-zinc-300"
                      }`}
                    >
                      {type === "ed25519" ? (
                        <div className="flex flex-col items-center gap-1">
                          <Zap size={16} className="text-emerald-500" />
                          <span>ED25519</span>
                          <span className="text-[10px] font-normal text-zinc-400">Recommended</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Key size={16} className="text-blue-400" />
                          <span>RSA 4096</span>
                          <span className="text-[10px] font-normal text-zinc-400">Legacy compat</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment / label */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Comment / label</label>
                <Input
                  value={genComment}
                  onChange={(e) => setGenComment(e.target.value)}
                  placeholder="laptop@dev, deploy-bot, etc."
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowGenModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => void handleGenerateKey()} disabled={genLoading}>
                {genLoading ? <RefreshCw size={14} className="mr-2 animate-spin" /> : <Sparkles size={14} className="mr-2" />}
                Generate & Add Key
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      <ConfirmActionDialog
        open={!!deleteCandidate}
        title="Delete SSH key?"
        description={deleteCandidate ? `This will remove Key #${deleteCandidate.lineIndex + 1} from ${targetUser}'s authorized_keys. The action is irreversible.` : ""}
        confirmLabel="Delete Key"
        onClose={() => setDeleteCandidate(null)}
        onConfirm={() => { if (!deleteCandidate) return; void handleDeleteKey(deleteCandidate); }}
        pending={deleteLoading}
        tone="danger"
      />
    </div>
  );
}
