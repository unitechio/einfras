import { useState, useEffect } from "react";
import { mockSecurityService } from "../shared/mockServerService";
import {
  HardDrive,
  Folder,
  File,
  Download,
  Settings,
  Trash2,
  Copy,
  ArrowRight,
  Plus,
  ArrowUpToLine,
} from "lucide-react";

export default function ServerStorage() {
  const [storage, setStorage] = useState<any>({ disks: [], files: [] });
  const [fileToEdit, setFileToEdit] = useState<any>(null); // For Permissions Modal
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStorage = async () => {
      setLoading(true);
      const data = await (mockSecurityService as any).getStorage();
      setStorage(data);
      setLoading(false);
    };
    loadStorage();
  }, []);

  return (
    <div className="space-y-8">
      {/* Disk Usage Section */}
      <div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">
          Disk Usage
        </h2>
        {loading ? (
          <div className="py-8 text-center text-zinc-500">
            Loading storage details...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {storage.disks.map((disk: any) => (
              <div
                key={disk.mount}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-5 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg">
                    <HardDrive size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white">
                      {disk.mount}
                    </h3>
                    <p className="text-xs text-zinc-500 font-mono">
                      {disk.device} ({disk.type})
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">
                      Used: {disk.used} / {disk.total}
                    </span>
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {disk.percent}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${disk.percent > 90 ? "bg-red-500" : disk.percent > 70 ? "bg-yellow-500" : "bg-green-500"}`}
                      style={{ width: `${disk.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File Browser Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              File Browser
            </h2>
            <p className="text-zinc-500 text-sm">
              Browse and manage server files.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => alert("Mock Upload")}
              className="px-4 py-2 gap-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-sm flex items-center text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition"
            >
              <ArrowUpToLine size={16} /> Upload
            </button>
            <button
              onClick={() => {
                const name = prompt("Folder Name:");
                if (name)
                  (mockSecurityService as any)
                    .createFolder("/", name)
                    .then(() => alert("Folder created"));
              }}
              className="bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              <Plus size={16} /> New Folder
            </button>
          </div>
        </div>

        {/* File Permissions Modal */}
        {fileToEdit && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-sm max-w-md w-full p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                    File Permissions
                  </h3>
                  <p className="text-sm text-zinc-500">
                    Edit access for{" "}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {fileToEdit.name}
                    </span>
                  </p>
                </div>
                <Settings className="text-zinc-400" size={24} />
              </div>

              <div className="space-y-4">
                {/* Ownership */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Ownership (chown)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Owner
                      </label>
                      <select className="w-full p-2 rounded border bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-sm">
                        <option>root</option>
                        <option>deploy</option>
                        <option>monitor</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Group
                      </label>
                      <select className="w-full p-2 rounded border bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-sm">
                        <option>root</option>
                        <option>wheel</option>
                        <option>docker</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Permissions Mode */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Mode (chmod)
                  </label>
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-sm border border-zinc-200 dark:border-zinc-800 p-3">
                    <div className="grid grid-cols-4 gap-2 text-sm text-center font-medium text-zinc-500 mb-2">
                      <span></span>
                      <span>Read</span>
                      <span>Write</span>
                      <span>Exec</span>
                    </div>
                    {["Owner", "Group", "Others"].map((scope) => (
                      <div
                        key={scope}
                        className="grid grid-cols-4 gap-2 items-center text-sm py-1"
                      >
                        <span className="font-medium text-zinc-700 dark:text-zinc-300 pl-2">
                          {scope}
                        </span>
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                            defaultChecked={scope === "Owner"}
                          />
                        </div>
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                            defaultChecked={scope === "Owner"}
                          />
                        </div>
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                            defaultChecked={
                              scope === "Owner" || scope === "Group"
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-zinc-500">
                      Numeric Value:
                    </span>
                    <code className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-sm font-mono">
                      755
                    </code>
                  </div>
                </div>

                {/* Options */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="recursive"
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="recursive"
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Recursive
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  onClick={() => setFileToEdit(null)}
                  className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const recursive = (
                      document.getElementById("recursive") as HTMLInputElement
                    ).checked;
                    (mockSecurityService as any).chmod(fileToEdit.name, "755");
                    if (recursive) alert("Applied recursively");
                    setFileToEdit(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 font-medium border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Size</th>
                <th className="px-6 py-3">Permissions</th>
                <th className="px-6 py-3">Owner</th>
                <th className="px-6 py-3">Modified</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {storage.files.map((file: any) => (
                <tr
                  key={file.name}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="px-6 py-3 flex items-center gap-3 font-medium text-zinc-900 dark:text-white">
                    {file.type === "dir" ? (
                      <Folder size={16} className="text-blue-500" />
                    ) : (
                      <File size={16} className="text-zinc-400" />
                    )}
                    {file.name}
                  </td>
                  <td className="px-6 py-3 text-zinc-500">{file.size}</td>
                  <td className="px-6 py-3 text-sm text-zinc-500">
                    {file.type === "dir" ? "drwxr-xr-x" : "-rw-r--r--"}
                  </td>
                  <td className="px-6 py-3 text-zinc-500 text-sm">root:root</td>
                  <td className="px-6 py-3 text-zinc-500">{file.modified}</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {file.type === "file" && (
                        <button
                          className="p-1 text-zinc-400 hover:text-blue-500"
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const dest = prompt(
                            `Move ${file.name} to:`,
                            "/var/www/",
                          );
                          if (dest)
                            (mockSecurityService as any).moveFile(
                              file.name,
                              dest,
                            );
                        }}
                        className="p-1 text-zinc-400 hover:text-orange-500"
                        title="Move"
                      >
                        <ArrowRight size={14} />
                      </button>
                      <button
                        onClick={() => {
                          const dest = prompt(
                            `Copy ${file.name} to:`,
                            "/var/www/backup/",
                          );
                          if (dest)
                            (mockSecurityService as any).copyFile(
                              file.name,
                              dest,
                            );
                        }}
                        className="p-1 text-zinc-400 hover:text-green-500"
                        title="Copy"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setFileToEdit(file);
                        }}
                        className="p-1 text-zinc-400 hover:text-purple-500"
                        title="Permissions"
                      >
                        <Settings size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete ${file.name}?`))
                            (mockSecurityService as any).deleteFile(file.name);
                        }}
                        className="p-1 text-zinc-400 hover:text-red-500"
                        title="Delete"
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
      </div>
    </div>
  );
}
