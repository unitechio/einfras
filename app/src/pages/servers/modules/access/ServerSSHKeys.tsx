import { useState, useEffect } from "react";
import {
  mockSecurityService,
  type ServerSSHKey,
} from "../shared/mockServerService";
import { Key, Trash2, Plus, Calendar } from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            SSH Keys
          </h2>
          <p className="text-zinc-500 text-sm">
            Manage SSH keys authorized to access this server.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
        >
          <Plus size={16} />
          Add SSH Key
        </button>
      </div>

      {/* Add Key Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              New SSH Key
            </h3>

            {!newKeyData ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Key Name
                  </label>
                  <input
                    id="keyName"
                    type="text"
                    className="w-full p-2 rounded border bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                    placeholder="My Work Laptop"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                  >
                    Cancel
                  </button>
                  <button
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
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Generate Key
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded text-sm mb-4">
                  Key generated successfully! Download your private key now. It
                  will not be shown again.
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Private Key
                  </label>
                  <textarea
                    readOnly
                    className="w-full h-32 p-2 font-mono text-xs rounded border bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                    value={newKeyData.privateKey}
                  ></textarea>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
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
                    className="px-4 py-2 bg-zinc-900 self-start dark:bg-white text-white dark:text-zinc-900 rounded hover:opacity-90 flex items-center gap-2"
                  >
                    Download Key
                  </button>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setNewKeyData(null);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-zinc-500">
            Loading keys...
          </div>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-blue-500/50 transition-colors group relative"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Key size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-white">
                      {key.name}
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Added by{" "}
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {key.addedBy}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(key.id)}
                  className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-2">
                <div className="text-xs font-mono bg-zinc-50 dark:bg-zinc-800 px-3 py-2 rounded border border-zinc-100 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 break-all">
                  {key.fingerprint}
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Calendar size={12} />
                  Added on {new Date(key.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
