import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Server,
  Shield,
  ArrowLeft,
  CheckCircle2,
  Network,
  Lock,
  Globe,
  Terminal,
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Container,
  Box,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Wifi,
  Download,
  Zap,
  ClipboardCheck,
  CircleDot,
  Play,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { cn } from "@/lib/utils";
import {
  mockOnboardingService,
  type OnboardingSession,
  type OnboardingConfig,
  type OnboardingStep,
  type OnboardingLogEntry,
  type OnboardingStepId,
} from "./modules/shared/mockOnboardingService";
import CredentialVaultHandler from "./components/CredentialVaultHandler";
import PrivilegeSettings from "./components/PrivilegeSettings";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = "basic" | "connection" | "auth" | "privilege" | "onboarding";

const WIZARD_STEPS: { id: WizardStep; label: string; icon: any }[] = [
  { id: "basic", label: "Node Info", icon: Globe },
  { id: "connection", label: "Connection", icon: Network },
  { id: "auth", label: "Auth", icon: Lock },
  { id: "privilege", label: "Privilege", icon: Shield },
  { id: "onboarding", label: "Onboarding", icon: Zap },
];

// ─── Step status icons / colors ───────────────────────────────────────────────

function StepStatusIcon({ status }: { status: OnboardingStep["status"] }) {
  if (status === "running") {
    return (
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-40" />
        <CircleDot className="h-4 w-4 text-blue-500 relative z-10" />
      </span>
    );
  }
  if (status === "success")
    return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === "error")
    return <AlertTriangle className="h-5 w-5 text-red-500" />;
  return (
    <div className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-[5px]" />
  );
}

function logColor(level: OnboardingLogEntry["level"]) {
  switch (level) {
    case "success":
      return "text-emerald-400";
    case "error":
      return "text-red-400";
    case "warn":
      return "text-amber-400";
    case "cmd":
      return "text-sky-300";
    default:
      return "text-zinc-600 dark:text-zinc-400";
  }
}

function logPrefix(level: OnboardingLogEntry["level"]) {
  switch (level) {
    case "success":
      return "✓";
    case "error":
      return "✗";
    case "warn":
      return "⚠";
    case "cmd":
      return "$";
    default:
      return "›";
  }
}

// ─── Terminal Log Panel ───────────────────────────────────────────────────────

