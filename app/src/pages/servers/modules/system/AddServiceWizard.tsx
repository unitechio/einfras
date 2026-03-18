import {
  X,
  Globe,
  HardDrive,
  Network,
  Search,
  ArrowRight,
  Download,
  Upload,
  FileCode,
  CheckCircle2,
  Terminal,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  Disc,
  Radio,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  mockServerService,
  InstallMode,
  ServicePackage,
  ServiceTemplate,
  DryRunResult,
  InstallLog,
} from "../shared/mockServerService";
import { cn } from "@/lib/utils";

interface AddServiceWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = "mode" | "package" | "config" | "review" | "install";

export function AddServiceWizard({ isOpen, onClose }: AddServiceWizardProps) {
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<InstallMode | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ServicePackage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [template, setTemplate] = useState<ServiceTemplate | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [installLogs, setInstallLogs] = useState<InstallLog[]>([]);
  const [installStatus, setInstallStatus] = useState<
    "idle" | "installing" | "completed"
  >("idle");

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep("mode");
        setMode(null);
        setSelectedPackage(null);
        setTemplate(null);
        setConfig({});
        setDryRun(null);
        setInstallLogs([]);
        setInstallStatus("idle");
      }, 300);
    }
  }, [isOpen]);

  // Search packages
  useEffect(() => {
    if (step === "package" && mode === "public") {
      const delay = setTimeout(async () => {
        setIsSearching(true);
        const results = await mockServerService.searchPackages(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
      }, 500);
      return () => clearTimeout(delay);
    }
  }, [searchQuery, step, mode]);

  // Fetch template when package selected
  useEffect(() => {
    if (selectedPackage) {
      mockServerService.getTemplate(selectedPackage.name).then((t) => {
        setTemplate(t);
        // Set defaults
        const defaults: Record<string, any> = {};
        t.configFields.forEach((f) => {
          if (f.defaultValue !== undefined) defaults[f.key] = f.defaultValue;
        });
        setConfig(defaults);
      });
    }
  }, [selectedPackage]);

  const handleRunDryRun = async () => {
    if (!selectedPackage || !template) return;
    setStep("review");
    const result = await mockServerService.simulateDryRun(
      selectedPackage,
      config,
    );
    setDryRun(result);
  };

  const handleInstall = async () => {
    if (!selectedPackage) return;
    setStep("install");
    setInstallStatus("installing");

    await mockServerService.installService(selectedPackage, config, (log) => {
      setInstallLogs((prev) => [...prev, log]);
    });

    setInstallStatus("completed");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col h-[600px] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
              Add New Service
            </h2>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
              <span
                className={cn(
                  "flex items-center gap-1",
                  step === "mode" && "text-blue-600 font-bold",
                )}
              >
                1. Mode
              </span>
              <ArrowRight size={10} />
              <span
                className={cn(
                  "flex items-center gap-1",
                  step === "package" && "text-blue-600 font-bold",
                )}
              >
                2. Package
              </span>
              <ArrowRight size={10} />
              <span
                className={cn(
                  "flex items-center gap-1",
                  step === "config" && "text-blue-600 font-bold",
                )}
              >
                3. Configure
              </span>
              <ArrowRight size={10} />
              <span
                className={cn(
                  "flex items-center gap-1",
                  step === "review" && "text-blue-600 font-bold",
                )}
              >
                4. Review
              </span>
              <ArrowRight size={10} />
              <span
                className={cn(
                  "flex items-center gap-1",
                  step === "install" && "text-blue-600 font-bold",
                )}
              >
                5. Install
              </span>
            </div>
          </div>
          {installStatus !== "installing" && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
            >
              <X size={20} className="text-zinc-500" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {step === "mode" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
              <button
                onClick={() => {
                  setMode("public");
                  setStep("package");
                }}
                className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group text-center"
              >
                <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform">
                  <Globe size={32} />
                </div>
                <h3 className="font-bold text-lg mb-2">Public Registry</h3>
                <p className="text-sm text-zinc-500">
                  Install standard packages from official repositories
                  (Official, apt, yum).
                </p>
              </button>
              <button
                onClick={() => {
                  setMode("private");
                  setStep("package");
                }}
                className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all group text-center"
              >
                <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400 mb-4 group-hover:scale-110 transition-transform">
                  <HardDrive size={32} />
                </div>
                <h3 className="font-bold text-lg mb-2">Private Upload</h3>
                <p className="text-sm text-zinc-500">
                  Upload .deb, .rpm, or .tar.gz files directly for air-gapped
                  systems.
                </p>
              </button>
              <button
                onClick={() => {
                  setMode("relay");
                  setStep("package");
                }}
                className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-zinc-200 dark:border-zinc-800 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all group text-center"
              >
                <div className="p-4 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 dark:text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                  <Network size={32} />
                </div>
                <h3 className="font-bold text-lg mb-2">Relay Server</h3>
                <p className="text-sm text-zinc-500">
                  Proxy installation through a bastion server with security
                  scanning.
                </p>
              </button>
            </div>
          )}

          {step === "package" && (
            <div className="space-y-6">
              {mode === "public" || mode === "relay" ? (
                <>
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                      size={20}
                    />
                    <input
                      type="text"
                      placeholder="Search packages (e.g., nginx, redis, docker)..."
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 focus:ring-2 focus:ring-blue-500 outline-none text-zinc-900 dark:text-white"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    {isSearching ? (
                      <div className="text-center py-8 text-zinc-500">
                        Searching repositories...
                      </div>
                    ) : (
                      searchResults.map((pkg) => (
                        <div
                          key={pkg.name}
                          onClick={() => {
                            setSelectedPackage(pkg);
                            setStep("config");
                          }}
                          className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-white dark:hover:bg-zinc-800 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                              <Globe size={20} />
                            </div>
                            <div>
                              <h4 className="font-bold text-zinc-900 dark:text-white">
                                {pkg.name}
                              </h4>
                              <p className="text-sm text-zinc-500">
                                {pkg.description}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-600 dark:text-zinc-400">
                              {pkg.version}
                            </span>
                            <div className="text-xs text-zinc-400 mt-1">
                              {pkg.size}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    {!isSearching &&
                      searchResults.length === 0 &&
                      searchQuery && (
                        <div className="text-center py-8 text-zinc-500">
                          No packages found for "{searchQuery}"
                        </div>
                      )}
                  </div>
                </>
              ) : (
                <div
                  className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl h-64 flex flex-col items-center justify-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  onClick={() => {
                    // Simulate upload
                    setSelectedPackage({
                      name: "custom-app",
                      version: "1.0.0",
                      description: "Uploaded Package",
                      repo: "local",
                      size: "50 MB",
                    });
                    setStep("config");
                  }}
                >
                  <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500">
                    <Upload size={32} />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-zinc-900 dark:text-white">
                      Click to Upload Package
                    </h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      Supports .deb, .rpm, .apk, .tar.gz
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "config" && template && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30">
                <div className="w-12 h-12 rounded-lg bg-white dark:bg-zinc-900 shadow-sm flex items-center justify-center text-blue-600">
                  <FileCode size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white">
                    Configure {template.name}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {template.description}
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                {template.configFields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {field.label}{" "}
                      {field.required && (
                        <span className="text-red-500">*</span>
                      )}
                    </label>
                    {field.type === "boolean" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={config[field.key] || false}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              [field.key]: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded border-zinc-300"
                        />
                        <span className="text-sm text-zinc-500">Enable</span>
                      </div>
                    ) : (
                      <input
                        type={field.type}
                        value={config[field.key] || ""}
                        onChange={(e) =>
                          setConfig({ ...config, [field.key]: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "review" && dryRun && selectedPackage && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500 uppercase font-bold mb-2 flex items-center gap-2">
                    <Disc size={14} /> Disk Usage
                  </div>
                  <div className="text-lg font-bold">{dryRun.diskUsage}</div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500 uppercase font-bold mb-2 flex items-center gap-2">
                    <Network size={14} /> Ports
                  </div>
                  <div className="text-lg font-bold">
                    {dryRun.newPorts.length > 0
                      ? dryRun.newPorts.join(", ")
                      : "None"}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500 uppercase font-bold mb-2 flex items-center gap-2">
                    <Cpu size={14} /> Dependencies
                  </div>
                  <div className="text-lg font-bold">
                    {dryRun.dependencies.length}
                  </div>
                </div>
              </div>

              <div className="bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800">
                <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center gap-2">
                  <Terminal size={14} className="text-zinc-400" />
                  <span className="text-xs font-mono text-zinc-400">
                    Dry Run Preview
                  </span>
                </div>
                <div className="p-4 font-mono text-sm text-zinc-300 space-y-1">
                  {dryRun.commands.map((cmd, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-blue-500 select-none">$</span>
                      <span>{cmd}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 text-sm">
                <ShieldCheck size={20} className="shrink-0" />
                <div>
                  <span className="font-bold">Security Verification:</span>{" "}
                  Package signature verified. Installing this service will
                  register it with systemd.
                </div>
              </div>
            </div>
          )}

          {step === "install" && (
            <div className="h-full flex flex-col">
              {installStatus === "completed" ? (
                <div className="flex flex-col items-center justify-center flex-1 text-center animate-in zoom-in duration-300">
                  <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center mb-6">
                    <CheckCircle2 size={40} />
                  </div>
                  <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                    Installation Complete
                  </h3>
                  <p className="text-zinc-500 max-w-sm mb-8">
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {selectedPackage?.name}
                    </span>{" "}
                    has been successfully installed and started.
                  </p>
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 transition-opacity font-medium"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="mb-6 space-y-2">
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span>Installing {selectedPackage?.name}...</span>
                      <span>
                        {Math.min(
                          100,
                          Math.round((installLogs.length / 7) * 100),
                        )}
                        %
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300 ease-out"
                        style={{
                          width: `${Math.min(100, (installLogs.length / 7) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex-1 bg-zinc-950 rounded-xl p-4 overflow-y-auto font-mono text-sm border border-zinc-800">
                    {installLogs.map((log, i) => (
                      <div
                        key={i}
                        className="flex gap-3 mb-2 animate-in slide-in-from-left-2 duration-200"
                      >
                        <span
                          className={cn(
                            "uppercase text-xs font-bold w-20 shrink-0 pt-0.5",
                            log.status === "completed"
                              ? "text-green-500"
                              : log.status === "failed"
                                ? "text-red-500"
                                : "text-blue-500",
                          )}
                        >
                          {log.step}
                        </span>
                        <span className="text-zinc-300">{log.detail}</span>
                      </div>
                    ))}
                    {installStatus === "installing" && (
                      <div className="flex gap-3 animate-pulse">
                        <span className="uppercase text-xs font-bold w-20 shrink-0 text-zinc-600">
                          ...
                        </span>
                        <span className="text-zinc-500">Processing...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {step !== "install" && (
          <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex justify-between">
            {step !== "mode" ? (
              <button
                onClick={() => {
                  if (step === "package") setStep("mode");
                  else if (step === "config") setStep("package");
                  else if (step === "review") setStep("config");
                }}
                className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors font-medium"
              >
                Back
              </button>
            ) : (
              <div></div>
            )}

            <button
              disabled={
                (step === "mode" && !mode) ||
                (step === "package" && !selectedPackage) ||
                (step === "config" && false) // Always valid for now
              }
              onClick={() => {
                if (step === "config") handleRunDryRun();
                else if (step === "review") handleInstall();
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
            >
              {step === "review" ? (
                <>
                  Install Service <Download size={16} />
                </>
              ) : (
                <>
                  Next Step <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
