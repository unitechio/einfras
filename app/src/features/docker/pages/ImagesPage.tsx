import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Download, Rocket, Server, Package, HardDrive, Trash2, Tags, Sparkles, AlertTriangle, LoaderCircle } from "lucide-react";
import { useExportImage, useImages, usePullImage, usePushImage, useRegistryCatalog, useRemoveImage, useRetagImage } from "../api/useDockerHooks";
import { apiFetch, downloadApiFile } from "@/core/api-client";
import { useEnvironmentInventory } from "../../kubernetes/api/useEnvironmentInventory";
import { useRegistries } from "@/features/repositories/api/useRepositories";
import { useEnvironment } from "@/core/EnvironmentContext";
import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";

export default function ImagesPage() {
    const navigate = useNavigate();
    const { data: inventory = [], isLoading: isLoadingServers } = useEnvironmentInventory();
    const { selectedEnvironment } = useEnvironment();
    const servers = inventory.filter((env) => env.type === "docker");

    const [selectedServerId, setSelectedServerId] = useState<string>("");
    const { showNotification } = useNotification();
    useEffect(() => {
        if (selectedEnvironment?.type === "docker" && selectedEnvironment.id !== selectedServerId) {
            setSelectedServerId(selectedEnvironment.id);
            return;
        }
        if (!selectedServerId && servers.length > 0) {
            setSelectedServerId(servers[0].id);
        }
    }, [servers, selectedServerId, selectedEnvironment]);

    const [searchQuery, setSearchQuery] = useState("");
    const [pullImageName, setPullImageName] = useState("");
    const [pushImageName, setPushImageName] = useState("");
    const [selectedRegistryId, setSelectedRegistryId] = useState("");
    const [pushRegistryId, setPushRegistryId] = useState("");
    const [browserRegistryId, setBrowserRegistryId] = useState("");
    const [registryRepository, setRegistryRepository] = useState("");
    const [retagSource, setRetagSource] = useState("");
    const [retagTarget, setRetagTarget] = useState("");
    const [removeOldTagAfterRetag, setRemoveOldTagAfterRetag] = useState(false);
    const [exportedPath, setExportedPath] = useState("");
    const [exportedFileName, setExportedFileName] = useState("");
    const [activeExportRef, setActiveExportRef] = useState("");
    const [activeDeleteRef, setActiveDeleteRef] = useState("");
    const [deleteCandidate, setDeleteCandidate] = useState<{ imageRef: string; label: string } | null>(null);
    
    const { data: images, isLoading: isLoadingImages } = useImages(selectedServerId);
    const { data: registries = [] } = useRegistries();
    const { mutate: pullImage, isPending: isPulling } = usePullImage(selectedServerId);
    const { mutate: pushImage, isPending: isPushing } = usePushImage(selectedServerId);
    const { mutate: exportImage, isPending: isExporting } = useExportImage(selectedServerId);
    const { mutate: retagImage, isPending: isRetagging } = useRetagImage(selectedServerId);
    const { mutate: removeImage, isPending: isRemovingImage } = useRemoveImage(selectedServerId);
    const { data: registryCatalog } = useRegistryCatalog(browserRegistryId, registryRepository || undefined);
    const activeRegistry = registries.find((registry) => registry.id === selectedRegistryId) || registries.find((registry) => registry.is_default);
    const activePushRegistry = registries.find((registry) => registry.id === pushRegistryId) || registries.find((registry) => registry.is_default);
    const normalizedPushPreview = useMemo(() => normalizePushTarget(pushImageName, activePushRegistry), [activePushRegistry, pushImageName]);
    const pushTargetNeedsNamespaceHint = useMemo(() => {
        return !!pushImageName.trim() && !!activePushRegistry && activePushRegistry.provider === "dockerhub" && /^((docker\.io|index\.docker\.io)\/)?library\//i.test(pushImageName.trim());
    }, [activePushRegistry, pushImageName]);

    const filteredImages = (images || []).filter(img => {
        const repoTags = img.RepoTags || [];
        if (!repoTags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
        return true;
    });

    const handlePull = (e: React.FormEvent) => {
        e.preventDefault();
        if (pullImageName.trim()) {
            pullImage({ imageName: pullImageName.trim(), registryId: selectedRegistryId || undefined }, {
                onSuccess: () => showNotification({ type: "success", message: "Image Pulled", description: `Successfully pulled ${pullImageName}${selectedRegistryId ? " using registry credentials" : ""}` }),
                onError: (err: any) => showNotification({ type: "error", message: "Pull Failed", description: err.message || "Failed to pull image" })
            });
            setPullImageName("");
        }
    };

    const handlePush = (e: React.FormEvent) => {
        e.preventDefault();
        const normalizedTarget = normalizePushTarget(pushImageName, activePushRegistry);
        if (normalizedTarget) {
            pushImage({ imageRef: normalizedTarget, registryId: pushRegistryId || undefined }, {
                onSuccess: () => showNotification({ type: "success", message: "Image Pushed", description: `Successfully pushed ${normalizedTarget}${activePushRegistry ? ` to ${activePushRegistry.name}` : ""}` }),
                onError: (err: any) => showNotification({ type: "error", message: "Push Failed", description: err.message || "Failed to push image" })
            });
        }
    };

    const handleRetag = (e: React.FormEvent) => {
        e.preventDefault();
        if (retagSource.trim() && retagTarget.trim()) {
            retagImage({ sourceRef: retagSource.trim(), targetRef: retagTarget.trim() }, {
                onSuccess: () => {
                    if (removeOldTagAfterRetag) {
                        removeImage(
                            { imageRef: retagSource.trim(), force: false },
                            {
                                onSuccess: () => showNotification({ type: "success", message: "Image retagged", description: `${retagSource} -> ${retagTarget} and old tag removed.` }),
                                onError: (error: any) => showNotification({ type: "warning", message: "Retagged but old tag still exists", description: error?.message || "Docker created the new tag, but the old tag could not be removed automatically." }),
                            },
                        );
                    } else {
                        showNotification({ type: "success", message: "Image retagged", description: `${retagSource} -> ${retagTarget}. Docker keeps the old tag unless you remove it.` });
                    }
                    setRetagSource("");
                    setRetagTarget("");
                },
                onError: (err: any) => showNotification({ type: "error", message: "Retag failed", description: err.message || "Failed to retag image" })
            });
        }
    };

    const handleDeleteRegistryTag = async (tag: string) => {
        if (!browserRegistryId || !registryRepository) return;
        try {
            await apiFetch(`/v1/registries/${encodeURIComponent(browserRegistryId)}/tags/delete`, {
                method: "POST",
                body: JSON.stringify({ repository: registryRepository, tag }),
            });
            showNotification({ type: "success", message: "Registry tag deleted", description: `${registryRepository}:${tag}` });
        } catch (error: any) {
            showNotification({ type: "error", message: "Delete tag failed", description: error?.message || "Unable to delete registry tag." });
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
                    <Button variant="outline" size="md" onClick={() => navigate("/images/build")}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Build & Import
                    </Button>
                    <div className="relative">
                        <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
                        <select 
                            value={selectedServerId}
                            onChange={(e) => setSelectedServerId(e.target.value)}
                            disabled={isLoadingServers}
                            className="pl-9 pr-8 h-9 text-[13px] font-medium bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 min-w-[200px] text-zinc-900 dark:text-zinc-100 appearance-none shadow-sm cursor-pointer"
                        >
                            <option value="" disabled>Select Environment...</option>
                            {servers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.url})</option>
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
                                                                const imageRef = img.RepoTags?.[0] || img.Id;
                                                                setActiveExportRef(imageRef);
                                                                exportImage(
                                                                { imageRef },
                                                                {
                                                                    onSuccess: (result) => {
                                                                        setExportedPath(result.path);
                                                                        setExportedFileName(result.path.split(/[\\/]/).pop() || "docker-image-export.tar.gz");
                                                                        showNotification({ type: "success", message: "Image exported", description: result.path });
                                                                    },
                                                                    onError: (error: any) => showNotification({ type: "error", message: "Export failed", description: error?.message || "Unable to export image." }),
                                                                    onSettled: () => setActiveExportRef(""),
                                                                },
                                                            );
                                                            }}
                                                            disabled={isExporting}
                                                            className="text-zinc-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20" title="Export Image"
                                                        >
                                                            <Download size={14} className={activeExportRef === (img.RepoTags?.[0] || img.Id) ? "animate-bounce" : ""} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost" size="icon"
                                                            onClick={() => navigate(`/containers/deploy?image=${encodeURIComponent(img.RepoTags?.[0] || img.Id)}`)}
                                                            className="text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Deploy Container From Image"
                                                        >
                                                            <Rocket size={14} />
                                                        </Button>
                                                            <Button 
                                                                variant="ghost" size="icon" 
                                                                onClick={() => {
                                                                    const imageRef = img.Id;
                                                                    setDeleteCandidate({ imageRef, label: img.RepoTags?.[0] || imageRef });
                                                                }}
                                                            disabled={isRemovingImage}
                                                            className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete Image"
                                                        >
                                                            <Trash2 size={14} className={activeDeleteRef === img.Id ? "animate-pulse" : ""} />
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

                <div className="lg:col-span-1 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121212] rounded-xl p-6 shadow-sm space-y-8">
                    <div>
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
                        <div>
                            <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Registry Credentials</label>
                            <select
                                value={selectedRegistryId}
                                onChange={(event) => setSelectedRegistryId(event.target.value)}
                                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100"
                            >
                                <option value="">Use anonymous / default daemon auth</option>
                                {registries.map((registry) => (
                                    <option key={registry.id} value={registry.id}>
                                        {registry.name} ({registry.url})
                                    </option>
                                ))}
                            </select>
                        </div>
                        {activeRegistry?.pull_presets && activeRegistry.pull_presets.length > 0 && (
                            <div>
                                <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Quick Pull Presets</label>
                                <div className="flex flex-wrap gap-2">
                                    {activeRegistry.pull_presets.map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setPullImageName(preset)}
                                            className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-950/20 dark:text-purple-200"
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
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

                    {exportedPath ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                            <div className="font-semibold">Latest exported image archive</div>
                            <div className="mt-1 break-all font-mono text-xs">{exportedPath}</div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-3"
                                onClick={() => {
                                    void downloadApiFile(`/v1/environments/${selectedServerId}/docker/images/export/download?path=${encodeURIComponent(exportedPath)}`, exportedFileName || undefined)
                                        .catch((error: any) => showNotification({ type: "error", message: "Download failed", description: error?.message || "Unable to download exported image." }));
                                }}
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download Archive
                            </Button>
                        </div>
                    ) : null}

                    {(isExporting || isPulling || isPushing || isRemovingImage || isRetagging) ? (
                        <div className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-cyan-50 to-white p-4 text-sm text-blue-800 dark:border-blue-900/40 dark:from-blue-950/30 dark:via-cyan-950/20 dark:to-zinc-950 dark:text-blue-200">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 rounded-2xl bg-blue-600/10 p-2 text-blue-600 dark:text-blue-300">
                                    <LoaderCircle className="h-5 w-5 animate-spin" />
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold">Long-running image action in progress</div>
                                    <div className="mt-1 text-blue-700/90 dark:text-blue-300/90">
                                        {isExporting ? "Exporting image archive..." : null}
                                        {isPulling ? "Pulling image layers..." : null}
                                        {isPushing ? "Pushing image to registry..." : null}
                                        {isRemovingImage ? "Removing local image..." : null}
                                        {isRetagging ? "Updating image tags..." : null}
                                    </div>
                                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950/60">
                                        <div className="h-full w-1/3 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
                        <h3 className="font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">Push Image</h3>
                        <form onSubmit={handlePush} className="space-y-4">
                            <Input
                                type="text"
                                placeholder="e.g., registry.example.com/team/app:latest"
                                value={pushImageName}
                                onChange={(e) => setPushImageName(e.target.value)}
                            />
                            {normalizedPushPreview ? (
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                                    Push target preview: <span className="font-mono text-zinc-900 dark:text-zinc-100">{normalizedPushPreview}</span>
                                </div>
                            ) : null}
                            {pushTargetNeedsNamespaceHint ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                    Docker Hub official images under <span className="font-mono">library/</span> are not writable. Push to your own namespace instead.
                                </div>
                            ) : null}
                            <select
                                value={pushRegistryId}
                                onChange={(event) => setPushRegistryId(event.target.value)}
                                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100"
                            >
                                <option value="">{activePushRegistry?.name ? `Push using default (${activePushRegistry.name})` : "Choose target registry"}</option>
                                {registries.map((registry) => (
                                    <option key={registry.id} value={registry.id}>
                                        {registry.name} ({registry.url})
                                    </option>
                                ))}
                            </select>
                            <Button type="submit" variant="primary" className="w-full" disabled={isPushing || !pushImageName || !selectedServerId}>
                                {isPushing ? "Pushing..." : "Push Image"}
                            </Button>
                        </form>
                    </div>

                    <div className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
                        <h3 className="font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2"><Tags className="h-4 w-4" /> Retag Image</h3>
                        <form onSubmit={handleRetag} className="space-y-4">
                            <Input type="text" placeholder="Source image ref" value={retagSource} onChange={(e) => setRetagSource(e.target.value)} />
                            <Input type="text" placeholder="Target image ref" value={retagTarget} onChange={(e) => setRetagTarget(e.target.value)} />
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                                <input type="checkbox" checked={removeOldTagAfterRetag} onChange={(e) => setRemoveOldTagAfterRetag(e.target.checked)} />
                                Remove old tag after retag to avoid duplicate references in the list
                            </label>
                            <Button type="submit" variant="primary" className="w-full" disabled={isRetagging || !retagSource || !retagTarget}>Retag Image</Button>
                        </form>
                    </div>

                    <div className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
                        <h3 className="font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2"><Sparkles className="h-4 w-4 text-cyan-500" /> Import Image Archive</h3>
                        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                            Importing a <span className="font-mono">docker save</span> archive into a runtime host still needs a dedicated backend endpoint. The UI is reserved here so the workflow can be enabled cleanly once the API lands.
                        </div>
                    </div>

                    <div className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
                        <h3 className="font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-4">Registry Browser</h3>
                        <select
                            value={browserRegistryId}
                            onChange={(event) => setBrowserRegistryId(event.target.value)}
                            className="mb-3 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100"
                        >
                            <option value="">Select a registry to browse</option>
                            {registries.map((registry) => (
                                <option key={registry.id} value={registry.id}>
                                    {registry.name} ({registry.url})
                                </option>
                            ))}
                        </select>
                        <Input
                            type="text"
                            placeholder="Optional repository for tags view"
                            value={registryRepository}
                            onChange={(e) => setRegistryRepository(e.target.value)}
                        />
                        <div className="mt-4 max-h-56 space-y-2 overflow-auto rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                            {(registryRepository ? registryCatalog?.tags?.[registryRepository] || [] : registryCatalog?.repositories || []).length === 0 ? (
                                <div className="text-sm text-zinc-500">Select a registry to browse repositories or tags.</div>
                            ) : (
                                (registryRepository ? registryCatalog?.tags?.[registryRepository] || [] : registryCatalog?.repositories || []).map((item) => (
                                    <div key={item} className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPullImageName(registryRepository ? `${registryRepository}:${item}` : item)}
                                            className="block flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm hover:border-purple-300 hover:bg-purple-50 dark:border-zinc-800 dark:hover:bg-purple-950/20"
                                        >
                                            {item}
                                        </button>
                                        {registryRepository ? (
                                            <Button variant="ghost" size="icon" onClick={() => void handleDeleteRegistryTag(item)} title="Delete registry tag">
                                                <Trash2 size={14} />
                                            </Button>
                                        ) : null}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <ConfirmActionDialog
                open={!!deleteCandidate}
                title="Force remove image?"
                description={`This removes ${deleteCandidate?.label || "the selected image"} from the current Docker environment. Any container still depending on it may need to re-pull or fail to start later.`}
                confirmLabel={isRemovingImage ? "Removing..." : "Remove Image"}
                onClose={() => setDeleteCandidate(null)}
                onConfirm={() => {
                    if (!deleteCandidate) {
                        return;
                    }
                    setActiveDeleteRef(deleteCandidate.imageRef);
                    removeImage(
                        { imageRef: deleteCandidate.imageRef, force: true },
                        {
                            onSuccess: () => {
                                showNotification({ type: "success", message: "Image removed", description: `${deleteCandidate.label} has been deleted.` });
                                setDeleteCandidate(null);
                            },
                            onError: (error: any) => showNotification({ type: "error", message: "Delete failed", description: error?.message || "Unable to remove image." }),
                            onSettled: () => setActiveDeleteRef(""),
                        }
                    );
                }}
                pending={isRemovingImage}
                tone="danger"
            />
        </div>
    );
}

function normalizePushTarget(imageRef: string, registry?: { provider?: string; username?: string; url?: string }) {
    const normalized = imageRef.trim();
    if (!normalized) {
        return "";
    }
    if (registry?.provider !== "dockerhub") {
        return normalized;
    }
    const hasRegistryPrefix = normalized.includes("/") && normalized.split("/")[0].includes(".");
    if (hasRegistryPrefix) {
        return normalized;
    }
    const segments = normalized.split("/");
    if (segments.length === 1) {
        const namespace = registry.username?.trim();
        return namespace ? `${namespace}/${normalized}` : normalized;
    }
    if (segments[0] === "library" || segments[0] === "docker.io" || segments[0] === "index.docker.io") {
        return normalized;
    }
    return normalized;
}