function TerminalPanel({ logs }: { logs: OnboardingLogEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="relative flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-900/80 rounded-t-xl">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
        </div>
        <span className="text-[11px] font-mono text-zinc-500 ml-2">
          einfra — onboarding log
        </span>
        <div className="ml-auto flex items-center gap-1.5 text-zinc-500">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono">LIVE</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 font-mono text-[12px] leading-relaxed space-y-1 bg-zinc-50 dark:bg-zinc-950 rounded-b-xl">
        {logs.length === 0 && (
          <span className="text-zinc-600">
            Waiting for onboarding to start...
          </span>
        )}
        {logs.map((entry, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 group hover:bg-zinc-900/50 -mx-2 px-2 py-0.5 rounded"
          >
            <span className="text-zinc-700 shrink-0 tabular-nums w-20 pt-px text-[10px]">
              {new Date(entry.ts).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <span
              className={cn("shrink-0 font-bold pt-px", logColor(entry.level))}
            >
              {logPrefix(entry.level)}
            </span>
            <span
              className={cn("break-all leading-relaxed", logColor(entry.level))}
            >
              {entry.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ─── Onboarding Progress Steps ────────────────────────────────────────────────

function OnboardingProgressPanel({
  session,
  onRetry,
}: {
  session: OnboardingSession;
  onRetry: (fromStep: OnboardingStepId) => void;
}) {
  const stepIcons: Record<OnboardingStepId, any> = {
    connection_test: Wifi,
    agent_install: Download,
    verify: ClipboardCheck,
    sync_resources: RefreshCw,
    complete: CheckCircle2,
  };

  const failedStep = session.steps.find((s) => s.status === "error");

  return (
    <div className="space-y-3">
      {session.steps.map((step, i) => {
        const Icon = stepIcons[step.id] ?? Activity;
        const isActive = step.status === "running";
        const isDone = step.status === "success";
        const isFailed = step.status === "error";

        return (
          <div
            key={step.id}
            className={cn(
              "relative flex items-center gap-4 p-4 rounded-xl border transition-all duration-300",
              isActive &&
                "bg-blue-50/50 dark:bg-blue-500/5 border-blue-200/60 dark:border-blue-500/20",
              isDone &&
                "bg-emerald-50/30 dark:bg-emerald-500/5 border-emerald-200/60 dark:border-emerald-500/20",
              isFailed &&
                "bg-red-50/50 dark:bg-red-500/5 border-red-200/60 dark:border-red-500/20",
              !isActive &&
                !isDone &&
                !isFailed &&
                "bg-zinc-50/30 dark:bg-zinc-900/30 border-zinc-200/40 dark:border-zinc-800/40",
            )}
          >
            {/* Step number connector */}
            {i < session.steps.length - 1 && (
              <div
                className={cn(
                  "absolute left-[30px] top-full h-3 w-px",
                  isDone
                    ? "bg-emerald-300 dark:bg-emerald-800"
                    : "bg-zinc-200 dark:bg-zinc-800",
                )}
              />
            )}

            {/* Icon */}
            <div
              className={cn(
                "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border",
                isActive &&
                  "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400",
                isDone &&
                  "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
                isFailed &&
                  "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400",
                !isActive &&
                  !isDone &&
                  !isFailed &&
                  "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400",
              )}
            >
              <Icon size={16} className={isActive ? "animate-pulse" : ""} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "font-semibold text-[13px] tracking-tight",
                  isActive && "text-blue-800 dark:text-blue-300",
                  isDone && "text-emerald-800 dark:text-emerald-300",
                  isFailed && "text-red-800 dark:text-red-300",
                  !isActive &&
                    !isDone &&
                    !isFailed &&
                    "text-zinc-500 dark:text-zinc-500",
                )}
              >
                {step.label}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                {step.description}
              </p>
              {isFailed && step.errorMessage && (
                <p className="text-[11px] text-red-500 mt-1 font-medium">
                  {step.errorMessage}
                </p>
              )}
              {isDone && step.startedAt && step.completedAt && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-0.5 font-mono">
                  {((step.completedAt - step.startedAt) / 1000).toFixed(1)}s
                </p>
              )}
            </div>

            {/* Status indicator */}
            <div className="shrink-0">
              <StepStatusIcon status={step.status} />
            </div>
          </div>
        );
      })}

      {/* Retry button */}
      {failedStep && (
        <div className="pt-2">
          <Button
            variant="danger"
            size="sm"
            onClick={() => onRetry(failedStep.id)}
            className="w-full gap-2"
          >
            <RotateCcw size={14} />
            Retry from "{failedStep.label}"
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── System Info Card ─────────────────────────────────────────────────────────

function SystemInfoCard({ session }: { session: OnboardingSession }) {
  const info = session.sysInfo;
  if (!info) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5">
      {/* Success Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-zinc-900 dark:text-white shadow-xl">
        <div className="absolute -top-6 -right-6 w-36 h-36 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <CheckCircle2 className="text-zinc-900 dark:text-white" size={20} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-emerald-100 opacity-80">
                Node Registered
              </p>
              <h3 className="text-xl font-bold tracking-tight">
                {session.serverName}
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[session.serverIp, info.os, info.arch].map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Hardware grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            icon: Cpu,
            label: "vCPU",
            value: `${info.cpuCores} cores`,
            sub: info.cpu.split("@")[0].trim(),
            color: "text-blue-500",
            bg: "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20",
          },
          {
            icon: MemoryStick,
            label: "Memory",
            value: `${info.ramGb} GB`,
            sub: "RAM",
            color: "text-purple-500",
            bg: "bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20",
          },
          {
            icon: HardDrive,
            label: "Storage",
            value: `${info.diskGb} GB`,
            sub: "Primary disk",
            color: "text-orange-500",
            bg: "bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20",
          },
        ].map((item) => (
          <div
            key={item.label}
            className={cn("rounded-xl border p-4", item.bg)}
          >
            <item.icon className={cn("mb-2", item.color)} size={18} />
            <p className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {item.value}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mt-0.5">
              {item.label}
            </p>
            <p className="text-[10px] text-zinc-500 mt-1 leading-snug truncate">
              {item.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Runtime detection */}
      <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-[#121212] divide-y divide-zinc-200/60 dark:divide-zinc-800/60 overflow-hidden">
        <div className="px-5 py-3 bg-zinc-50/50 dark:bg-zinc-800/20">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Detected Runtimes
          </p>
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center border",
                info.hasDocker
                  ? "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-500"
                  : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400",
              )}
            >
              <Container size={16} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                Docker
              </p>
              <p className="text-[11px] text-zinc-500">
                {info.dockerVersion ?? "Not detected"}
              </p>
            </div>
          </div>
          {info.hasDocker ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
              Active
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-zinc-50 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700">
              Not Found
            </span>
          )}
        </div>
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center border",
                info.hasKubernetes
                  ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20 text-indigo-500"
                  : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400",
              )}
            >
              <Box size={16} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                Kubernetes
              </p>
              <p className="text-[11px] text-zinc-500">
                {info.k8sVersion ?? "Not detected"}
              </p>
            </div>
          </div>
          {info.hasKubernetes ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
              Active
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-zinc-50 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700">
              Not Found
            </span>
          )}
        </div>
      </div>

      {/* Agent info */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30">
        <div className="flex items-center gap-3">
          <Activity size={16} className="text-zinc-600 dark:text-zinc-400" />
          <div>
            <p className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-300">
              EINFRA Agent
            </p>
            <p className="text-[11px] text-zinc-500">v{info.agentVersion}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            Reporting
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ServerOnboardingPage() {
  const navigate = useNavigate();

  // ── Wizard state ───────────────────────────────────────────────────────────
  const [wizardStep, setWizardStep] = useState<WizardStep>("basic");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    tags: "",
    os: "linux" as "linux" | "windows",
    mode: "agent" as "agent" | "direct" | "bastion",
    ip: "",
    port: "22",
    bastionHost: "",
    authMethod: "ssh_key" as
      | "ssh_key"
      | "password"
      | "agent_token"
      | "winrm"
      | "ad",
    credential: { method: "manual", value: "" },
    privilege: { user: "root", escalation: "sudo" },
  });

  const updateField = (field: string, value: any) =>
    setFormData((p) => ({ ...p, [field]: value }));

  // ── Onboarding state ───────────────────────────────────────────────────────
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  const currentWizardIndex = WIZARD_STEPS.findIndex((s) => s.id === wizardStep);

  const handleNext = () => {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === wizardStep);
    if (idx < WIZARD_STEPS.length - 1) {
      setWizardStep(WIZARD_STEPS[idx + 1].id);
    }
  };

  const handleBack = () => {
    if (wizardStep === "onboarding") return; // Can't go back while/after onboarding
    const idx = WIZARD_STEPS.findIndex((s) => s.id === wizardStep);
    if (idx > 0) setWizardStep(WIZARD_STEPS[idx - 1].id);
  };

  // ── Start onboarding ───────────────────────────────────────────────────────
  const startOnboarding = useCallback(async () => {
    const config: OnboardingConfig = {
      serverName: formData.name || "new-server",
      ip: formData.ip || "192.168.1.100",
      port: formData.port,
      os: formData.os,
      mode: formData.mode,
      authMethod: formData.authMethod,
      bastionHost: formData.bastionHost,
      sshUser: formData.privilege.user,
    };

    const newSession = mockOnboardingService.createSession(config);
    sessionIdRef.current = newSession.id;
    setSession(newSession);
    setIsRunning(true);

    try {
      await mockOnboardingService.startOnboarding(newSession.id, (updated) => {
        setSession({ ...updated });
      });
    } finally {
      setIsRunning(false);
    }
  }, [formData]);

  const handleLaunch = () => {
    setWizardStep("onboarding");
    // Small delay so the step renders before starting
    setTimeout(startOnboarding, 300);
  };

  const handleRetry = useCallback(async (fromStep: OnboardingStepId) => {
    if (!sessionIdRef.current) return;
    setIsRunning(true);
    try {
      await mockOnboardingService.retryFromStep(
        sessionIdRef.current,
        fromStep,
        (updated) => setSession({ ...updated }),
      );
    } finally {
      setIsRunning(false);
    }
  }, []);

  const isOnboarding = wizardStep === "onboarding";
  const isComplete = session?.overallStatus === "ACTIVE";
  const isFailed = session?.overallStatus === "FAILED";

  // ─────────────────────────────────────────────────────────────────────────
  // Render form steps
  // ─────────────────────────────────────────────────────────────────────────

  const renderFormStep = () => {
    switch (wizardStep) {
      case "basic":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-400">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Node Information
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                Provide the basic identifier details for your infrastructure
                node.
              </p>
            </div>
            <div className="space-y-6 max-w-xl">
              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="e.g. prod-db-primary"
                  icon={<Server className="w-4 h-4" />}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Operating System
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      id: "linux",
                      label: "Linux",
                      icon: <Terminal className="w-5 h-5" />,
                      sub: "Ubuntu · Debian · RHEL",
                    },
                    {
                      id: "windows",
                      label: "Windows",
                      icon: <Server className="w-5 h-5" />,
                      sub: "Server 2019/2022",
                    },
                  ].map((os) => (
                    <button
                      key={os.id}
                      onClick={() => {
                        updateField("os", os.id);
                        updateField("port", os.id === "linux" ? "22" : "5985");
                        updateField(
                          "authMethod",
                          os.id === "linux" ? "ssh_key" : "agent_token",
                        );
                      }}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                        formData.os === os.id
                          ? "border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-800/40"
                          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#121212]",
                      )}
                    >
                      <div
                        className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center border",
                          formData.os === os.id
                            ? "bg-white dark:bg-zinc-900 dark:bg-white text-zinc-900 dark:text-white dark:text-zinc-900 border-transparent"
                            : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500",
                        )}
                      >
                        {os.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                          {os.label}
                        </p>
                        <p className="text-[11px] text-zinc-500">{os.sub}</p>
                      </div>
                      {formData.os === os.id && (
                        <CheckCircle2
                          className="ml-auto text-zinc-900 dark:text-white"
                          size={16}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-[13px] text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none placeholder:text-zinc-600 dark:text-zinc-400"
                  placeholder="Briefly describe the server's purpose..."
                />
              </div>
            </div>
          </div>
        );

      case "connection":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-400">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Connection Routing
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                Configure how EINFRA orchestrator communicates with this node.
              </p>
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 block">
                  Routing Strategy
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl">
                  {[
                    {
                      id: "agent",
                      label: "EINFRA Agent",
                      desc: "Outbound only. Best for NAT/Firewalled servers.",
                      icon: Activity,
                      badge: "Recommended",
                    },
                    {
                      id: "direct",
                      label: "Direct SSH",
                      desc: "TCP connection on port 22. Requires whitelist.",
                      icon: Network,
                    },
                    {
                      id: "bastion",
                      label: "Bastion Host",
                      desc: "Jump through a secure gateway.",
                      icon: Shield,
                    },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => updateField("mode", mode.id)}
                      className={cn(
                        "relative p-5 rounded-xl border-2 text-left transition-all",
                        formData.mode === mode.id
                          ? "border-zinc-900 dark:border-white bg-zinc-50/50 dark:bg-zinc-800/20"
                          : "border-zinc-200/60 dark:border-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#121212]",
                      )}
                    >
                      {mode.badge && (
                        <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                          {mode.badge}
                        </span>
                      )}
                      <div
                        className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center border mb-3",
                          formData.mode === mode.id
                            ? "bg-white dark:bg-zinc-900 dark:bg-white text-zinc-900 dark:text-white dark:text-zinc-900 border-transparent"
                            : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500",
                        )}
                      >
                        <mode.icon size={18} />
                      </div>
                      <p className="font-semibold text-[13px] text-zinc-900 dark:text-zinc-100">
                        {mode.label}
                      </p>
                      <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed">
                        {mode.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-5 border-t border-zinc-200/60 dark:border-zinc-800/60 max-w-xl">
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                    IP Address / FQDN <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.ip}
                    onChange={(e) => updateField("ip", e.target.value)}
                    placeholder="10.0.1.45"
                    className="font-mono h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Port
                  </label>
                  <Input
                    value={formData.port}
                    onChange={(e) => updateField("port", e.target.value)}
                    placeholder="22"
                    className="font-mono h-10 max-w-[120px]"
                  />
                </div>
                {formData.mode === "bastion" && (
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                      Bastion Host
                    </label>
                    <select
                      value={formData.bastionHost}
                      onChange={(e) =>
                        updateField("bastionHost", e.target.value)
                      }
                      className="flex h-10 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      <option value="">Select a gateway...</option>
                      <option value="bastion-01">
                        prod-bastion-us-east (10.0.0.1)
                      </option>
                      <option value="bastion-02">
                        prod-bastion-eu-west (10.0.0.2)
                      </option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case "auth":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-400">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Authentication
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                Securely credential the orchestrator access to this node.
              </p>
            </div>
            <div className="space-y-5 max-w-xl">
              <div className="space-y-3">
                <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 block">
                  Method
                </label>
                <div className="flex flex-wrap gap-2 p-1.5 rounded-lg bg-zinc-100/60 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/60 w-fit">
                  {(formData.os === "linux"
                    ? ["ssh_key", "password", "agent_token"]
                    : ["agent_token", "winrm", "ad"]
                  ).map((m) => {
                    const labels: any = {
                      ssh_key: "SSH Key",
                      password: "Password",
                      agent_token: "Agent Token",
                      winrm: "WinRM",
                      ad: "Active Directory",
                    };
                    const isCurrent = formData.authMethod === m;
                    return (
                      <button
                        key={m}
                        onClick={() => updateField("authMethod", m)}
                        className={cn(
                          "px-3.5 py-2 text-[13px] font-semibold rounded-md transition-all",
                          isCurrent
                            ? "bg-white dark:bg-[#1C1C1C] text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700"
                            : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-800 dark:text-zinc-200",
                        )}
                      >
                        {labels[m]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="pt-1">
                <CredentialVaultHandler
                  type={
                    formData.authMethod.includes("key")
                      ? "privateKey"
                      : formData.authMethod.includes("token")
                        ? "token"
                        : "password"
                  }
                  label={
                    formData.authMethod === "ssh_key"
                      ? "Private Key Material"
                      : formData.authMethod === "agent_token"
                        ? "Installation Token"
                        : "Secret"
                  }
                  onChange={(val) => updateField("credential", val)}
                />
              </div>
            </div>
          </div>
        );

      case "privilege":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-400">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Privilege Escalation
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                Configure runtime context for playbooks and remote operations.
              </p>
            </div>
            <div className="max-w-xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-6">
              <PrivilegeSettings
                os={formData.os}
                value={formData.privilege}
                onChange={(val) => updateField("privilege", val)}
              />
            </div>

            {/* Summary before launch */}
            <div className="max-w-xl space-y-2">
              <p className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100 mb-3">
                Review before launch
              </p>
              <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-[#121212] divide-y divide-zinc-200/60 dark:divide-zinc-800/60 overflow-hidden text-[13px]">
                {[
                  { label: "Node Name", value: formData.name || "—" },
                  {
                    label: "OS",
                    value: formData.os === "linux" ? "Linux" : "Windows",
                  },
                  {
                    label: "IP / Port",
                    value: `${formData.ip || "—"}:${formData.port}`,
                  },
                  { label: "Connection Mode", value: formData.mode },
                  {
                    label: "Auth Method",
                    value: formData.authMethod.replace("_", " ").toUpperCase(),
                  },
                  { label: "Run as User", value: formData.privilege.user },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <span className="text-zinc-500 font-medium">
                      {row.label}
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render onboarding progress page
  // ─────────────────────────────────────────────────────────────────────────

  const renderOnboardingStep = () => {
    if (!session) {
      return (
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3 text-zinc-600 dark:text-zinc-400">
            <RefreshCw size={28} className="animate-spin" />
            <p className="text-sm font-medium">
              Initializing onboarding session...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-400">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {isComplete
                ? "Node Registered Successfully!"
                : isFailed
                  ? "Onboarding Failed"
                  : "Onboarding in Progress..."}
            </h2>
            {isRunning && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Running
              </span>
            )}
            {isComplete && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
                <CheckCircle2 size={12} />
                Active
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isComplete
              ? `"${session.serverName}" is now live in your cluster. View it in the server list.`
              : `Connecting to ${session.serverIp} and setting up the EINFRA agent...`}
          </p>
        </div>

        {/* On complete: show system info. On running/failed: show progress + logs */}
        {isComplete && session.sysInfo ? (
          <div className="space-y-6">
            <SystemInfoCard session={session} />
            <div className="flex gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate("/servers")}
                className="flex-1 sm:flex-none"
              >
                <Server size={15} className="mr-2" /> View in Server List
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate(`/servers`)}
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Steps */}
            <OnboardingProgressPanel session={session} onRetry={handleRetry} />
            {/* Right: Logs */}
            <div className="h-[520px] flex flex-col rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
              <TerminalPanel logs={session.logs} />
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Main Layout
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-20">
      {/* Top nav */}
      <div className="mb-8">
        <Link
          to="/servers"
          className="inline-flex items-center text-[13px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-5"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Servers
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-1.5">
          Connect Infrastructure Node
        </h1>
        <p className="text-[14px] text-zinc-500 dark:text-zinc-400">
          Follow the onboarding process to securely register a server into the
          cluster.
        </p>
      </div>

      {/* Step indicator ribbon */}
      <div className="flex items-center gap-0 mb-10 overflow-x-auto scrollbar-hide">
        {WIZARD_STEPS.map((step, idx) => {
          const isActive = step.id === wizardStep;
          const isCompleted = currentWizardIndex > idx;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center shrink-0">
              <button
                onClick={() => {
                  if (isCompleted && step.id !== "onboarding")
                    setWizardStep(step.id);
                }}
                disabled={!isCompleted && !isActive}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all",
                  isActive &&
                    "bg-white dark:bg-zinc-900 dark:bg-white text-zinc-900 dark:text-white dark:text-zinc-900",
                  isCompleted &&
                    !isActive &&
                    "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-100 dark:bg-zinc-800 cursor-pointer",
                  !isCompleted &&
                    !isActive &&
                    "text-zinc-600 dark:text-zinc-400 dark:text-zinc-600 cursor-not-allowed",
                )}
              >
                {isCompleted ? (
                  <CheckCircle2
                    size={15}
                    className="text-emerald-500 shrink-0"
                  />
                ) : (
                  <Icon size={15} className="shrink-0" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {idx < WIZARD_STEPS.length - 1 && (
                <ChevronRight
                  size={16}
                  className={cn(
                    "mx-1 shrink-0",
                    isCompleted
                      ? "text-zinc-600 dark:text-zinc-400"
                      : "text-zinc-700 dark:text-zinc-300 dark:text-zinc-700",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Main content card */}
      <div className="bg-white dark:bg-[#0E0E0E] border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-8 lg:p-10">
          {isOnboarding ? renderOnboardingStep() : renderFormStep()}
        </div>

        {/* Footer navigation (hidden during onboarding) */}
        {!isOnboarding && (
          <div className="px-8 lg:px-10 py-5 border-t border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between">
            <Button
              variant="outline"
              size="md"
              onClick={handleBack}
              disabled={wizardStep === "basic"}
              className={cn(
                "w-28",
                wizardStep === "basic" && "opacity-0 pointer-events-none",
              )}
            >
              <ArrowLeft size={14} className="mr-1.5" /> Back
            </Button>

            <div className="flex items-center gap-1.5">
              {WIZARD_STEPS.filter((s) => s.id !== "onboarding").map((s, i) => (
                <div
                  key={s.id}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    s.id === wizardStep
                      ? "bg-white dark:bg-zinc-900 dark:bg-white w-5"
                      : currentWizardIndex > i
                        ? "bg-emerald-500"
                        : "bg-zinc-300 dark:bg-zinc-700",
                  )}
                />
              ))}
            </div>

            {wizardStep === "privilege" ? (
              <Button
                variant="primary"
                size="md"
                onClick={handleLaunch}
                disabled={!formData.name || !formData.ip}
                className="w-40 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 border-transparent shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                <Play size={14} className="mr-1.5" />
                Launch Onboarding
              </Button>
            ) : (
              <Button
                variant="outline"
                size="md"
                onClick={handleNext}
                disabled={wizardStep === "basic" && !formData.name}
                className="w-28 bg-white dark:bg-zinc-900 dark:bg-white text-zinc-900 dark:text-white dark:text-zinc-900 border-transparent hover:opacity-90"
              >
                Continue <ChevronRight size={14} className="ml-1" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
