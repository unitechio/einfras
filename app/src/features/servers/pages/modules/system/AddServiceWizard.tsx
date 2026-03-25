import {
  ArrowRight,
  CheckCircle2,
  Globe,
  HardDrive,
  Loader2,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useNotification } from "@/core/NotificationContext";
import { cn } from "@/lib/utils";
import { packagesApi, serversApi, servicesApi, terminalApi } from "@/shared/api/client";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

interface AddServiceWizardProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  onInstalled?: () => void | Promise<void>;
}

type InstallMode = "public" | "private" | "relay";
type Step = "mode" | "package" | "review" | "result";

type PackageCandidate = {
  name: string;
  description: string;
  source: "installed" | "repository";
};

export function AddServiceWizard({
  isOpen,
  onClose,
  serverId,
  onInstalled,
}: AddServiceWizardProps) {
  const { showNotification } = useNotification();
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<InstallMode | null>(null);
  const [serverOS, setServerOS] = useState("linux");
  const [query, setQuery] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("");
  const [packageResults, setPackageResults] = useState<PackageCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string>("");
  const [privateArtifact, setPrivateArtifact] = useState("");
  const [relayPackage, setRelayPackage] = useState("");
  const [relayHost, setRelayHost] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      window.setTimeout(() => {
        setStep("mode");
        setMode(null);
        setQuery("");
        setSelectedPackage("");
        setPackageResults([]);
        setResultMessage("");
        setPrivateArtifact("");
        setRelayPackage("");
        setRelayHost("");
      }, 200);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !serverId) return;
    void serversApi
      .get(serverId)
      .then((server) => setServerOS(server.os || "linux"))
      .catch(() => setServerOS("linux"));
  }, [isOpen, serverId]);

  useEffect(() => {
    let cancelled = false;
    if (!isOpen || step !== "package" || mode !== "public") return;

    const keyword = query.trim();
    if (keyword.length < 2) {
      setPackageResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const [installed, lookup] = await Promise.all([
          packagesApi.list(serverId).catch(() => ({ result: { data: [] as Array<{ name: string }> } })),
          terminalApi
            .exec(serverId, {
              command: `sh -lc "if command -v apt-cache >/dev/null 2>&1; then apt-cache search --names-only '${escapeSingleQuotes(keyword)}' | head -n 12; elif command -v dnf >/dev/null 2>&1; then dnf search '${escapeSingleQuotes(keyword)}' | head -n 12; elif command -v yum >/dev/null 2>&1; then yum search '${escapeSingleQuotes(keyword)}' | head -n 12; else true; fi"`,
              timeout_sec: 20,
            })
            .catch(() => ({ raw_output: "" })),
        ]);

        if (cancelled) return;

        const installedItems = Array.isArray(installed.result?.data)
          ? installed.result.data
              .filter((item) => String(item.name ?? "").toLowerCase().includes(keyword.toLowerCase()))
              .slice(0, 8)
              .map((item) => ({
                name: String(item.name),
                description: "Installed package on this node",
                source: "installed" as const,
              }))
          : [];

        const repoItems = parsePackageSearch(String(lookup.raw_output ?? ""));
        const merged = dedupePackages([...installedItems, ...repoItems]).slice(0, 12);
        setPackageResults(merged);
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, step, mode, query, serverId]);

  const canInstallPublic = mode === "public" && selectedPackage.trim().length > 0;
  const canContinueReview =
    (mode === "public" && canInstallPublic) ||
    (mode === "private" && privateArtifact.trim().length > 0) ||
    (mode === "relay" && relayPackage.trim().length > 0 && relayHost.trim().length > 0);
  const guidance = useMemo(() => {
    if (mode === "private") {
      return {
        title: "Private Upload",
        lines: [
          "Upload .deb, .rpm, or .tar.gz is planned for the next backend slice.",
          "Use Package Management for official repositories first, or copy artifacts to the node and install through Terminal as a temporary workaround.",
          "Recommended for air-gapped systems once upload API and checksum validation land.",
        ],
      };
    }
    if (mode === "relay") {
      return {
        title: "Relay / Bastion Install",
        lines: [
          "Relay-based service installation still needs a dedicated backend workflow.",
          "Current recommendation: onboard the bastion as a server node first, then run package install on the target through your approved jump flow.",
          "Security scanning and bastion proxy orchestration will be added when relay endpoints are ready.",
        ],
      };
    }
    return null;
  }, [mode]);

  const handlePublicInstall = async () => {
    if (!serverId || !selectedPackage.trim()) return;
    setInstalling(true);
    setStep("result");
    try {
      await packagesApi.action(serverId, {
        action: "install",
        package_name: selectedPackage.trim(),
      });
      setDiscoveryLoading(true);
      try {
        await servicesApi.discovery(serverId);
      } catch {
        // discovery can lag or be unsupported on some nodes; install still succeeded
      } finally {
        setDiscoveryLoading(false);
      }

      setResultMessage(
        `Package ${selectedPackage.trim()} was dispatched successfully. We also triggered service discovery so the Services list can refresh with any new system unit.`,
      );
      showNotification({
        type: "success",
        message: "Service install dispatched",
        description: `${selectedPackage.trim()} has been installed through the real package workflow.`,
      });
      await onInstalled?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";
      setResultMessage(message);
      showNotification({
        type: "error",
        message: "Unable to install service",
        description: message,
      });
    } finally {
      setInstalling(false);
    }
  };

  const handlePlanSave = async (planMode: "private" | "relay") => {
    if (!serverId) return;
    setSavingPlan(true);
    setStep("result");
    try {
      const plan = await servicesApi.createInstallPlan(serverId, {
        mode: planMode,
        artifact_name: planMode === "private" ? privateArtifact.trim() : undefined,
        package_name: planMode === "relay" ? relayPackage.trim() : undefined,
        relay_host: planMode === "relay" ? relayHost.trim() : undefined,
        notes:
          planMode === "private"
            ? "Plan captured from Add Service wizard for private artifact installation."
            : "Plan captured from Add Service wizard for relay/bastion installation.",
      });

      const summary =
        planMode === "private"
          ? `Private install plan saved for artifact "${privateArtifact.trim()}". Plan ID: ${plan.id}. Upload execution pipeline still needs the dedicated backend endpoint, but the intent is now persisted on the control plane.`
          : `Relay install plan saved for package "${relayPackage.trim()}" via "${relayHost.trim()}". Plan ID: ${plan.id}. Relay orchestration is not yet executable end-to-end, but the workflow is now tracked by the backend.`;

      setResultMessage(summary);
      showNotification({
        type: "success",
        message: planMode === "private" ? "Upload plan saved" : "Relay plan saved",
        description: `Plan ${plan.id} has been recorded on the backend.`,
      });
      await onInstalled?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save install plan.";
      setResultMessage(message);
      showNotification({
        type: "error",
        message: planMode === "private" ? "Unable to save upload plan" : "Unable to save relay plan",
        description: message,
      });
    } finally {
      setSavingPlan(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[680px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between border-b border-zinc-200/70 bg-zinc-50/80 px-6 py-5 dark:border-zinc-800/70 dark:bg-zinc-800/15">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Add New Service</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              {["mode", "package", "review", "result"].map((item) => (
                <span
                  key={item}
                  className={cn(
                    "rounded-full px-2 py-1",
                    step === item ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-zinc-100 dark:bg-zinc-800",
                  )}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          {!installing ? (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X size={18} />
            </Button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === "mode" ? (
            <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-3">
              <ModeCard
                icon={<Globe size={30} />}
                title="Public Registry"
                description="Install standard packages from official repositories like apt, yum, or dnf."
                accent="blue"
                onClick={() => {
                  setMode("public");
                  setStep("package");
                }}
              />
              <ModeCard
                icon={<HardDrive size={30} />}
                title="Private Upload"
                description="Upload .deb, .rpm, or .tar.gz packages for air-gapped environments."
                accent="purple"
                onClick={() => {
                  setMode("private");
                  setStep("review");
                }}
              />
              <ModeCard
                icon={<Network size={30} />}
                title="Relay Server"
                description="Proxy installation through a bastion or relay path with extra controls."
                accent="amber"
                onClick={() => {
                  setMode("relay");
                  setStep("review");
                }}
              />
            </div>
          ) : null}

          {step === "package" && mode === "public" ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-blue-200/60 bg-blue-50/70 p-4 text-sm text-blue-800 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-300">
                <div className="font-semibold">Newbie guide</div>
                <div className="mt-1">
                  Search a package name like <span className="font-mono">nginx</span>, <span className="font-mono">redis</span>, or <span className="font-mono">docker.io</span>. When install finishes, EINFRA will trigger service discovery so newly created system services can appear in the list.
                </div>
              </div>

              <div className="relative max-w-2xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <Input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedPackage(event.target.value);
                  }}
                  placeholder="Search package from repository or installed inventory..."
                  className="pl-10"
                />
              </div>

              <div className="rounded-2xl border border-zinc-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <Sparkles size={12} />
                  Suggestions
                  {searching ? <Loader2 size={12} className="animate-spin" /> : null}
                </div>
                {packageResults.length === 0 ? (
                  <div className="text-sm text-zinc-500">
                    {query.trim().length < 2
                      ? "Type at least 2 characters to search the package repository."
                      : "No matching package suggestions were returned. You can still install manually by package name."}
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {packageResults.map((pkg) => (
                      <button
                        key={`${pkg.source}:${pkg.name}`}
                        type="button"
                        onClick={() => setSelectedPackage(pkg.name)}
                        className={cn(
                          "rounded-xl border p-4 text-left transition",
                          selectedPackage === pkg.name
                            ? "border-blue-400 bg-blue-50 dark:border-blue-500/60 dark:bg-blue-900/15"
                            : "border-zinc-200/60 hover:border-blue-300 dark:border-zinc-800/60 dark:hover:border-blue-500/40",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{pkg.name}</div>
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {pkg.source}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{pkg.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_260px]">
                <div className="rounded-2xl border border-zinc-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
                  <div className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Selected package</div>
                  <Input value={selectedPackage} onChange={(event) => setSelectedPackage(event.target.value)} placeholder="Package name to install" />
                  <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    Node OS detected: <span className="font-semibold">{serverOS}</span>. Official repository install is the supported production path right now.
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200/60 bg-zinc-50/80 p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-950/40">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    What happens next
                  </div>
                  <ul className="space-y-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <li>1. Install package through agent typed package operation.</li>
                    <li>2. Trigger service discovery.</li>
                    <li>3. Refresh service list so the new unit appears when available.</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          {step === "review" ? (
            <div className="space-y-6">
              {mode === "public" ? (
                <>
                  <div className="rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
                    <div className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                      <Terminal size={18} className="text-blue-500" />
                      Ready to install
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-300">
                      Package <span className="font-mono font-semibold">{selectedPackage || "(not selected)"}</span> will be installed on this node using the backend package action. Once installation finishes, EINFRA will run service discovery so the Services list can refresh.
                    </div>
                  </div>
                </>
              ) : guidance ? (
                <div className="rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-[#121212]">
                  <div className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                    {mode === "private" ? <Upload size={18} className="text-purple-500" /> : <Network size={18} className="text-amber-500" />}
                    {guidance.title}
                  </div>
                  <div className="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                    {guidance.lines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                  {mode === "private" ? (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          Artifact name
                        </div>
                        <Input
                          value={privateArtifact}
                          onChange={(event) => setPrivateArtifact(event.target.value)}
                          placeholder="nginx_1.24.0_amd64.deb"
                        />
                      </div>
                      <div className="rounded-xl border border-dashed border-purple-200/60 bg-purple-50/60 p-4 text-xs text-purple-700 dark:border-purple-800/50 dark:bg-purple-900/10 dark:text-purple-300">
                        Upload API is not live yet. This step now captures the install intent clearly so the UI no longer looks like it completed a real upload.
                      </div>
                    </div>
                  ) : null}
                  {mode === "relay" ? (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          Relay / bastion host
                        </div>
                        <Input
                          value={relayHost}
                          onChange={(event) => setRelayHost(event.target.value)}
                          placeholder="bastion.internal"
                        />
                      </div>
                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                          Package to install
                        </div>
                        <Input
                          value={relayPackage}
                          onChange={(event) => setRelayPackage(event.target.value)}
                          placeholder="nginx"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {step === "result" ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              {installing ? (
                <>
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                    <Loader2 size={34} className="animate-spin" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Installing service package</div>
                  <div className="mt-3 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
                    We are dispatching the package install command and syncing service discovery. This can take a little longer on fresh nodes.
                  </div>
                </>
              ) : savingPlan ? (
                <>
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300">
                    <Loader2 size={34} className="animate-spin" />
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Saving installation plan</div>
                  <div className="mt-3 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
                    We are recording this private or relay workflow on the control plane so the install intent is traceable instead of only living in the browser.
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                    <CheckCircle2 size={34} />
                  </div>
                  <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Workflow completed</div>
                  <div className="mt-3 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">{resultMessage}</div>
                  {discoveryLoading ? (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                      <Loader2 size={12} className="animate-spin" />
                      Running service discovery...
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>

        {step !== "result" ? (
          <div className="flex items-center justify-between border-t border-zinc-200/70 bg-zinc-50/80 px-6 py-4 dark:border-zinc-800/70 dark:bg-zinc-800/15">
            <Button
              variant="ghost"
              onClick={() => {
                if (step === "package") setStep("mode");
                if (step === "review") setStep(mode === "public" ? "package" : "mode");
              }}
            >
              Back
            </Button>
            <Button
              variant="primary"
              disabled={((step === "package" || step === "review") && !canContinueReview) || installing || savingPlan}
              onClick={() => {
                if (step === "package") setStep("review");
                else if (step === "review" && mode === "public") {
                  void handlePublicInstall();
                } else if (step === "review" && mode === "private") {
                  void handlePlanSave("private");
                } else if (step === "review" && mode === "relay") {
                  void handlePlanSave("relay");
                } else if (step === "review") {
                  onClose();
                }
              }}
            >
              {step === "review" ? (
                mode === "public" ? (
                  <>
                    Install package <ArrowRight size={16} className="ml-2" />
                  </>
                ) : mode === "private" ? (
                  <>
                    Save Upload Plan <ArrowRight size={16} className="ml-2" />
                  </>
                ) : mode === "relay" ? (
                  <>
                    Save Relay Plan <ArrowRight size={16} className="ml-2" />
                  </>
                ) : (
                  "Close guide"
                )
              ) : (
                <>
                  Continue <ArrowRight size={16} className="ml-2" />
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end border-t border-zinc-200/70 bg-zinc-50/80 px-6 py-4 dark:border-zinc-800/70 dark:bg-zinc-800/15">
            <Button variant="primary" onClick={onClose} disabled={installing || savingPlan}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ModeCard({
  icon,
  title,
  description,
  accent,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  accent: "blue" | "purple" | "amber";
  onClick: () => void;
}) {
  const accentClasses =
    accent === "blue"
      ? "hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10"
      : accent === "purple"
        ? "hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10"
        : "hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border-2 border-zinc-200 p-8 text-center transition-all dark:border-zinc-800",
        accentClasses,
      )}
    >
      <div className="mb-4 rounded-full bg-zinc-100 p-4 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{icon}</div>
      <div className="text-lg font-bold text-zinc-900 dark:text-white">{title}</div>
      <div className="mt-2 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">{description}</div>
    </button>
  );
}

function parsePackageSearch(output: string): PackageCandidate[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split(/\s+-\s+/);
      const normalizedName = (name ?? "").split(/\s+/)[0] ?? "";
      return {
        name: normalizedName,
        description: rest.join(" - ") || "Repository package",
        source: "repository" as const,
      };
    })
    .filter((item) => item.name.length > 0 && !item.name.startsWith("Listing") && !item.name.startsWith("Installed"));
}

function dedupePackages(items: PackageCandidate[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });
}

function escapeSingleQuotes(value: string) {
  return value.replace(/'/g, `'\"'\"'`);
}
