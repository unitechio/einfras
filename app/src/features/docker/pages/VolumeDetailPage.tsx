import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, HardDrive } from "lucide-react";

import { useEnvironment } from "@/core/EnvironmentContext";
import { Button } from "@/shared/ui/Button";
import { Card } from "@/shared/ui/Card";
import { useBackupVolume, useCloneVolume, useDeleteVolumeFile, useDockerTopology, useReadVolumeFile, useSaveVolumeFile, useVolumeFiles, useVolumes } from "../api/useDockerHooks";
import { useNotification } from "@/core/NotificationContext";
import { buildApiUrl, buildAuthHeaders, queryClient } from "@/core/api-client";

export default function VolumeDetailPage() {
    const navigate = useNavigate();
    const { volumeName = "" } = useParams();
    const { selectedEnvironment } = useEnvironment();
    const environmentId = selectedEnvironment?.type === "docker" ? selectedEnvironment.id : "";
    const { data: volumes = [] } = useVolumes(environmentId);
    const { data: topology } = useDockerTopology(environmentId);
    const [path, setPath] = useState("/");
    const [selectedFile, setSelectedFile] = useState("");
    const [editorContent, setEditorContent] = useState("");
    const { data: files } = useVolumeFiles(environmentId, volumeName, path);
    const { data: fileContent } = useReadVolumeFile(environmentId, volumeName, selectedFile);
    const backupVolume = useBackupVolume(environmentId);
    const cloneVolume = useCloneVolume(environmentId);
    const deleteVolumeFile = useDeleteVolumeFile(environmentId);
    const saveVolumeFile = useSaveVolumeFile(environmentId, volumeName);
    const { showNotification } = useNotification();

    const volume = useMemo(() => volumes.find((item) => item.Name === volumeName), [volumes, volumeName]);
    const attached = useMemo(() => topology?.edges.filter((edge) => edge.target === `volume:${volumeName}`).map((edge) => topology.nodes.find((node) => node.id === edge.source)?.label).filter(Boolean) || [], [topology, volumeName]);

    useEffect(() => {
        setEditorContent(fileContent?.content || "");
    }, [fileContent?.content, selectedFile]);

    const handleDownload = async (targetPath: string) => {
        const response = await fetch(buildApiUrl(`/v1/environments/${environmentId}/docker/volumes/${encodeURIComponent(volumeName)}/files/download?path=${encodeURIComponent(targetPath)}`), {
            headers: buildAuthHeaders(),
        });
        if (!response.ok) {
            showNotification({ type: "error", message: "Download failed", description: "Unable to download file from volume." });
            return;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = targetPath.split("/").pop() || "download.bin";
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("path", path);
        const response = await fetch(buildApiUrl(`/v1/environments/${environmentId}/docker/volumes/${encodeURIComponent(volumeName)}/files/upload`), {
            method: "POST",
            headers: buildAuthHeaders(),
            body: formData,
        });
        if (!response.ok) {
            showNotification({ type: "error", message: "Upload failed", description: "Unable to upload file into volume." });
            return;
        }
        showNotification({ type: "success", message: "File uploaded", description: file.name });
        await queryClient.invalidateQueries({ queryKey: ["docker", "volumes", environmentId, volumeName, "files", path] });
        event.target.value = "";
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" onClick={() => navigate("/volumes")}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => backupVolume.mutate(volumeName, {
                        onSuccess: (result) => showNotification({ type: "success", message: "Backup created", description: result.path }),
                    })}>Backup</Button>
                    <Button variant="primary" onClick={() => {
                        const targetName = prompt("Clone into volume:", `${volumeName}-clone`);
                        if (targetName) {
                            cloneVolume.mutate({ volumeName, targetName }, {
                                onSuccess: () => showNotification({ type: "success", message: "Volume cloned", description: `${volumeName} -> ${targetName}` }),
                            });
                        }
                    }}>Clone</Button>
                </div>
            </div>
            <Card className="p-6">
                <div className="flex items-center gap-2 text-2xl font-semibold"><HardDrive className="h-6 w-6 text-purple-500" /> {volume?.Name || volumeName}</div>
                <pre className="mt-4 rounded-xl bg-black p-4 font-mono text-xs text-zinc-200">{JSON.stringify(volume, null, 2)}</pre>
            </Card>
            <div className="grid gap-6 xl:grid-cols-2">
                <Card className="p-6">
                    <div className="font-semibold">Attached Containers</div>
                    <div className="mt-3 space-y-2">
                        {attached.length === 0 ? <div className="text-sm text-zinc-500">No attached containers.</div> : attached.map((item) => <div key={item} className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">{item}</div>)}
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="font-semibold">Volume Browser</div>
                    <input value={path} onChange={(event) => setPath(event.target.value)} className="mt-4 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]" />
                    <label className="mt-3 inline-flex cursor-pointer items-center rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
                        Upload file
                        <input type="file" className="hidden" onChange={handleUpload} />
                    </label>
                    <div className="mt-4 max-h-80 space-y-2 overflow-auto">
                        {(files?.items || []).map((item) => (
                            <div key={item.path} className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                                <button type="button" onClick={() => item.is_dir ? setPath(item.path) : setSelectedFile(item.path)} className="truncate text-left text-sm hover:text-purple-600">{item.name}</button>
                                {!item.is_dir ? (
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => void handleDownload(item.path)}>Download</Button>
                                        <Button variant="ghost" size="sm" onClick={() => deleteVolumeFile.mutate({ volumeName, path: item.path })}>Delete</Button>
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
            {selectedFile ? (
                <Card className="p-6">
                    <div className="font-semibold">File Preview</div>
                    <div className="mt-2 text-xs text-zinc-500">{selectedFile}</div>
                    <textarea
                        value={editorContent}
                        onChange={(event) => setEditorContent(event.target.value)}
                        className="mt-4 min-h-[420px] w-full rounded-xl bg-black p-4 font-mono text-xs text-zinc-200 outline-none"
                    />
                    <div className="mt-3 flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => void handleDownload(selectedFile)}>Download</Button>
                        <Button variant="primary" size="sm" onClick={() => saveVolumeFile.mutate({ path: selectedFile, content: editorContent }, {
                            onSuccess: () => showNotification({ type: "success", message: "Volume file saved", description: selectedFile }),
                        })}>Save File</Button>
                    </div>
                </Card>
            ) : null}
        </div>
    );
}
