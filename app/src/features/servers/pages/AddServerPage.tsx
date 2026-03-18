import { useState } from "react";
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
} from "lucide-react";
import { useAddServer } from "../api/useServerHooks";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import CredentialVaultHandler from "./components/CredentialVaultHandler";
import PrivilegeSettings from "./components/PrivilegeSettings";

type Step = "basic" | "connection" | "auth" | "privilege";

const stepsList: { id: Step; label: string; icon: any; desc: string }[] = [
  {
    id: "basic",
    label: "General Information",
    icon: Globe,
    desc: "Name, OS and tags",
  },
  {
    id: "connection",
    label: "Connection Details",
    icon: Network,
    desc: "IP, port and routing",
  },
  {
    id: "auth",
    label: "Authentication",
    icon: Lock,
    desc: "Credentials and keys",
  },
  {
    id: "privilege",
    label: "Privileges",
    icon: Shield,
    desc: "Access and sudo rules",
  },
];

export default function AddServerPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>("basic");

  // Form State
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

  const { mutateAsync: createServer, isPending: isAdding } = useAddServer();

  const handleNext = async () => {
    if (currentStep === "privilege") {
      try {
        await createServer({
          name: formData.name,
          description: formData.description,
          os: formData.os as any,
          ip_address: formData.ip,
          status: "online",
          cpu_cores: 4,
          memory_gb: 16,
          disk_gb: 100,
          ssh_port: parseInt(formData.port) || 22,
          ssh_user: formData.privilege.user,
          tunnel_enabled: formData.mode === "bastion",
          tunnel_host: formData.bastionHost,
        });
        navigate("/servers");
      } catch (error) {
        console.error("Failed to add component", error);
        alert("Failed to add server: " + (error as Error).message);
      }
      return;
    }

    const currentIndex = stepsList.findIndex((s) => s.id === currentStep);
    if (currentIndex < stepsList.length - 1) {
      setCurrentStep(stepsList[currentIndex + 1].id as Step);
    }
  };

  const handleBack = () => {
    const currentIndex = stepsList.findIndex((s) => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(stepsList[currentIndex - 1].id as Step);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const currentIndex = stepsList.findIndex((s) => s.id === currentStep);
  const progressPercentage = ((currentIndex + 1) / stepsList.length) * 100;

  const renderStepContent = () => {
    switch (currentStep) {
      case "basic":
        return (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-20">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
                General Information
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Provide the basic identifier details for your new infrastructure
                node.
              </p>
            </div>

            <div className="space-y-6 max-w-2xl">
              <div className="space-y-3">
                <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Display Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="e.g. prod-db-primary"
                  className="max-w-md bg-zinc-50/50 dark:bg-zinc-900/50"
                  icon={<Server className="w-4 h-4 text-zinc-400" />}
                />
              </div>

              <div className="space-y-3">
                <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Operating System
                </label>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <button
                    onClick={() => {
                      updateField("os", "linux");
                      updateField("port", "22");
                      updateField("authMethod", "ssh_key");
                    }}
                    className={`flex items-center justify-center gap-2 p-3 text-sm font-medium rounded-lg border transition-all ${
                      formData.os === "linux"
                        ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    }`}
                  >
                    <Terminal className="w-4 h-4" /> Linux
                  </button>
                  <button
                    onClick={() => {
                      updateField("os", "windows");
                      updateField("port", "5985");
                      updateField("authMethod", "agent_token");
                    }}
                    className={`flex items-center justify-center gap-2 p-3 text-sm font-medium rounded-lg border transition-all ${
                      formData.os === "windows"
                        ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 88 88"
                      fill="currentColor"
                    >
                      <path d="M0 12.402l35.687-4.86.016 34.423-35.703.206L0 12.402zm35.67 33.529l.016 34.45L0 75.46v-29.75l35.67.22zm4.326-39.02L87.314 0v41.28L40.012 41.56V6.911zm0 38.65L87.314 46v42L39.996 81.3V45.561z" />
                    </svg>
                    Windows
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  className="w-full max-w-2xl bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-3 text-[13px] text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none placeholder:text-zinc-400"
                  placeholder="Briefly describe the server's purpose..."
                />
              </div>
            </div>
          </div>
        );

      case "connection":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
                Connection Routing
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Configure how EINFRA orchestrator communicates with this node.
              </p>
            </div>

            <div className="space-y-6">
              <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 block">
                Routing Strategy
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
                {[
                  {
                    id: "agent",
                    label: "EINFRA Agent",
                    desc: "Outbound only, recommended for NAT/Firewalled environments.",
                    icon: Activity,
                  },
                  {
                    id: "direct",
                    label: "Direct SSH",
                    desc: "Direct connection over port 22. Requires orchestrator whitelist.",
                    icon: Network,
                  },
                  {
                    id: "bastion",
                    label: "Bastion Host",
                    desc: "Jump through an intermediary secure gateway server.",
                    icon: Shield,
                  },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => updateField("mode", mode.id)}
                    className={`relative p-5 rounded-xl border-2 text-left transition-all group ${
                      formData.mode === mode.id
                        ? "border-zinc-900 dark:border-white bg-zinc-50/50 dark:bg-zinc-800/20 shadow-sm"
                        : "border-zinc-200/50 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-[#121212]"
                    }`}
                  >
                    {formData.mode === mode.id && (
                      <div className="absolute top-4 right-4 text-zinc-900 dark:text-white">
                        <CheckCircle2
                          size={16}
                          className="fill-current text-white dark:text-zinc-900"
                        />
                      </div>
                    )}
                    <div
                      className={`mb-3 flex items-center justify-center w-10 h-10 rounded-lg ${formData.mode === mode.id ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500"}`}
                    >
                      <mode.icon size={20} />
                    </div>
                    <div
                      className={`font-semibold text-sm ${formData.mode === mode.id ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"}`}
                    >
                      {mode.label}
                    </div>
                    <div className="text-[13px] text-zinc-500 mt-1.5 leading-relaxed">
                      {mode.desc}
                    </div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 mt-6 border-t border-zinc-200 dark:border-zinc-800 max-w-2xl">
                <div className="space-y-3">
                  <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                    IP Address or FQDN <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.ip}
                    onChange={(e) => updateField("ip", e.target.value)}
                    placeholder="e.g. 10.0.1.45"
                    className="font-mono text-sm bg-zinc-50/50 dark:bg-zinc-900/50"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                    Port
                  </label>
                  <Input
                    value={formData.port}
                    onChange={(e) => updateField("port", e.target.value)}
                    placeholder="22"
                    className="font-mono text-sm bg-zinc-50/50 dark:bg-zinc-900/50 max-w-[120px]"
                  />
                </div>

                {formData.mode === "bastion" && (
                  <div className="md:col-span-2 space-y-3">
                    <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
                      Select Bastion Node
                    </label>
                    <select
                      value={formData.bastionHost}
                      onChange={(e) =>
                        updateField("bastionHost", e.target.value)
                      }
                      className="w-full bg-zinc-50/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2.5 text-[13px] text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
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
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
                Authentication
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Securely credential the orchestrator access.
              </p>
            </div>

            <div className="space-y-4 max-w-2xl">
              <label className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 block">
                Method
              </label>
              <div className="flex flex-wrap gap-2 rounded-lg p-1 bg-zinc-100/80 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/80 inline-flex">
                {(formData.os === "linux"
                  ? ["ssh_key", "password", "agent_token"]
                  : ["agent_token", "winrm", "ad"]
                ).map((m) => {
                  const labels: any = {
                    ssh_key: "Ed25519/RSA Key",
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
                      className={`px-4 py-2 text-[13px] font-medium rounded-md transition-all ${
                        isCurrent
                          ? "bg-white dark:bg-[#1C1C1C] text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700"
                          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {labels[m]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="max-w-2xl pt-2">
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
        );

      case "privilege":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
                Privilege Escalation
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Configure context execution for Ansible playbooks and runtime
                operations.
              </p>
            </div>
            <div className="max-w-2xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-6">
              <PrivilegeSettings
                os={formData.os}
                value={formData.privilege}
                onChange={(val) => updateField("privilege", val)}
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto min-h-[calc(100vh-140px)] flex flex-col justify-center py-10 animate-in fade-in duration-500">
      <div className="mb-8">
        <Link
          to="/servers"
          className="inline-flex items-center text-[13px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Servers
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
          Connect Infrastructure Node
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm">
          Follow the setup process to securely onboard a new server into the
          cluster.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 relative">
        {/* Progress Sidebar */}
        <div className="w-full lg:w-64 shrink-0 relative">
          <div className="absolute left-[15px] top-6 bottom-6 w-px bg-zinc-200 dark:bg-zinc-800 hidden lg:block" />
          <div
            className="absolute left-[15px] top-6 w-px bg-zinc-900 dark:bg-white transition-all duration-500 ease-out hidden lg:block"
            style={{ height: `calc(${progressPercentage}% - 24px)` }}
          />

          <div className="flex lg:flex-col gap-4 lg:gap-8 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 scrollbar-hide relative z-10">
            {stepsList.map((step, idx) => {
              const isActive = step.id === currentStep;
              const isCompleted =
                stepsList.findIndex((s) => s.id === currentStep) > idx;

              return (
                <button
                  key={step.id}
                  onClick={() => isCompleted && setCurrentStep(step.id as Step)}
                  disabled={!isCompleted && !isActive}
                  className={`flex items-start gap-4 text-left transition-all group shrink-0 w-48 lg:w-full ${isActive ? "opacity-100" : isCompleted ? "opacity-80 hover:opacity-100 cursor-pointer" : "opacity-40"}`}
                >
                  <div
                    className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white dark:bg-[#0A0A0A] shrink-0 transition-all duration-300 ${
                      isActive
                        ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                        : isCompleted
                          ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                          : "border-zinc-300 dark:border-zinc-700 text-zinc-400"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <step.icon size={14} />
                    )}
                  </div>
                  <div>
                    <h3
                      className={`text-[13px] font-semibold mb-0.5 tracking-tight ${isActive || isCompleted ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}
                    >
                      {step.label}
                    </h3>
                    <p className="text-[12px] text-zinc-500 dark:text-zinc-500 leading-snug hidden lg:block">
                      {step.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Wizard Main Area */}
        <div className="flex-1 w-full max-w-4xl">
          <div className="min-h-[420px]">{renderStepContent()}</div>

          <div className="pt-8 mt-12 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <Button
              variant="outline"
              size="md"
              onClick={handleBack}
              disabled={currentStep === "basic"}
              className={`w-[120px] ${currentStep === "basic" ? "opacity-0 pointer-events-none" : "opacity-100"}`}
            >
              Previous
            </Button>

            <Button
              variant={currentStep === "privilege" ? "primary" : "outline"}
              size="md"
              onClick={handleNext}
              disabled={isAdding || (currentStep === "basic" && !formData.name)}
              className={`w-[140px] ${currentStep === "privilege" ? "" : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-transparent hover:opacity-90"}`}
            >
              {currentStep === "privilege"
                ? isAdding
                  ? "Saving..."
                  : "Create Node"
                : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
