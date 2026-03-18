import { useState, useEffect } from "react";
import {
  mockSecurityService,
  type ServerSSHKey,
} from "../shared/mockServerService";
import { Key, Trash2, Plus, Calendar, Download } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

export default function ServerSSHKeys() {
  const [keys, setKeys] = useState<ServerSSHKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState<any>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const data = await mockSecurityService.getSSHKeys();
      setKeys(data);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this SSH key?")) return;
    await mockSecurityService.deleteSSHKey(id);
    loadKeys();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-100/50 dark:border-blue-500/20">
              <Key className="text-blue-500" size={20} />
            </div>
            SSH Keys
          </h2>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2">
            Manage SSH keys authorized to access this server.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowAddModal(true)}
          className="shadow-sm"
        >
          <Plus size={16} className="mr-2" />
          Add SSH Key
        </Button>
      </div>

      {/* Add Key Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#121212] rounded-2xl max-w-md w-full p-6 shadow-xl border border-zinc-200/60 dark:border-zinc-800/60 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white mb-4">
              New SSH Key
            </h3>

            {!newKeyData ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
                    Key Name
                  </label>
                  <Input
                    id="keyName"
                    type="text"
                    placeholder="e.g. My Work Laptop"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={async () => {
                      const name = (
                        document.getElementById("keyName") as HTMLInputElement
                      ).value;
                      if (name) {
                        const keyPair = await (
                          mockSecurityService as any
                        ).generateSSHKey(name);
                        setNewKeyData(keyPair);
                        await mockSecurityService.addSSHKey({
                          name,
                          fingerprint: "SHA256:MockFingerprint...",
                          addedBy: "root",
                        });
                        loadKeys();
                      }
                    }}
                  >
                    Generate Key
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-[13px] font-medium leading-relaxed">
                  Key generated successfully! Download your private key now. It
                  will not be shown again.
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
                    Private Key
                  </label>
                  <textarea
                    readOnly
                    className="w-full h-32 p-3 font-mono text-[11px] rounded-xl border bg-zinc-50 dark:bg-[#1A1A1A] text-zinc-600 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-800/50 focus:outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-700"
                    value={newKeyData.privateKey}
                  ></textarea>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const element = document.createElement("a");
                      const file = new Blob([newKeyData.privateKey], {
                        type: "text/plain",
                      });
                      element.href = URL.createObjectURL(file);
                      element.download = "id_ed25519";
                      document.body.appendChild(element); // Required for this to work in FireFox
                      element.click();
                      document.body.removeChild(element);
                    }}
                  >
                    <Download size={14} className="mr-2" />
                    Download Key
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setShowAddModal(false);
                      setNewKeyData(null);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-[13px] font-medium text-zinc-500 animate-pulse">
            Loading keys...
          </div>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className="p-5 bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-colors group relative shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-100/50 dark:border-blue-900/30">
                    <Key size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[15px] tracking-tight text-zinc-900 dark:text-zinc-50">
                      {key.name}
                    </h3>
                    <p className="text-[12px] text-zinc-500 mt-0.5">
                      Added by{" "}
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {key.addedBy}
                      </span>
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(key.id)}
                  className="text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} />
                </Button>
              </div>

              <div className="mt-5 space-y-3">
                <div className="text-[11px] font-mono bg-zinc-50 dark:bg-[#1A1A1A] px-3 py-2.5 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 text-zinc-600 dark:text-zinc-400 break-all font-medium">
                  {key.fingerprint}
                </div>
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                     <Calendar size={12} />
                     Added on {new Date(key.createdAt).toLocaleDateString()}
                   </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
