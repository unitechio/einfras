import { useState } from "react";
import { X, HardDrive } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

interface VolumeCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function VolumeCreateModal({ isOpen, onClose }: VolumeCreateModalProps) {
    const [name, setName] = useState("");
    const [driver, setDriver] = useState("local");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl w-full max-w-lg flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-purple-500" />
                        Create Volume
                    </h2>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-md transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Volume Name <span className="text-red-500">*</span></label>
                        <Input type="text" placeholder="e.g. db-data" value={name} onChange={e => setName(e.target.value)} />
                        <p className="text-[11px] text-zinc-500 mt-1">Leave blank to let Docker automatically generate a name.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Driver</label>
                        <select 
                            value={driver}
                            onChange={(e) => setDriver(e.target.value)}
                            className="w-full text-sm bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        >
                            <option value="local">local (Default)</option>
                            <option value="nfs">NFS</option>
                            <option value="cifs">CIFS</option>
                        </select>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/50 space-y-4">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Driver Options (Advanced)</h3>
                        <div className="bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-lg flex items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-700 h-24">
                            <span className="text-sm text-zinc-500">Not configured</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 bg-zinc-50/50 dark:bg-[#121212] rounded-b-xl">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white" onClick={onClose}>Create Volume</Button>
                </div>
            </div>
        </div>
    );
}
