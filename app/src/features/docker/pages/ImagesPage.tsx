import { useState, useEffect } from "react";
import { Search, Download, Server, Package, HardDrive, Trash2 } from "lucide-react";
import { useImages, usePullImage } from "../api/useDockerHooks";
import { useServers } from "../../servers/api/useServers";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";

export default function ImagesPage() {
    const { data: serverData, isLoading: isLoadingServers } = useServers({ page: 1, page_size: 100 });
    const servers = serverData?.data || [];
    
    // Auto-select first server if available
    const [selectedServerId, setSelectedServerId] = useState<string>("");
    const { showNotification } = useNotification();
    useEffect(() => {
        if (!selectedServerId && servers.length > 0) {
            setSelectedServerId(servers[0].id);
        }
    }, [servers, selectedServerId]);

    const [searchQuery, setSearchQuery] = useState("");
    const [pullImageName, setPullImageName] = useState("");
    
    const { data: images, isLoading: isLoadingImages } = useImages(selectedServerId);
    const { mutate: pullImage, isPending: isPulling } = usePullImage(selectedServerId);

    const filteredImages = (images || []).filter(img => {
        const repoTags = img.RepoTags || [];
        if (!repoTags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
        return true;
    });

    const handlePull = (e: React.FormEvent) => {
        e.preventDefault();
        if (pullImageName.trim()) {
            pullImage(pullImageName.trim(), {
                onSuccess: () => showNotification({ type: "success", message: "Image Pulled", description: `Successfully pulled ${pullImageName}` }),
                onError: (err: any) => showNotification({ type: "error", message: "Pull Failed", description: err.message || "Failed to pull image" })
            });
            setPullImageName("");
        }
    };

    const formatSize = (bytes: number) => {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Byte';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString());
        return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <Package className="h-6 w-6 text-purple-500" />
                        Docker Images
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Manage container images on your hosts.
                    </p>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <div className="relative">
                        <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
                        <select 
                            value={selectedServerId}
                            onChange={(e) => setSelectedServerId(e.target.value)}
                            disabled={isLoadingServers}
                            className="pl-9 pr-8 h-9 text-[13px] font-medium bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 min-w-[200px] text-zinc-900 dark:text-zinc-100 appearance-none shadow-sm cursor-pointer"
                        >
                            <option value="" disabled>Select Server...</option>
                            {servers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.ip_address})</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="w-full sm:max-w-xs">
                    <Input
                        type="text"
                        placeholder="Search images..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        icon={<Search className="h-4 w-4 text-zinc-400" />}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden h-full shadow-sm">

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Repository / Tag</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingImages ? (
                                        [...Array(3)].map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell><div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                                <TableCell><div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                                <TableCell><div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" /></TableCell>
                                                <TableCell><div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse ml-auto" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : filteredImages.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-48 text-center">
                                                <div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
                                                    <HardDrive size={32} className="mb-3 opacity-20" />
                                                    <p className="text-[13px] font-medium">No images found.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredImages.map((img) => (
                                            <TableRow key={img.Id} className="group">
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        {img.RepoTags?.map(tag => {
                                                            const [repo, t] = tag.split(':');
                                                            return (
                                                                <span key={tag} className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 cursor-pointer group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                                    {repo}
                                                                    <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded text-[11px] font-mono leading-none">{t}</span>
                                                                </span>
                                                            );
                                                        }) || <span className="text-zinc-500 dark:text-zinc-400 font-mono">&lt;none&gt;:&lt;none&gt;</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                                                    {formatSize(img.Size)}
                                                </TableCell>
                                                <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                                                    {new Date(img.Created * 1000).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button 
                                                            variant="ghost" size="icon" 
                                                            onClick={() => {
                                                                if(confirm(`Are you sure you want to remove image?`)) {
                                                                  showNotification({ type: "error", message: "Image Removed", description: `Removed image from host.` });
                                                                }
                                                            }}
                                                            className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete Image"
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121212] rounded-xl p-6 shadow-sm">
                    <h3 className="font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
                        <Download className="h-5 w-5 text-purple-500" />
                        Pull Image
                    </h3>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
                        Download a new container image from Docker Hub or your configured registries to this server node.
                    </p>
                    <form onSubmit={handlePull} className="space-y-4">
                        <div>
                            <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Image Reference</label>
                            <Input
                                type="text"
                                placeholder="e.g., nginx:latest"
                                value={pullImageName}
                                onChange={(e) => setPullImageName(e.target.value)}
                            />
                        </div>
                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-700 text-white"
                            disabled={isPulling || !pullImageName || !selectedServerId}
                        >
                            {isPulling ? "Pulling Image..." : "Pull Image"}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
