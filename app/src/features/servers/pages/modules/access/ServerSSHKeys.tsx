import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Calendar, Key, Plus, RefreshCw } from "lucide-react";

import { useNotification } from "@/core/NotificationContext";
import { accessApi, type TypedControlResult } from "@/shared/api/client";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

type SSHKeyEntry = {
  id: string;
  value: string;
  fingerprint: string;
};

export default function ServerSSHKeys() {
  const { serverId = "" } = useParams();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [targetUser, setTargetUser] = useState("root");
  const [targetUserInput, setTargetUserInput] = useState("root");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [preview, setPreview] = useState("");
  const [resultMeta, setResultMeta] = useState<TypedControlResult | null>(null);
  const inFlightKey = useRef<string | null>(null);

  const loadKeys = async () => {
    if (!serverId) return;
    const requestKey = `${serverId}:${targetUser}`;
    if (inFlightKey.current === requestKey) {
      return;
    }
    inFlightKey.current = requestKey;
    setLoading(true);
    try {
      const response = await accessApi.action(serverId, {
        action: "list-ssh-keys",
        target: targetUser,
      });
      const result = (response.result ?? null) as TypedControlResult | null;
      const previewValue = result?.preview ?? "";
      setPreview(previewValue);
      setResultMeta(result);
    } catch (error) {
      showNotification({
        type: "error",
        message: "Unable to load SSH keys",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      if (inFlightKey.current === requestKey) {
        inFlightKey.current = null;
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadKeys();
  }, [serverId, targetUser]);

  useEffect(() => {
    setTargetUserInput(targetUser);
  }, [targetUser]);

  const entries = useMemo<SSHKeyEntry[]>(() => {
    return preview
      .split(/\r?\n/)
      .map((line, index) => line.trim())
      .filter(Boolean)
      .map((line, index) => ({
        id: `${index}-${line.slice(0, 16)}`,
        value: line,
        fingerprint: `authorized_keys:${index + 1}`,
      }));
  }, [preview]);

  const handleAddKey = async () => {
    if (!serverId || !newKeyValue.trim()) return;
    try {
      await accessApi.action(serverId, {
        action: "add-ssh-key",
        target: targetUser,
        payload: newKeyValue.trim(),
      });
      showNotification({
        type: "success",
        message: "SSH key added",
        description: `Authorized key updated for ${targetUser}.`,
      });
      setNewKeyValue("");
      setShowAddModal(false);
      await loadKeys();
    } catch (error) {
      showNotification({
        type: "error",
        message: "Unable to add SSH key",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    }
  };

  const applyTargetUser = async () => {
    const nextUser = targetUserInput.trim() || "root";
    if (nextUser === targetUser) {
      await loadKeys();
      return;
    }
    setTargetUser(nextUser);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            <div className="rounded-lg border border-blue-100/50 bg-blue-50 p-2 dark:border-blue-500/20 dark:bg-blue-500/10">
              <Key className="text-blue-500" size={20} />
            </div>
            SSH Keys
          </h2>
          <p className="mt-2 text-[13px] text-zinc-500 dark:text-zinc-400">
            Read and append authorized keys through the real access API.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input value={targetUserInput} onChange={(event) => setTargetUserInput(event.target.value)} placeholder="root" className="w-[180px]" />
          <Button variant="outline" onClick={() => void applyTargetUser()} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} className="mr-2" />
            Add SSH Key
          </Button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200/60 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200 dark:border-zinc-800/60 dark:bg-[#121212]">
            <h3 className="mb-4 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Add authorized key</h3>
            <div className="space-y-4">
              <Input value={targetUserInput} onChange={(event) => setTargetUserInput(event.target.value)} placeholder="Target user" />
              <textarea
                rows={8}
                value={newKeyValue}
                onChange={(event) => setNewKeyValue(event.target.value)}
                placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI..."
                className="w-full rounded-xl border border-zinc-200/60 bg-zinc-50 px-3 py-3 font-mono text-xs text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-200"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => void handleAddKey()} disabled={!newKeyValue.trim()}>
                Add Key
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
        <div className="mb-3 flex items-center justify-between text-[12px] text-zinc-500">
          <span>Target user: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{targetUser}</span></span>
          {resultMeta?.redactions?.length ? <span>{resultMeta.redactions.length} secret segments redacted</span> : null}
        </div>
        <div className="rounded-xl border border-zinc-200/50 bg-zinc-50 p-4 text-[12px] text-zinc-600 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-400">
          Keys are returned from backend in redacted preview mode for safety.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {loading ? (
          <div className="col-span-full py-12 text-center text-[13px] font-medium text-zinc-500 animate-pulse">Loading keys...</div>
        ) : entries.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-zinc-200/60 bg-white py-12 text-center text-[13px] font-medium text-zinc-500 dark:border-zinc-800/60 dark:bg-[#121212]">
            No authorized keys were returned for this user.
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="relative rounded-xl border border-zinc-200/60 bg-white p-5 shadow-sm transition-colors hover:border-blue-500/50 dark:border-zinc-800/60 dark:bg-[#121212] dark:hover:border-blue-500/50"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg border border-blue-100/50 bg-blue-50 p-2.5 text-blue-600 dark:border-blue-900/30 dark:bg-blue-900/20 dark:text-blue-400">
                    <Key size={18} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                      Authorized Key #{entry.id.split("-")[0]}
                    </h3>
                    <p className="mt-0.5 text-[12px] text-zinc-500">{entry.fingerprint}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="break-all rounded-lg border border-zinc-200/50 bg-zinc-50 px-3 py-2.5 font-mono text-[11px] font-medium text-zinc-600 dark:border-zinc-800/50 dark:bg-[#1A1A1A] dark:text-zinc-400">
                  {entry.value}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                  <Calendar size={12} />
                  Synced on {new Date().toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
