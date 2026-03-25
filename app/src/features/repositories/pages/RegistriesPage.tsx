"use client";

import { useMemo, useState } from "react";
import { Search, Trash2, Plus, Box, Check, Shield, X, Settings2, FlaskConical, Star, Eye, EyeOff } from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { getStoredSession } from "@/features/authentication/auth-session";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { useDeleteRegistry, useRegistries, useSaveRegistry, useTestRegistry } from "../api/useRepositories";
import type { Registry } from "../types";

type Provider = "dockerhub" | "ecr" | "quay" | "proget" | "azure" | "gitlab" | "custom";
type AuthMode = "username-password" | "token" | "access-secret";

type ProviderConfig = {
  id: Provider;
  name: string;
  desc: string;
  defaultUrl: string;
  authMode: AuthMode;
  usernameLabel: string;
  passwordLabel: string;
  tokenLabel: string;
  helper: string;
  regionRequired?: boolean;
};

type FormState = {
  id: string;
  name: string;
  username: string;
  token: string;
  password: string;
  url: string;
  region: string;
  authEnabled: boolean;
  isDefault: boolean;
  pullPresets: string;
};

const providers: ProviderConfig[] = [
  { id: "dockerhub", name: "DockerHub", desc: "Personal or organization namespace", defaultUrl: "https://index.docker.io/v1/", authMode: "username-password", usernameLabel: "Docker Hub Username", passwordLabel: "Password / PAT", tokenLabel: "Access Token", helper: "Push targets must use your namespace. Example: username/app:tag, not docker.io/library/app." },
  { id: "ecr", name: "AWS ECR", desc: "Amazon Elastic Container Registry", defaultUrl: "", authMode: "access-secret", usernameLabel: "AWS Access Key ID", passwordLabel: "AWS Secret Access Key", tokenLabel: "Session Token", helper: "Use registry endpoint and region. Session token is optional for temporary credentials.", regionRequired: true },
  { id: "quay", name: "Quay.io", desc: "Robot or user account", defaultUrl: "https://quay.io", authMode: "token", usernameLabel: "Robot Account", passwordLabel: "Hidden Secret", tokenLabel: "Robot Token", helper: "Quay commonly uses robot accounts and generated tokens instead of a human password." },
  { id: "proget", name: "ProGet", desc: "Self-hosted ProGet registry", defaultUrl: "", authMode: "username-password", usernameLabel: "Username", passwordLabel: "Password / API Key", tokenLabel: "API Key", helper: "Use the exact feed endpoint and a scoped API key where possible." },
  { id: "azure", name: "Azure ACR", desc: "Azure Container Registry", defaultUrl: "", authMode: "username-password", usernameLabel: "Registry Username", passwordLabel: "Registry Password", tokenLabel: "Access Token", helper: "Store the generated registry user credentials for pull and push workflows." },
  { id: "gitlab", name: "GitLab", desc: "GitLab container registry", defaultUrl: "", authMode: "token", usernameLabel: "GitLab Username", passwordLabel: "Hidden Secret", tokenLabel: "Deploy / PAT Token", helper: "Prefer deploy tokens or PAT with read_registry and write_registry scopes." },
  { id: "custom", name: "Custom", desc: "Any OCI-compatible registry", defaultUrl: "", authMode: "username-password", usernameLabel: "Username", passwordLabel: "Password", tokenLabel: "Access Token", helper: "Use this for Harbor, Nexus, JFrog or any private OCI endpoint." },
];

const emptyForm: FormState = {
  id: "",
  name: "",
  username: "",
  token: "",
  password: "",
  url: "",
  region: "us-west-1",
  authEnabled: true,
  isDefault: false,
  pullPresets: "",
};

