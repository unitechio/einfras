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
import { Button } from "@/shared/ui/Button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";

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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Disk Usage Section */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
          <div className="p-2 bg-orange-50 dark:bg-orange-500/10 rounded-lg border border-orange-100/50 dark:border-orange-500/20">
            <HardDrive className="text-orange-500" size={20} />
          </div>
          Disk Usage
        </h2>
        {loading ? (
          <div className="py-8 text-center text-[13px] font-medium text-zinc-500 animate-pulse">
            Loading storage details...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {storage.disks.map((disk: any) => (
              <div
                key={disk.mount}
                className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-colors"
              >
                <div className="flex items-center gap-4 mb-5">
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl border border-orange-100/50 dark:border-orange-900/30">
                    <HardDrive size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-[15px] tracking-tight text-zinc-900 dark:text-white">
                      {disk.mount}
                    </h3>
                    <p className="text-[12px] text-zinc-500 font-mono mt-0.5">
                      {disk.device} <span className="text-zinc-400">({disk.type})</span>
                    </p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-end">
                    <span className="text-[13px] font-medium text-zinc-500">
                      Used: <strong className="text-zinc-700 dark:text-zinc-300">{disk.used}</strong> / {disk.total}
                    </span>
                    <span className="text-[14px] font-bold text-zinc-900 dark:text-white">
                      {disk.percent}%
                    </span>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-[#1A1A1A] h-2.5 rounded-full overflow-hidden border border-zinc-200/50 dark:border-zinc-800/50 shadow-inner">
                    <div
                      className={`h-full rounded-[4px] transition-all duration-1000 ${disk.percent > 90 ? "bg-red-500" : disk.percent > 70 ? "bg-yellow-500" : "bg-emerald-500"}`}
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
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-100/50 dark:border-blue-500/20">
                <Folder className="text-blue-500" size={20} />
              </div>
              File Browser
            </h2>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-2">
              Browse and manage server files.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => alert("Mock Upload")}
              className="bg-white dark:bg-[#121212] shadow-sm"
            >
              <ArrowUpToLine size={16} className="mr-2" /> Upload
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const name = prompt("Folder Name:");
                if (name)
                  (mockSecurityService as any)
                    .createFolder("/", name)
                    .then(() => alert("Folder created"));
              }}
              className="shadow-sm"
            >
              <Plus size={16} className="mr-2" /> New Folder
            </Button>
          </div>
        </div>

        {/* File Permissions Modal */}
        {fileToEdit && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#121212] rounded-2xl max-w-lg w-full p-6 shadow-xl border border-zinc-200/60 dark:border-zinc-800/60 space-y-6 animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                    File Permissions
                  </h3>
                  <p className="text-[13px] text-zinc-500 mt-1">
                    Edit access for{" "}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-[#1A1A1A] px-1.5 py-0.5 rounded-md border border-zinc-200/50 dark:border-zinc-800/50">
                      {fileToEdit.name}
                    </span>
                  </p>
                </div>
                <div className="p-2 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
                  <Settings className="text-zinc-500" size={20} />
                </div>
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

              <div className="flex justify-end gap-2 pt-6 border-t border-zinc-100 dark:border-zinc-800/60">
                <Button
                  variant="ghost"
                  onClick={() => setFileToEdit(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    const recursive = (
                      document.getElementById("recursive") as HTMLInputElement
                    ).checked;
                    (mockSecurityService as any).chmod(fileToEdit.name, "755");
                    if (recursive) alert("Applied recursively");
                    setFileToEdit(null);
                  }}
                >
                  Update Permissions
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl shadow-sm overflow-hidden transition-all">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Modified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {storage.files.map((file: any) => (
                <TableRow
                  key={file.name}
                  className="group hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${file.type === "dir" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-500" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>
                        {file.type === "dir" ? (
                          <Folder size={18} className="fill-blue-500/20" />
                        ) : (
                          <File size={18} />
                        )}
                      </div>
                      <span className="font-semibold text-[14px] text-zinc-900 dark:text-zinc-100">{file.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-zinc-500">{file.size}</TableCell>
                  <TableCell>
                    <span className="font-mono text-[11px] font-bold bg-zinc-100 dark:bg-[#1A1A1A] px-1.5 py-0.5 rounded text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
                      {file.type === "dir" ? "drwxr-xr-x" : "-rw-r--r--"}
                    </span>
                  </TableCell>
                  <TableCell className="text-[13px] text-zinc-500 font-medium">root:root</TableCell>
                  <TableCell className="text-[13px] text-zinc-500">{file.modified}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {file.type === "file" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20"
                          title="Download"
                        >
                          <Download size={14} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
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
                        className="text-zinc-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:text-orange-400 dark:hover:bg-orange-900/20"
                        title="Move"
                      >
                        <ArrowRight size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
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
                        className="text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/20"
                        title="Copy"
                      >
                        <Copy size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setFileToEdit(file);
                        }}
                        className="text-zinc-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:text-purple-400 dark:hover:bg-purple-900/20"
                        title="Permissions"
                      >
                        <Settings size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Delete ${file.name}?`))
                            (mockSecurityService as any).deleteFile(file.name);
                        }}
                        className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
