import { useState } from "react";
import { X, Share2 } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

interface NetworkCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function NetworkCreateModal({ isOpen, onClose }: NetworkCreateModalProps) {
    const [name, setName] = useState("");
    const [driver, setDriver] = useState("bridge");
    const [subnet, setSubnet] = useState("");
    const [gateway, setGateway] = useState("");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl w-full max-w-lg flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-orange-500" />
                        Create Network
                    </h2>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-md transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Network Name <span className="text-red-500">*</span></label>
                        <Input type="text" placeholder="e.g. backend-net" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Driver</label>
                        <select 
                            value={driver}
                            onChange={(e) => setDriver(e.target.value)}
                            className="w-full text-sm bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        >
                            <option value="bridge">Bridge</option>
                            <option value="host">Host</option>
                            <option value="overlay">Overlay</option>
                            <option value="macvlan">Macvlan</option>
                            <option value="ipvlan">IPvlan</option>
                        </select>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/50 space-y-4">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">IPv4 Configuration (Optional)</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Subnet</label>
                                <Input type="text" placeholder="172.20.0.0/16" value={subnet} onChange={e => setSubnet(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Gateway</label>
                                <Input type="text" placeholder="172.20.0.1" value={gateway} onChange={e => setGateway(e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 bg-zinc-50/50 dark:bg-[#121212] rounded-b-xl">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white" onClick={onClose}>Create Network</Button>
                </div>
            </div>
        </div>
    );
}