export default function RegistriesPage() {
  const { showNotification } = useNotification();
  const { data: registries = [] } = useRegistries();
  const saveRegistry = useSaveRegistry();
  const testRegistry = useTestRegistry();
  const deleteRegistry = useDeleteRegistry();
  const [view, setView] = useState<"list" | "editor">("list");
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; name: string } | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider>("dockerhub");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSecrets, setShowSecrets] = useState(false);
  const [formData, setFormData] = useState<FormState>({ ...emptyForm, url: providers[0].defaultUrl });

  const session = getStoredSession();
  const isAdmin = (session?.principal.roles || []).some((role) => ["admin", "owner", "super-admin"].includes(role.toLowerCase()));
  const provider = providers.find((item) => item.id === selectedProvider) || providers[0];
  const presetItems = formData.pullPresets.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

  const filteredRegistries = useMemo(() => registries.filter((registry) => `${registry.name} ${registry.url} ${registry.provider} ${(registry.pull_presets || []).join(" ")}`.toLowerCase().includes(searchTerm.toLowerCase())), [registries, searchTerm]);

  const setField = (field: keyof FormState, value: string | boolean) => setFormData((current) => ({ ...current, [field]: value }));
  const toRegistryPayload = (): Registry => ({
    id: formData.id,
    name: formData.name || `New ${provider.name}`,
    provider: selectedProvider,
    url: formData.url || provider.defaultUrl || "https://registry.example.com",
    username: formData.username || undefined,
    password: formData.password || undefined,
    token: formData.token || undefined,
    region: formData.region || undefined,
    is_anonymous: !formData.authEnabled,
    is_default: formData.isDefault,
    pull_presets: presetItems,
  });

  const openCreate = () => {
    setSelectedProvider("dockerhub");
    setShowSecrets(false);
    setFormData({ ...emptyForm, url: providers[0].defaultUrl });
    setView("editor");
  };

  const openEdit = (registry: Registry) => {
    const nextProvider = (registry.provider as Provider) || "custom";
    setSelectedProvider(nextProvider);
    setShowSecrets(false);
    setFormData({
      id: registry.id,
      name: registry.name,
      username: registry.username || "",
      token: registry.token || "",
      password: registry.password || "",
      url: registry.url,
      region: registry.region || "us-west-1",
      authEnabled: !registry.is_anonymous,
      isDefault: !!registry.is_default,
      pullPresets: (registry.pull_presets || []).join("\n"),
    });
    setView("editor");
  };

  const handleProviderSelect = (providerId: Provider) => {
    const nextProvider = providers.find((item) => item.id === providerId) || providers[0];
    setSelectedProvider(providerId);
    setFormData((current) => ({
      ...current,
      url: current.id || current.url.trim() ? current.url : nextProvider.defaultUrl,
      region: nextProvider.regionRequired ? current.region || "us-west-1" : current.region,
    }));
  };

  const handleSaveRegistry = () => {
    const payload = toRegistryPayload();
    saveRegistry.mutate(payload, {
      onSuccess: () => {
        setView("list");
        showNotification({ type: "success", message: payload.id ? "Registry updated" : "Registry added", description: `Registry ${payload.name} saved successfully.` });
      },
      onError: (error: any) => showNotification({ type: "error", message: "Registry save failed", description: error?.message || "Unable to save registry credentials." }),
    });
  };

  const handleTestRegistry = () => {
    const payload = toRegistryPayload();
    testRegistry.mutate(payload, {
      onSuccess: () => showNotification({ type: "success", message: "Registry validated", description: `${payload.name} authenticated successfully.` }),
      onError: (error: any) => showNotification({ type: "error", message: "Registry test failed", description: error?.message || "Unable to validate registry credentials." }),
    });
  };

  const handleDeleteRegistry = (id: string, name: string) => {
    setDeleteCandidate({ id, name });
  };

  const renderSecretFields = () => {
    if (!formData.authEnabled) {
      return <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">Anonymous access is enabled. This registry will rely on public access or daemon-side credentials.</div>;
    }
    if (!isAdmin) {
      return <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">Only administrators can view or edit registry secrets. Operators can still review endpoint and preset behaviour.</div>;
    }
    if (provider.authMode === "token") {
      return (
        <div className="grid gap-5 lg:grid-cols-2">
          <Field label={provider.usernameLabel}><Input value={formData.username} onChange={(event) => setField("username", event.target.value)} placeholder="registry-bot" /></Field>
          <Field label={provider.tokenLabel}><SecretInput value={formData.token} showSecrets={showSecrets} onToggle={() => setShowSecrets((current) => !current)} onChange={(value) => setField("token", value)} placeholder="glpat-... / robot token" /></Field>
        </div>
      );
    }
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <Field label={provider.usernameLabel}><Input value={formData.username} onChange={(event) => setField("username", event.target.value)} placeholder={provider.authMode === "access-secret" ? "AKIA..." : "username"} /></Field>
        <Field label={provider.passwordLabel}><SecretInput value={formData.password} showSecrets={showSecrets} onToggle={() => setShowSecrets((current) => !current)} onChange={(value) => setField("password", value)} placeholder="••••••••••••" /></Field>
        {provider.authMode === "access-secret" ? <div className="lg:col-span-2"><Field label={provider.tokenLabel} helper="Optional session token for STS / temporary credentials."><SecretInput value={formData.token} showSecrets={showSecrets} onToggle={() => setShowSecrets((current) => !current)} onChange={(value) => setField("token", value)} placeholder="Optional session token" /></Field></div> : null}
      </div>
    );
  };

  if (view === "editor") {
    return (
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2"><Box className="h-6 w-6 text-orange-500" />{formData.id ? "Edit Registry" : "Add Registry"}</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Provider-aware authentication, endpoint routing and preset management.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setView("list")}><X className="mr-2 h-4 w-4" /> Cancel</Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.85fr]">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Select Provider</label>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {providers.map((item) => (
                    <button key={item.id} type="button" onClick={() => handleProviderSelect(item.id)} className={cn("relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all", selectedProvider === item.id ? "border-orange-300 bg-orange-50 ring-1 ring-orange-400/60 dark:border-orange-500/40 dark:bg-orange-500/10" : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-[#121212] dark:hover:border-zinc-700")}>
                      {selectedProvider === item.id ? <div className="absolute right-3 top-3 rounded-full bg-orange-500 p-0.5 text-white"><Check size={12} /></div> : null}
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</h3>
                      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{item.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <Field label="Connection Name"><Input value={formData.name} onChange={(event) => setField("name", event.target.value)} placeholder="e.g. Production DockerHub" /></Field>
                <Field label="Registry URL" helper="Keep the provider default or override with your exact endpoint."><Input value={formData.url} onChange={(event) => setField("url", event.target.value)} placeholder="registry.example.com" /></Field>
                <Field label="Authentication Mode"><div className="flex h-10 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">{provider.authMode === "token" ? "Token-based" : provider.authMode === "access-secret" ? "Access key pair" : "Username + password"}</div></Field>
                <Field label="Region"><Input value={formData.region} onChange={(event) => setField("region", event.target.value)} placeholder={provider.regionRequired ? "us-west-1" : "Optional"} /></Field>
              </div>

              <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Authentication</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{provider.helper}</div>
                  </div>
                  {isAdmin ? <Button type="button" variant="ghost" size="sm" onClick={() => setShowSecrets((current) => !current)}>{showSecrets ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}{showSecrets ? "Hide Secrets" : "Reveal Secrets"}</Button> : null}
                </div>
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
                  <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"><input type="checkbox" checked={formData.authEnabled} onChange={(event) => setField("authEnabled", event.target.checked)} /> Use authenticated login</label>
                  <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"><input type="checkbox" checked={formData.isDefault} onChange={(event) => setField("isDefault", event.target.checked)} /> Set as default registry</label>
                </div>
                {renderSecretFields()}
              </div>

              <Field label="Pull Presets" helper="One image reference per line. These show up as quick-pull options in Docker workflows.">
                <textarea className="min-h-[180px] w-full rounded-2xl border border-zinc-200 bg-white p-3 font-mono text-sm outline-none dark:border-zinc-800 dark:bg-[#121212]" value={formData.pullPresets} onChange={(event) => setField("pullPresets", event.target.value)} placeholder={"nginx:stable-alpine\nredis:7\nusername/app:latest"} spellCheck={false} />
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-zinc-100 pt-6 dark:border-zinc-800">
              <Button type="button" variant="outline" onClick={() => setView("list")}>Cancel</Button>
              <Button type="button" variant="outline" onClick={handleTestRegistry} disabled={testRegistry.isPending} isLoading={testRegistry.isPending}><FlaskConical size={16} className="mr-2" /> Test Connection</Button>
              <Button type="button" variant="primary" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleSaveRegistry} disabled={saveRegistry.isPending} isLoading={saveRegistry.isPending}><Plus size={16} className="mr-2" />{formData.id ? "Save Changes" : "Connect Registry"}</Button>
            </div>
          </div>

          <div className="space-y-4">
            <PreviewCard title="Provider Preview" rows={[["Provider", provider.name], ["Endpoint", formData.url || provider.defaultUrl || "Not set"], ["Auth", !formData.authEnabled ? "Anonymous access" : !isAdmin ? "Hidden for non-admin operators" : provider.authMode === "token" ? (formData.token ? "Token configured" : "Token missing") : formData.username && formData.password ? "Credentials configured" : "Credentials missing"], ["Presets", presetItems.length ? `${presetItems.length} preset(s)` : "No presets"], ["Routing", formData.isDefault ? "Default registry" : "Secondary registry"]]} />
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
              <div className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pull Preset Preview</div>
              <div className="space-y-2">
                {presetItems.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-200 px-3 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">Add pull presets to expose quick actions in Docker workflows.</div> : presetItems.slice(0, 6).map((preset) => <div key={preset} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">{preset}</div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2"><Box className="h-6 w-6 text-orange-500" /> Registries</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage provider-aware registry auth, pull routing and reusable image presets.</p>
        </div>
        <Button variant="primary" size="md" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Registry</Button>
      </div>

      <div className="w-full sm:max-w-xs"><Input icon={<Search className="h-4 w-4 text-zinc-400" />} placeholder="Search registries..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>

      <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Registry Name</TableHead><TableHead>URL / Endpoint</TableHead><TableHead>Presets</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {filteredRegistries.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-48 text-center"><div className="flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400"><Box size={32} className="mb-3 opacity-20" /><p className="text-[13px] font-medium">No registries configured.</p></div></TableCell></TableRow>
            ) : filteredRegistries.map((registry) => (
              <TableRow key={registry.id} className="group">
                <TableCell><div className="flex items-center gap-2"><span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">{registry.name}</span>{registry.is_default ? <Badge variant="success"><Star className="w-3 h-3 mr-1 inline" /> Default</Badge> : null}</div></TableCell>
                <TableCell><span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{registry.url}</span></TableCell>
                <TableCell className="text-sm text-zinc-600 dark:text-zinc-400">
                  {(registry.pull_presets || []).length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(registry.pull_presets || []).slice(0, 2).map((preset) => (
                        <Badge key={preset} variant="outline" className="max-w-[180px] truncate" title={preset}>
                          {preset}
                        </Badge>
                      ))}
                      {(registry.pull_presets || []).length > 2 ? <Badge variant="outline">+{(registry.pull_presets || []).length - 2}</Badge> : null}
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-zinc-500 dark:text-zinc-400">
                      No presets
                    </Badge>
                  )}
                </TableCell>
                <TableCell><div className="flex items-center gap-2">{registry.is_anonymous ? <Badge variant="outline">Anonymous</Badge> : <Badge variant="success"><Shield className="w-3 h-3 mr-1 inline" /> Validated</Badge>}<Badge variant="outline">{registry.provider}</Badge></div></TableCell>
                <TableCell className="text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="icon" className="text-zinc-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:text-orange-400 dark:hover:bg-zinc-800" title="Edit" onClick={() => openEdit(registry)}><Settings2 size={14} /></Button><Button variant="ghost" size="icon" className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete" onClick={() => handleDeleteRegistry(registry.id, registry.name)}><Trash2 size={14} /></Button></div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
    <ConfirmActionDialog
      open={!!deleteCandidate}
      title="Remove registry?"
      description={deleteCandidate ? `This removes registry ${deleteCandidate.name} from your saved endpoints and auth presets.` : ""}
      confirmLabel={deleteRegistry.isPending ? "Removing..." : "Remove Registry"}
      onClose={() => setDeleteCandidate(null)}
      onConfirm={() => {
        if (!deleteCandidate) return;
        deleteRegistry.mutate(deleteCandidate.id, {
          onSuccess: () => {
            showNotification({ type: "success", message: "Registry removed", description: `${deleteCandidate.name} has been deleted.` });
            setDeleteCandidate(null);
          },
          onError: (error: any) => {
            showNotification({ type: "error", message: "Registry remove failed", description: error?.message || "Unable to remove registry." });
          },
        });
      }}
      pending={deleteRegistry.isPending}
      tone="danger"
    />
    </>
  );
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1.5">{label}</label>{children}{helper ? <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{helper}</p> : null}</div>;
}

function SecretInput({ value, onChange, showSecrets, onToggle, placeholder }: { value: string; onChange: (value: string) => void; showSecrets: boolean; onToggle: () => void; placeholder: string }) {
  return <div className="relative"><Input type={showSecrets ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /><button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">{showSecrets ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>;
}

function PreviewCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-[#121212]"><div className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</div><div className="space-y-3 text-sm">{rows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40"><span className="text-zinc-500 dark:text-zinc-400">{label}</span><span className="max-w-[60%] text-right font-medium text-zinc-900 dark:text-zinc-100">{value}</span></div>)}</div></div>;
}
