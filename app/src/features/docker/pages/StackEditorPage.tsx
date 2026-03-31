import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Layers,
  Code,
  KeyRound,
  WandSparkles,
  FileCode2,
  RotateCcw,
  Save,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { ConfirmActionDialog } from "@/shared/ui/ConfirmActionDialog";
import { Input } from "@/shared/ui/Input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import {
  useDeleteDockerSecret,
  useDeployStack,
  useDockerSecrets,
  useRollbackStack,
  useSaveDockerSecret,
  useStackDetail,
} from "../api/useDockerHooks";
import { useNotification } from "@/core/NotificationContext";
import { useRegistries } from "@/features/repositories/api/useRepositories";
import { cn } from "@/lib/utils";

export default function StackEditorPage() {
  const navigate = useNavigate();
  const { stackName } = useParams();
  const [searchParams] = useSearchParams();
  const environmentId = searchParams.get("envId") || "";
  const mode = stackName ? "edit" : "create";

  const [name, setName] = useState(stackName || "");
  const [composeContent, setComposeContent] = useState(
    "version: '3.8'\r\nservices:\r\n  web:\r\n    image: nginx:latest\r\n    ports:\r\n      - '80:80'\r\n",
  );
  const [environmentVars, setEnvironmentVars] = useState("");
  const [secretEntries, setSecretEntries] = useState("");
  const [configEntries, setConfigEntries] = useState("");

  const [secretName, setSecretName] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [activeTab, setActiveTab] = useState("compose");
  const [rollbackCandidate, setRollbackCandidate] = useState("");

  const { showNotification } = useNotification();
  const stackDetail = useStackDetail(environmentId, stackName || "");
  const deployStack = useDeployStack(environmentId);
  const rollbackStack = useRollbackStack(environmentId, stackName || "");
  const { data: secretAssets = [] } = useDockerSecrets(environmentId);
  const saveSecret = useSaveDockerSecret(environmentId);
  const deleteSecret = useDeleteDockerSecret(environmentId);
  const { data: registries = [] } = useRegistries();

  useEffect(() => {
    if (mode === "edit" && stackDetail.data) {
      setName(stackDetail.data.name);
      setComposeContent(stackDetail.data.compose || "");
      setEnvironmentVars(
        Object.entries(stackDetail.data.environment || {})
          .map(([key, value]) => `${key}=${value}`)
          .join("\n"),
      );
      setSecretEntries(
        Object.entries(stackDetail.data.secrets || {})
          .map(([key, value]) => `${key}<<EOF\n${value}\nEOF`)
          .join("\n\n"),
      );
      setConfigEntries(
        Object.entries(stackDetail.data.configs || {})
          .map(([key, value]) => `${key}<<EOF\n${value}\nEOF`)
          .join("\n\n"),
      );
    }
  }, [mode, stackDetail.data]);

  const revisions = useMemo(
    () => stackDetail.data?.revisions ?? [],
    [stackDetail.data],
  );
  const composeLineCount = useMemo(
    () => composeContent.split(/\r?\n/).length,
    [composeContent],
  );
  const envCount = useMemo(
    () =>
      environmentVars
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean).length,
    [environmentVars],
  );
  const secretCount = useMemo(
    () =>
      secretEntries
        .split(/\n(?=[^\s].*<<EOF)/)
        .map((item) => item.trim())
        .filter(Boolean).length,
    [secretEntries],
  );

  const parseEnvironment = () =>
    environmentVars
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((acc, line) => {
        const [key, ...rest] = line.split("=");
        if (key) acc[key.trim()] = rest.join("=").trim();
        return acc;
      }, {});

  const parseNamedBlocks = (value: string) => {
    const result: Record<string, string> = {};
    const blocks = value
      .split(/\n(?=[^\s].*<<EOF)/)
      .map((item) => item.trim())
      .filter(Boolean);
    for (const block of blocks) {
      const match = block.match(/^([^\n<]+)<<EOF\s*\n([\s\S]*?)\nEOF$/);
      if (match) result[match[1].trim()] = match[2];
    }
    return result;
  };

  const insertSecretAsset = (assetName: string, assetValue: string) => {
    const block = `${assetName}<<EOF\n${assetValue}\nEOF`;
    setSecretEntries((current) =>
      current.trim() ? `${current.trim()}\n\n${block}` : block,
    );
  };

  const insertPresetImage = (imageRef: string) => {
    const next = composeContent.includes("image:")
      ? composeContent.replace(/image:\s*[^\n]+/, `image: ${imageRef}`)
      : `${composeContent.trim()}\n    image: ${imageRef}\n`;
    setComposeContent(next);
    setActiveTab("compose");
  };

  const handleSubmit = () => {
    deployStack.mutate(
      {
        name,
        compose: composeContent,
        environment: parseEnvironment(),
        secrets: parseNamedBlocks(secretEntries),
        configs: parseNamedBlocks(configEntries),
      },
      {
        onSuccess: () => {
          showNotification({
            type: "success",
            message: mode === "create" ? "Stack deployed" : "Stack updated",
            description: `${name} has been applied successfully.`,
          });
          navigate(-1);
        },
        onError: (error: any) => {
          showNotification({
            type: "error",
            message: "Stack deployment failed",
            description: error?.message || "Unable to deploy stack.",
          });
        },
      },
    );
  };

  if (!environmentId) {
    return (
      <div className="p-8 text-center text-zinc-500">
        Missing environment context.
      </div>
    );
  }

  if (mode === "edit" && stackDetail.isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-zinc-500">Loading stack details...</div>
      </div>
    );
  }

  return (
    <div className="pb-32 animate-in fade-in duration-500 mx-auto space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              <Layers className="h-6 w-6 text-pink-500" />
              {mode === "create" ? "Deploy Stack" : `Edit Stack`}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {mode === "create"
                ? "Compose editor and configs setup"
                : `Adjust configuration for ${stackName}`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main Editor Section */}
        <div className="space-y-6">
          <Card
            title="Stack Details"
            icon={<FileCode2 className="h-5 w-5 text-pink-500" />}
            compact
          >
            <Field label="Stack Name">
              <Input
                type="text"
                placeholder="e.g. backend-stack"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={mode === "edit"}
                className="font-mono text-sm max-w-md bg-zinc-50 dark:bg-zinc-900/50"
              />
            </Field>
          </Card>

          <div className="rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212] overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="px-6 pt-4 border-b border-zinc-100 dark:border-zinc-800 pb-0">
                <TabsTrigger value="compose" icon={Code} className="pb-3 px-4">
                  docker-compose.yml
                </TabsTrigger>
                <TabsTrigger value="env" icon={FileCode2} className="pb-3 px-4">
                  Environment
                </TabsTrigger>
                <TabsTrigger
                  value="assets"
                  icon={KeyRound}
                  className="pb-3 px-4"
                >
                  Secrets & Configs
                </TabsTrigger>
              </TabsList>

              <div className="p-6">
                <TabsContent value="compose" className="mt-0 outline-none">
                  <Field helper="Keep YAML readable here. Use registry presets on the right to inject image references fast.">
                    <textarea
                      className="min-h-[600px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-5 font-mono text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all leading-relaxed"
                      value={composeContent}
                      onChange={(e) => setComposeContent(e.target.value)}
                      spellCheck={false}
                    />
                  </Field>
                </TabsContent>

                <TabsContent value="env" className="mt-0 outline-none">
                  <Field helper="One key=value per line. These are supplied to the stack deploy command and tracked separately from compose content.">
                    <textarea
                      className="min-h-[600px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-5 font-mono text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all leading-relaxed"
                      value={environmentVars}
                      onChange={(e) => setEnvironmentVars(e.target.value)}
                      placeholder={"FOO=bar\nAPI_URL=https://example.com"}
                      spellCheck={false}
                    />
                  </Field>
                </TabsContent>

                <TabsContent value="assets" className="mt-0 outline-none">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <Field
                      label="Secrets"
                      helper="Saved beside the compose bundle and available during deploy."
                    >
                      <textarea
                        className="min-h-[500px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-5 font-mono text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all leading-relaxed"
                        value={secretEntries}
                        onChange={(e) => setSecretEntries(e.target.value)}
                        placeholder={
                          "db_password<<EOF\nsuper-secret-value\nEOF"
                        }
                        spellCheck={false}
                      />
                    </Field>
                    <Field
                      label="Configs"
                      helper="Use for config files or template snippets referenced by services."
                    >
                      <textarea
                        className="min-h-[500px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-5 font-mono text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all leading-relaxed"
                        value={configEntries}
                        onChange={(e) => setConfigEntries(e.target.value)}
                        placeholder={
                          "nginx_conf<<EOF\nserver { listen 80; }\nEOF"
                        }
                        spellCheck={false}
                      />
                    </Field>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Sidebar Sticky Area */}
        <div className="relative leading-relaxed">
          <div className="sticky top-6 space-y-6">
            {mode === "edit" ? (
              <Card
                title="Rollback Revision"
                icon={<RotateCcw className="h-5 w-5 text-blue-500" />}
                compact
              >
                <select
                  onChange={(e) => {
                    const revision = e.target.value;
                    if (!revision) return;
                    setRollbackCandidate(revision);
                    e.currentTarget.value = "";
                  }}
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/50 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                >
                  <option value="">Select past revision...</option>
                  {revisions.map((revision) => (
                    <option key={revision.id} value={revision.id}>
                      {new Date(revision.created_at).toLocaleString()}
                    </option>
                  ))}
                </select>
              </Card>
            ) : null}

            <Card
              title="Registry Presets"
              icon={<WandSparkles className="h-5 w-5 text-orange-500" />}
              compact
            >
              <div className="flex flex-wrap gap-2">
                {registries
                  .flatMap((registry) =>
                    (registry.pull_presets || []).map((preset) => ({
                      registry: registry.name,
                      preset,
                    })),
                  )
                  .map((item) => (
                    <button
                      key={`${item.registry}-${item.preset}`}
                      type="button"
                      onClick={() => insertPresetImage(item.preset)}
                      className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300 transition-colors shadow-sm"
                    >
                      {item.preset}
                    </button>
                  ))}
                {registries.length === 0 && (
                  <span className="text-sm text-zinc-500">
                    No registry presets available.
                  </span>
                )}
              </div>
            </Card>

            <Card
              title="Secret Assets"
              icon={<KeyRound className="h-5 w-5 text-emerald-500" />}
              compact
            >
              <div className="grid gap-3">
                <Input
                  placeholder="Asset Name"
                  value={secretName}
                  onChange={(e) => setSecretName(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-900/50 text-sm"
                />
                <textarea
                  className="min-h-[100px] w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  placeholder="Asset Content..."
                  spellCheck={false}
                />
                <Button
                  variant="outline"
                  className="w-full text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#121212] hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  onClick={() =>
                    saveSecret.mutate(
                      { name: secretName, value: secretValue },
                      {
                        onSuccess: (asset) => {
                          setSecretName("");
                          setSecretValue("");
                          showNotification({
                            type: "success",
                            message: "Secret saved",
                            description: asset.name,
                          });
                        },
                        onError: (error: any) =>
                          showNotification({
                            type: "error",
                            message: "Secret save failed",
                            description:
                              error?.message || "Unable to save secret asset.",
                          }),
                      },
                    )
                  }
                  disabled={saveSecret.isPending || !secretName.trim()}
                >
                  Save to Cluster
                </Button>
              </div>
              {secretAssets.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Available Assets
                  </p>
                  {secretAssets.map((asset) => (
                    <div
                      key={asset.name}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-[#121212] group hover:border-emerald-300 dark:hover:border-emerald-900/50 transition-colors"
                    >
                      <button
                        type="button"
                        className="font-medium text-left text-zinc-700 dark:text-zinc-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate max-w-[160px]"
                        onClick={() =>
                          insertSecretAsset(asset.name, asset.value)
                        }
                        title="Click to insert"
                      >
                        {asset.name}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-500 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"
                        onClick={() => deleteSecret.mutate(asset.name)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Summary / Save Card */}
            <div className="rounded-[24px] border border-zinc-200 bg-white p-6 shadow-xl shadow-pink-500/5 dark:border-zinc-800 dark:bg-[#121212]">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4">
                Deploy Summary
              </h3>
              <div className="space-y-2 text-sm mb-6">
                <div className="flex items-start justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Compose lines
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {composeLineCount}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Env entries
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {envCount}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    Secret blocks
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {secretCount}
                  </span>
                </div>
              </div>

              <Button
                variant="primary"
                className="w-full bg-pink-600 text-white hover:bg-pink-700 py-6 text-base shadow-md shadow-pink-500/20"
                onClick={handleSubmit}
                disabled={
                  deployStack.isPending ||
                  !name.trim() ||
                  !composeContent.trim()
                }
                isLoading={deployStack.isPending}
              >
                <Save className="mr-2 h-5 w-5" />
                {mode === "create" ? "Deploy Stack" : "Update Stack"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmActionDialog
        open={!!rollbackCandidate}
        title="Rollback stack revision?"
        description={`This restores ${name || stackName || "the stack"} to revision ${rollbackCandidate}. Running services may be recreated to match that snapshot.`}
        confirmLabel={
          rollbackStack.isPending ? "Rolling back..." : "Rollback Revision"
        }
        onClose={() => setRollbackCandidate("")}
        onConfirm={() => {
          if (!rollbackCandidate) {
            return;
          }
          rollbackStack.mutate(rollbackCandidate, {
            onSuccess: () => {
              showNotification({
                type: "success",
                message: "Rollback completed",
                description: `${name} rolled back to ${rollbackCandidate}.`,
              });
              setRollbackCandidate("");
            },
            onError: (error: any) =>
              showNotification({
                type: "error",
                message: "Rollback failed",
                description: error?.message || "Unable to rollback stack.",
              }),
          });
        }}
        pending={rollbackStack.isPending}
        tone="warning"
      />
    </div>
  );
}

function Card({
  title,
  subtitle,
  icon,
  children,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-md border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#121212]",
        compact ? "p-5" : "p-6 md:p-8",
      )}
    >
      <div
        className={cn(
          "flex items-start gap-4 border-b border-zinc-100 dark:border-zinc-800",
          compact ? "pb-4 mb-5" : "pb-6 mb-8",
        )}
      >
        {icon && (
          <div className="mt-1 p-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
            {icon}
          </div>
        )}
        <div className="flex justify-center">
          <h3
            className={cn(
              "font-bold text-zinc-900 dark:text-zinc-50 tracking-tight",
              compact ? "text-base" : "text-lg",
            )}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label?: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label ? (
        <label className="mb-2 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {label}
        </label>
      ) : null}
      {children}
      {helper ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
