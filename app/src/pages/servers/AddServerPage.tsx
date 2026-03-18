import { useState } from "react";
import {
  Server,
  Shield,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Network,
  Lock,
  Globe,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import CredentialVaultHandler from "./components/CredentialVaultHandler";
import PrivilegeSettings from "./components/PrivilegeSettings";

type Step = "basic" | "connection" | "auth" | "privilege";

export default function AddServerPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>("basic");

  // Form State
  const [formData, setFormData] = useState({
    // Basic
    name: "",
    description: "",
    tags: "",
    os: "linux" as "linux" | "windows",

    // Connection
    mode: "agent" as "agent" | "direct" | "bastion",
    ip: "",
    port: "22",
    bastionHost: "",

    // Auth
    authMethod: "ssh_key" as "ssh_key" | "password" | "agent_token" | "winrm" | "ad",
    credential: { method: "manual", value: "" },

    // Privilege
    privilege: { user: "root", escalation: "sudo" },
  });

  const steps = [
    { id: "basic", label: "Basic Info", icon: Globe },
    { id: "connection", label: "Connection", icon: Network },
    { id: "auth", label: "Authentication", icon: Lock },
    { id: "privilege", label: "Privileges", icon: Shield },
  ];

  const handleNext = () => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id as Step);
    }
  };

  const handleBack = () => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id as Step);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "basic":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Display Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-2 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="e.g. Production Web Server"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Operating System</label>
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-md">
                  <button
                    onClick={() => {
                      updateField("os", "linux");
                      updateField("port", "22");
                      updateField("authMethod", "ssh_key");
                    }}
                    className={`flex-1 py-1.5 text-sm font-bold rounded-sm transition-all flex items-center justify-center gap-2 ${formData.os === "linux" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500"}`}
                  >
                    <Server size={16} /> Linux
                  </button>
                  <button
                    onClick={() => {
                      updateField("os", "windows");
                      updateField("port", "5985");
                      updateField("authMethod", "agent_token");
                    }}
                    className={`flex-1 py-1.5 text-sm font-bold rounded-sm transition-all flex items-center justify-center gap-2 ${formData.os === "windows" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-zinc-500"}`}
                  >
                    <MonitorIcon /> Windows
                  </button>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-2 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                  placeholder="Briefly describe the server's purpose..."
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Tags</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => updateField("tags", e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-2 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="production, database, us-east (comma separated)"
                />
              </div>
            </div>
          </div>
        );

      case "connection":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-4">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Connection Mode</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: "agent", label: "Agent (Recommended)", desc: "Outbound only, easiest setup", icon: CheckCircle2 },
                  { id: "direct", label: "Direct Connection", desc: "Standard SSH/WinRM", icon: Network },
                  { id: "bastion", label: "Via Bastion", desc: "Jump host tunneling", icon: Shield },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => updateField("mode", mode.id)}
                    className={`p-4 rounded-sm border-2 text-left transition-all ${formData.mode === mode.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                      }`}
                  >
                    <div className={`mb-3 ${formData.mode === mode.id ? "text-blue-600 dark:text-blue-400" : "text-zinc-400"}`}>
                      <mode.icon size={24} />
                    </div>
                    <div className="font-bold text-zinc-900 dark:text-white text-sm">{mode.label}</div>
                    <div className="text-xs text-zinc-500 mt-1">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Hostname / IP <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.ip}
                  onChange={(e) => updateField("ip", e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-2 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                  placeholder="192.168.1.100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Port</label>
                <input
                  type="text"
                  value={formData.port}
                  onChange={(e) => updateField("port", e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-2 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                />
              </div>

              {formData.mode === "bastion" && (
                <div className="md:col-span-3 space-y-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Bastion Host</label>
                  <select
                    value={formData.bastionHost}
                    onChange={(e) => updateField("bastionHost", e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-2 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    <option value="">Select a bastion server...</option>
                    <option value="bastion-01">bastion-01 (10.0.0.1)</option>
                    <option value="bastion-02">bastion-02 (10.0.0.2)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        );

      case "auth":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-4">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Authentication Method</label>
              <div className="flex flex-wrap gap-3">
                {formData.os === "linux" ? (
                  <>
                    {["ssh_key", "password", "agent_token"].map(m => (
                      <AuthMethodButton key={m} method={m} current={formData.authMethod} onClick={() => updateField("authMethod", m)} />
                    ))}
                  </>
                ) : (
                  <>
                    {["agent_token", "winrm", "ad"].map(m => (
                      <AuthMethodButton key={m} method={m} current={formData.authMethod} onClick={() => updateField("authMethod", m)} />
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <CredentialVaultHandler
                type={
                  formData.authMethod.includes("key") ? "privateKey" :
                    formData.authMethod.includes("token") ? "token" : "password"
                }
                label={
                  formData.authMethod === "ssh_key" ? "Private SSH Key" :
                    formData.authMethod === "agent_token" ? "Agent Install Token" :
                      "Password"
                }
                onChange={(val) => updateField("credential", val)}
              />
            </div>
          </div>
        );

      case "privilege":
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-sm p-4 mb-6">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Define the execution context for commands and scripts run on this server. Be careful with high-privilege accounts.
              </p>
            </div>
            <PrivilegeSettings
              os={formData.os}
              value={formData.privilege}
              onChange={(val) => updateField("privilege", val)}
            />
          </div>
        );
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <Server className="text-blue-500" /> Add New Node
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
          Configure connection and security settings for a new infrastructure node.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Sidebar Steps */}
        <div className="lg:col-span-1 space-y-2">
          {steps.map((step, idx) => {
            const isActive = step.id === currentStep;
            const isCompleted = steps.findIndex(s => s.id === currentStep) > idx;

            return (
              <button
                key={step.id}
                onClick={() => isCompleted && setCurrentStep(step.id as Step)}
                disabled={!isCompleted && !isActive}
                className={`w-full text-left px-4 py-3 rounded-md flex items-center gap-3 transition-all ${isActive
                  ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 font-bold shadow-sm border border-zinc-200 dark:border-zinc-700"
                  : isCompleted
                    ? "text-zinc-600 dark:text-zinc-400 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800/50 cursor-pointer"
                    : "text-zinc-400 opacity-60 cursor-not-allowed"
                  }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${isActive ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" :
                  isCompleted ? "bg-green-100 dark:bg-green-900/30 text-green-600" :
                    "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                  }`}>
                  {isCompleted ? <CheckCircle2 size={14} /> : idx + 1}
                </div>
                <span className="text-sm">{step.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm shadow-sm overflow-hidden min-h-[500px] flex flex-col">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
            <h2 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center gap-2">
              <span className="text-zinc-400 font-medium">Step {steps.findIndex(s => s.id === currentStep) + 1}:</span>
              {steps.find(s => s.id === currentStep)?.label}
            </h2>
          </div>

          <div className="p-8 flex-1">
            {renderStepContent()}
          </div>

          <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-between gap-3">
            <div>
              {currentStep !== "basic" && (
                <button
                  onClick={handleBack}
                  className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 font-bold text-sm transition-colors flex items-center gap-2"
                >
                  <ArrowLeft size={16} /> Back
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <Link to="/servers">
                <button className="px-4 py-2 text-zinc-500 hover:text-red-500 font-bold text-sm transition-colors">
                  Cancel
                </button>
              </Link>
              <button
                onClick={currentStep === "privilege" ? () => navigate("/servers") : handleNext}
                className="bg-zinc-900 dark:bg-white hover:opacity-90 text-white dark:text-zinc-900 px-6 py-2 rounded-sm text-sm font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95"
              >
                {currentStep === "privilege" ? (
                  <>Ininitalize Node <Server size={16} /></>
                ) : (
                  <>Next Step <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function AuthMethodButton({ method, current, onClick }: { method: string, current: string, onClick: () => void }) {
  const labels: Record<string, string> = {
    ssh_key: "SSH Key",
    password: "Password",
    agent_token: "Agent Token",
    winrm: "WinRM (Basic)",
    ad: "Active Directory",
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-bold rounded-sm border transition-all ${current === method
        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white"
        : "bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
        }`}
    >
      {labels[method] || method}
    </button>
  );
}

function MonitorIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

