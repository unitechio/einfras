import { useEffect, useMemo, useState } from "react";
import { X, Layers, Code, KeyRound, WandSparkles, FileCode2, RotateCcw } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { useDeleteDockerSecret, useDeployStack, useDockerSecrets, useRollbackStack, useSaveDockerSecret, useStackDetail } from "../api/useDockerHooks";
import { useNotification } from "@/core/NotificationContext";
import { useRegistries } from "@/features/repositories/api/useRepositories";

interface StackEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'create' | 'edit';
    environmentId: string;
    initialName?: string;
    initialContent?: string;
}

export default function StackEditorModal({ isOpen, onClose, mode, environmentId, initialName, initialContent }: StackEditorModalProps) {
    const [name, setName] = useState(initialName || "");
    const [composeContent, setComposeContent] = useState(initialContent || "version: '3.8'\r\nservices:\r\n  web:\r\n    image: nginx:latest\r\n    ports:\r\n      - '80:80'\r\n");
    const [environmentVars, setEnvironmentVars] = useState("");
    const [secretEntries, setSecretEntries] = useState("");
    const [configEntries, setConfigEntries] = useState("");
    const [secretName, setSecretName] = useState("");
    const [secretValue, setSecretValue] = useState("");
    const [activeTab, setActiveTab] = useState("compose");
    const [rollbackCandidate, setRollbackCandidate] = useState("");
    const { showNotification } = useNotification();
    const stackDetail = useStackDetail(environmentId, initialName || "");
    const deployStack = useDeployStack(environmentId);
    const rollbackStack = useRollbackStack(environmentId, initialName || "");
    const { data: secretAssets = [] } = useDockerSecrets(environmentId);
    const saveSecret = useSaveDockerSecret(environmentId);
    const deleteSecret = useDeleteDockerSecret(environmentId);
    const { data: registries = [] } = useRegistries();

    useEffect(() => {
        if (mode === "edit" && stackDetail.data) {
            setName(stackDetail.data.name);
            setComposeContent(stackDetail.data.compose);
            setEnvironmentVars(Object.entries(stackDetail.data.environment || {}).map(([key, value]) => `${key}=${value}`).join("\n"));
            setSecretEntries(Object.entries(stackDetail.data.secrets || {}).map(([key, value]) => `${key}<<EOF\n${value}\nEOF`).join("\n\n"));
            setConfigEntries(Object.entries(stackDetail.data.configs || {}).map(([key, value]) => `${key}<<EOF\n${value}\nEOF`).join("\n\n"));
        }
    }, [mode, stackDetail.data]);

    const revisions = useMemo(() => stackDetail.data?.revisions ?? [], [stackDetail.data]);
    const composeLineCount = useMemo(() => composeContent.split(/\r?\n/).length, [composeContent]);
    const envCount = useMemo(() => environmentVars.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length, [environmentVars]);
    const secretCount = useMemo(() => secretEntries.split(/\n(?=[^\s].*<<EOF)/).map((item) => item.trim()).filter(Boolean).length, [secretEntries]);

    if (!isOpen) return null;

    const parseEnvironment = () => environmentVars.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).reduce<Record<string, string>>((acc, line) => {
        const [key, ...rest] = line.split("=");
        if (key) acc[key.trim()] = rest.join("=").trim();
        return acc;
    }, {});

    const parseNamedBlocks = (value: string) => {
        const result: Record<string, string> = {};
        const blocks = value.split(/\n(?=[^\s].*<<EOF)/).map((item) => item.trim()).filter(Boolean);
        for (const block of blocks) {
            const match = block.match(/^([^\n<]+)<<EOF\s*\n([\s\S]*?)\nEOF$/);
            if (match) result[match[1].trim()] = match[2];
        }
        return result;
    };

    const insertSecretAsset = (assetName: string, assetValue: string) => {
        const block = `${assetName}<<EOF\n${assetValue}\nEOF`;
        setSecretEntries((current) => current.trim() ? `${current.trim()}\n\n${block}` : block);
    };

    const insertPresetImage = (imageRef: string) => {
        const next = composeContent.includes("image:")
            ? composeContent.replace(/image:\s*[^\n]+/, `image: ${imageRef}`)
            : `${composeContent.trim()}\n    image: ${imageRef}\n`;
        setComposeContent(next);
        setActiveTab("compose");
    };

    const handleSubmit = () => {
        deployStack.mutate({
            name,
            compose: composeContent,
            environment: parseEnvironment(),
            secrets: parseNamedBlocks(secretEntries),
            configs: parseNamedBlocks(configEntries),
        }, {
            onSuccess: () => {
                showNotification({ type: "success", message: mode === "create" ? "Stack deployed" : "Stack updated", description: `${name} has been applied successfully.` });
                onClose();
            },
            onError: (error: any) => {
                showNotification({ type: "error", message: "Stack deployment failed", description: error?.message || "Unable to deploy stack." });
            },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="flex h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#121212]">
                <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                            <Layers className="h-5 w-5 text-pink-500" />
                            {mode === "create" ? "Deploy Stack" : `Edit Stack: ${initialName}`}
                        </h2>
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                            Compose editor, environment, configs and revision rollback in one cleaner workflow.
                        </p>
                    </div>
                    <button onClick={onClose} className="rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto px-6 py-6">
                    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.75fr]">
                        <div className="space-y-5">
                            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                                <Field label="Stack Name">
                                    <Input type="text" placeholder="e.g. backend-stack" value={name} onChange={e => setName(e.target.value)} />
                                </Field>
                                {mode === "edit" ? (
                                    <Field label="Rollback Revision">
                                        <select
                                            onChange={(e) => {
                                                const revision = e.target.value;
                                                if (!revision) return;
                                                setRollbackCandidate(revision);
                                                e.currentTarget.value = "";
                                            }}
                                            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-[#121212]"
                                        >
                                            <option value="">Select revision...</option>
                                            {revisions.map((revision) => <option key={revision.id} value={revision.id}>{revision.id}</option>)}
                                        </select>
                                    </Field>
                                ) : (
                                    <SummaryCard title="Draft Summary" rows={[["Compose lines", String(composeLineCount)], ["Environment entries", String(envCount)], ["Secret blocks", String(secretCount)]]} />
                                )}
                            </div>

                            <div className="rounded-[24px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                                <Tabs value={activeTab} onValueChange={setActiveTab}>
                                    <TabsList className="px-5 pt-3">
                                        <TabsTrigger value="compose" icon={Code}>Compose</TabsTrigger>
                                        <TabsTrigger value="env" icon={FileCode2}>Environment</TabsTrigger>
                                        <TabsTrigger value="assets" icon={KeyRound}>Secrets & Configs</TabsTrigger>
                                    </TabsList>

                                    <div className="p-5">
                                        <TabsContent value="compose" className="mt-0">
                                            <Field label="docker-compose.yml" helper="Keep YAML readable here. Use registry presets on the right to inject image references fast.">
                                                <textarea className="min-h-[520px] w-full rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" value={composeContent} onChange={e => setComposeContent(e.target.value)} spellCheck={false} />
                                            </Field>
                                        </TabsContent>

                                        <TabsContent value="env" className="mt-0">
                                            <Field label="Environment Variables" helper="One key=value per line. These are supplied to the stack deploy command and tracked separately from compose content.">
                                                <textarea className="min-h-[520px] w-full rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" value={environmentVars} onChange={(e) => setEnvironmentVars(e.target.value)} placeholder={"FOO=bar\nAPI_URL=https://example.com"} spellCheck={false} />
                                            </Field>
                                        </TabsContent>

                                        <TabsContent value="assets" className="mt-0">
                                            <div className="grid gap-4 lg:grid-cols-2">
                                                <Field label="Secrets" helper="Saved beside the compose bundle and available during deploy.">
                                                    <textarea className="min-h-[320px] w-full rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" value={secretEntries} onChange={(e) => setSecretEntries(e.target.value)} placeholder={"db_password<<EOF\nsuper-secret-value\nEOF"} spellCheck={false} />
                                                </Field>
                                                <Field label="Configs" helper="Use for config files or template snippets referenced by services.">
                                                    <textarea className="min-h-[320px] w-full rounded-[24px] border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" value={configEntries} onChange={(e) => setConfigEntries(e.target.value)} placeholder={"nginx_conf<<EOF\nserver { listen 80; }\nEOF"} spellCheck={false} />
                                                </Field>
                                            </div>
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <SummaryCard title="Deploy Checklist" rows={[["Compose valid", composeContent.trim() ? "Ready" : "Missing"], ["Stack name", name.trim() || "Required"], ["Revision history", mode === "edit" ? `${revisions.length} revision(s)` : "New stack"]]} />

                            <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    <KeyRound className="h-4 w-4 text-pink-500" />
                                    Secret Assets
                                </div>
                                <div className="grid gap-2">
                                    <Input placeholder="secret name" value={secretName} onChange={(e) => setSecretName(e.target.value)} />
                                    <textarea className="min-h-[92px] w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-sm outline-none dark:border-zinc-800 dark:bg-[#121212]" value={secretValue} onChange={(e) => setSecretValue(e.target.value)} placeholder="secret value" spellCheck={false} />
                                    <Button variant="outline" onClick={() => saveSecret.mutate(
                                        { name: secretName, value: secretValue },
                                        {
                                            onSuccess: (asset) => {
                                                setSecretName("");
                                                setSecretValue("");
                                                showNotification({ type: "success", message: "Secret saved", description: asset.name });
                                            },
                                            onError: (error: any) => showNotification({ type: "error", message: "Secret save failed", description: error?.message || "Unable to save secret asset." }),
                                        },
                                    )} disabled={saveSecret.isPending || !secretName.trim()}>
                                        Save Secret Asset
                                    </Button>
                                </div>
                                <div className="mt-3 space-y-2">
                                    {secretAssets.map((asset) => (
                                        <div key={asset.name} className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                                            <button type="button" className="font-medium text-left text-zinc-900 dark:text-zinc-100" onClick={() => insertSecretAsset(asset.name, asset.value)}>{asset.name}</button>
                                            <button type="button" className="text-xs text-red-500" onClick={() => deleteSecret.mutate(asset.name)}>Delete</button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    <WandSparkles className="h-4 w-4 text-orange-500" />
                                    Registry Presets
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {registries.flatMap((registry) => (registry.pull_presets || []).map((preset) => ({ registry: registry.name, preset }))).map((item) => (
                                        <button key={`${item.registry}-${item.preset}`} type="button" onClick={() => insertPresetImage(item.preset)} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-200">
                                            {item.registry}: {item.preset}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {mode === "edit" && revisions.length > 0 ? (
                                <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
                                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                        <RotateCcw className="h-4 w-4 text-blue-500" />
                                        Recent Revisions
                                    </div>
                                    <div className="space-y-2">
                                        {revisions.slice(0, 5).map((revision) => (
                                            <div key={revision.id} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800">
                                                <div className="font-medium text-zinc-900 dark:text-zinc-100">{revision.id}</div>
                                                <div className="mt-1 text-zinc-500 dark:text-zinc-400">{new Date(revision.created_at).toLocaleString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="sticky bottom-0 flex justify-end gap-2 border-t border-zinc-100 bg-white/95 px-6 py-4 backdrop-blur dark:border-zinc-800 dark:bg-[#121212]/95">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" className="bg-pink-600 text-white hover:bg-pink-700" onClick={handleSubmit} disabled={deployStack.isPending || !name.trim() || !composeContent.trim()} isLoading={deployStack.isPending}>
                        {mode === 'create' ? 'Deploy Stack' : 'Update Stack'}
                    </Button>
                </div>
                <ConfirmActionDialog
                    open={!!rollbackCandidate}
                    title="Rollback stack revision?"
                    description={`This restores ${name || initialName || "the stack"} to revision ${rollbackCandidate}. Running services may be recreated to match that snapshot.`}
                    confirmLabel={rollbackStack.isPending ? "Rolling back..." : "Rollback Revision"}
                    onClose={() => setRollbackCandidate("")}
                    onConfirm={() => {
                        if (!rollbackCandidate) {
                            return;
                        }
                        rollbackStack.mutate(rollbackCandidate, {
                            onSuccess: () => {
                                showNotification({ type: "success", message: "Rollback completed", description: `${name} rolled back to ${rollbackCandidate}.` });
                                setRollbackCandidate("");
                            },
                            onError: (error: any) => showNotification({ type: "error", message: "Rollback failed", description: error?.message || "Unable to rollback stack." }),
                        });
                    }}
                    pending={rollbackStack.isPending}
                    tone="warning"
                />
            </div>
        </div>
    );
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
    return <div><label className="mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</label>{children}{helper ? <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{helper}</p> : null}</div>;
}

function SummaryCard({ title, rows }: { title: string; rows: [string, string][] }) {
    return (
        <div className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
            <div className="space-y-2 text-sm">
                {rows.map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                        <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
                        <span className="max-w-[58%] text-right font-medium text-zinc-900 dark:text-zinc-100">{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
