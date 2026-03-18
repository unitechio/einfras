import { useState } from "react";
import { X, Play, Settings2, HardDrive, Network, Layers } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/Tabs";

interface ContainerDeployModalProps {
    isOpen: boolean;
    onClose: () => void;
    serverId: string;
}

export default function ContainerDeployModal({ isOpen, onClose }: ContainerDeployModalProps) {
    const [name, setName] = useState("");
    const [image, setImage] = useState("");
    const [ports, setPorts] = useState([{ host: "", container: "" }]);
    const [envVars, setEnvVars] = useState([{ key: "", value: "" }]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Play className="w-5 h-5 text-blue-500 fill-current" />
                        Deploy Container
                    </h2>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-md transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <Tabs defaultValue="general" className="w-full">
                        <TabsList className="mb-6 grid w-full grid-cols-4">
                            <TabsTrigger value="general" className="gap-2"><Settings2 size={14} className="hidden sm:block" /> General</TabsTrigger>
                            <TabsTrigger value="network" className="gap-2"><Network size={14} className="hidden sm:block" /> Network</TabsTrigger>
                            <TabsTrigger value="env" className="gap-2"><Layers size={14} className="hidden sm:block" /> Env</TabsTrigger>
                            <TabsTrigger value="volumes" className="gap-2"><HardDrive size={14} className="hidden sm:block" /> Volumes</TabsTrigger>
                        </TabsList>

                        <TabsContent value="general" className="space-y-4">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Container Name</label>
                                    <Input type="text" placeholder="e.g. my-nginx-app" value={name} onChange={e => setName(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Image Reference <span className="text-red-500">*</span></label>
                                    <Input type="text" placeholder="e.g. nginx:latest" value={image} onChange={e => setImage(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">Restart Policy</label>
                                    <select className="w-full text-sm bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
                                        <option value="no">No</option>
                                        <option value="always">Always</option>
                                        <option value="unless-stopped">Unless Stopped</option>
                                        <option value="on-failure">On Failure</option>
                                    </select>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="network" className="space-y-4 pt-2">
                            <div>
                                <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Port Mapping</label>
                                {ports.map((p, i) => (
                                    <div key={i} className="flex gap-2 mb-2 items-center">
                                        <Input type="text" placeholder="Host port" value={p.host} onChange={(e) => {
                                            const newPorts = [...ports]; newPorts[i].host = e.target.value; setPorts(newPorts);
                                        }} />
                                        <span className="text-zinc-500">:</span>
                                        <Input type="text" placeholder="Container port" value={p.container} onChange={(e) => {
                                            const newPorts = [...ports]; newPorts[i].container = e.target.value; setPorts(newPorts);
                                        }} />
                                        <Button variant="ghost" size="icon" onClick={() => setPorts(ports.filter((_, idx) => idx !== i))} className="text-zinc-400 hover:text-red-500 flex-shrink-0">
                                            <X size={14} />
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={() => setPorts([...ports, { host: "", container: "" }])}>
                                    + Add Port Mapping
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="env" className="space-y-4 pt-2">
                            <div>
                                <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Environment Variables</label>
                                {envVars.map((env, i) => (
                                    <div key={i} className="flex gap-2 mb-2 items-center">
                                        <Input type="text" placeholder="Key" value={env.key} onChange={(e) => {
                                            const newEnv = [...envVars]; newEnv[i].key = e.target.value; setEnvVars(newEnv);
                                        }} />
                                        <span className="text-zinc-500">=</span>
                                        <Input type="text" placeholder="Value" value={env.value} onChange={(e) => {
                                            const newEnv = [...envVars]; newEnv[i].value = e.target.value; setEnvVars(newEnv);
                                        }} />
                                        <Button variant="ghost" size="icon" onClick={() => setEnvVars(envVars.filter((_, idx) => idx !== i))} className="text-zinc-400 hover:text-red-500 flex-shrink-0">
                                            <X size={14} />
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={() => setEnvVars([...envVars, { key: "", value: "" }])}>
                                    + Add Variable
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="volumes" className="space-y-4 pt-8 text-center">
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Advanced volume mounting options will be available here.</p>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2 bg-zinc-50/50 dark:bg-[#121212] rounded-b-xl">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white" onClick={onClose}>Deploy Container</Button>
                </div>
            </div>
        </div>
    );
}
