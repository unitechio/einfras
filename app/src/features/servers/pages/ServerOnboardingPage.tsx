import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  Globe,
  Info,
  Lock,
  Loader2,
  Network,
  Server,
  Shield,
  Terminal,
  X,
} from "lucide-react";

import { useNotification } from "@/core/NotificationContext";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { cn } from "@/lib/utils";
import { serversApi, ApiError, type AgentInstallScriptDTO } from "@/shared/api/client";
import { useAddServer, useAgentToken } from "../api/useServerHooks";
import type { Server as ServerModel } from "../types";
import PrivilegeSettings from "./components/PrivilegeSettings";

type WizardStep = "basic" | "connection" | "auth" | "privilege" | "complete";

type FormState = {
  name: string;
  description: string;
  hostname: string;
  ipAddress: string;
  os: "linux" | "windows";
  environment: "production" | "staging" | "development";
  tags: string;
  connectionMode: "agent" | "ssh" | "bastion";
  port: string;
  bastionHost: string;
  authMethod: "agent_token" | "password" | "ssh_key";
  password: string;
  sshKeyPath: string;
  sshUser: string;
  privilege: {
    user: string;
    escalation: string;
  };
};

type OnboardingResult = {
  server: ServerModel;
  token?: string;
  installScript?: string;
  installCommand?: string;
  installURL?: string;
};

type NoticeState = {
  type: "success" | "error" | "info" | "warning";
  title: string;
  description?: string;
};

type FieldErrorKey =
  | "name"
  | "hostname"
  | "ipAddress"
  | "port"
  | "bastionHost"
  | "password"
  | "sshKeyPath"
  | "sshUser"
  | "privilegeUser";

type FieldErrors = Partial<Record<FieldErrorKey, string>>;

const STEPS: { id: WizardStep; label: string; icon: typeof Globe }[] = [
  { id: "basic", label: "Node Info", icon: Globe },
  { id: "connection", label: "Connection", icon: Network },
  { id: "auth", label: "Authentication", icon: Lock },
  { id: "privilege", label: "Privileges", icon: Shield },
  { id: "complete", label: "Complete", icon: CheckCircle2 },
];

const initialForm: FormState = {
  name: "",
  description: "",
  hostname: "",
  ipAddress: "",
  os: "linux",
  environment: "production",
  tags: "",
  connectionMode: "agent",
  port: "22",
  bastionHost: "",
  authMethod: "agent_token",
  password: "",
  sshKeyPath: "",
  sshUser: "root",
  privilege: {
    user: "root",
    escalation: "sudo",
  },
};

export default function ServerOnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>("basic");
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [submitError, setSubmitError] = useState<string>("");
  const [agentHealth, setAgentHealth] = useState<{
    online: boolean;
    message: string;
  } | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [agentOnlineAnnounced, setAgentOnlineAnnounced] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const addServer = useAddServer();
  const issueToken = useAgentToken();
  const { showNotification } = useNotification();

  const canGoNext = useMemo(() => {
    switch (step) {
      case "basic":
        return !!form.name.trim() && !!form.ipAddress.trim();
      case "connection":
        return (
          !!form.port.trim() &&
          (form.connectionMode !== "bastion" || !!form.bastionHost.trim())
        );
      case "auth":
        if (form.connectionMode === "agent") {
          return true;
        }
        if (form.authMethod === "password") {
          return !!form.password.trim();
        }
        if (form.authMethod === "ssh_key") {
          return !!form.sshKeyPath.trim();
        }
        return true;
      case "privilege":
        return !!form.privilege.user.trim();
      default:
        return true;
    }
  }, [form, step]);

  useEffect(() => {
    if (form.connectionMode === "agent") {
      setForm((current) => ({
        ...current,
        authMethod: "agent_token",
      }));
      return;
    }
    if (form.os === "windows") {
      setForm((current) => ({
        ...current,
        authMethod: "password",
        port: current.port === "22" ? "5985" : current.port,
      }));
      return;
    }
    if (form.authMethod === "agent_token") {
      setForm((current) => ({
        ...current,
        authMethod: "password",
      }));
    }
  }, [form.connectionMode, form.os, form.authMethod]);

  useEffect(() => {
    if (!result?.server?.id || result.server.connection_mode !== "agent") {
      return;
    }
    const poll = async () => {
      setIsCheckingStatus(true);
      try {
        const status = await serversApi.healthCheck(result.server.id);
        setAgentHealth({
          online: status.healthy,
          message: status.message,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to check agent status";
        setAgentHealth({ online: false, message });
      } finally {
        setIsCheckingStatus(false);
      }
    };
    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [result?.server?.id, result?.server?.connection_mode]);

  useEffect(() => {
    if (!agentHealth?.online || agentOnlineAnnounced === true) {
      return;
    }
    setAgentOnlineAnnounced(true);
    setNotice({
      type: "success",
      title: "Agent connected successfully",
      description: "This node is now online and ready for remote operations.",
    });
    showNotification({
      type: "success",
      message: "Agent online",
      description: `${result?.server.name ?? "Server"} is now connected.`,
    });
  }, [
    agentHealth?.online,
    agentOnlineAnnounced,
    result?.server.name,
    showNotification,
  ]);

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    const mappedKey =
      key === "ipAddress"
        ? "ipAddress"
        : key === "sshUser"
          ? "sshUser"
          : key === "hostname"
            ? "hostname"
            : key === "port"
              ? "port"
              : undefined;
    if (mappedKey) {
      setFieldErrors((current) => {
        if (!current[mappedKey]) return current;
        const next = { ...current };
        delete next[mappedKey];
        return next;
      });
    }
  };

  const nextStep = async () => {
    if (step === "privilege") {
      await submit();
      return;
    }
    const index = STEPS.findIndex((item) => item.id === step);
    if (index >= 0 && index < STEPS.length - 2) {
      setStep(STEPS[index + 1].id);
    }
  };

  const previousStep = () => {
    const index = STEPS.findIndex((item) => item.id === step);
    if (index > 0) {
      setStep(STEPS[index - 1].id);
    }
  };

  const submit = async () => {
    setSubmitError("");
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      const firstStep = resolveStepForErrors(validationErrors);
      if (firstStep !== step) {
        setStep(firstStep);
      }
      setNotice({
        type: "warning",
        title: "Please review highlighted fields",
        description:
          "A few required values need to be fixed before this node can be created.",
      });
      return;
    }
    setFieldErrors({});
    setNotice({
      type: "info",
      title: "Creating server record",
      description:
        "Sending the new node definition to backend and preparing onboarding.",
    });
    try {
      const created = await addServer.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim(),
        hostname: (form.hostname || form.name).trim(),
        ip_address: form.ipAddress.trim(),
        os: form.os,
        environment: form.environment,
        connection_mode: form.connectionMode,
        ssh_port:
          Number.parseInt(form.port, 10) || (form.os === "windows" ? 5985 : 22),
        ssh_user: form.privilege.user.trim() || form.sshUser.trim() || "root",
        ssh_password:
          form.connectionMode === "agent" || form.authMethod !== "password"
            ? undefined
            : form.password,
        ssh_key_path:
          form.connectionMode === "agent" || form.authMethod !== "ssh_key"
            ? undefined
            : form.sshKeyPath.trim(),
        tags: parseTags(form.tags),
      });

      if (form.connectionMode !== "agent") {
        setResult({ server: created });
        setNotice({
          type: "success",
          title: "Server created",
          description: "Direct-managed node has been registered successfully.",
        });
        showNotification({
          type: "success",
          message: "Server created",
          description: `${created.name} is ready in the server list.`,
        });
        setStep("complete");
        return;
      }

      const [{ token }, install] = await Promise.all([
        issueToken.mutateAsync(created.id),
        serversApi.installScript(created.id),
      ]);

      setResult({
        server: created,
        token,
        installScript: resolveInstallScript(install),
        installCommand: install.command,
        installURL: install.install_url,
      });
      setNotice({
        type: "success",
        title: "Server created and agent onboarding prepared",
        description:
          "Copy the install script below and run it on the target node.",
      });
      showNotification({
        type: "success",
        message: "Node created",
        description: `Token and install script are ready for ${created.name}.`,
      });
      setStep("complete");
    } catch (error) {
      const message = normalizeErrorMessage(error);
      setFieldErrors(mapBackendFieldErrors(message));
      if (error instanceof ApiError) {
        setSubmitError(message);
      } else if (error instanceof Error) {
        setSubmitError(message);
      } else {
        setSubmitError("Failed to create server");
      }
      setNotice({
        type: "error",
        title: "Add node failed",
        description: message,
      });
      showNotification({
        type: "error",
        message: "Add node failed",
        description: message,
      });
    }
  };

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({
        type: "success",
        title: "Copied to clipboard",
        description: "You can now paste it into the target node terminal.",
      });
      showNotification({
        type: "success",
        message: "Copied",
        description: "Value copied to clipboard.",
        duration: 2500,
      });
    } catch {
      const message = "Copy failed. Please copy manually.";
      setSubmitError(message);
      setNotice({
        type: "warning",
        title: "Clipboard unavailable",
        description: message,
      });
      showNotification({
        type: "warning",
        message: "Clipboard unavailable",
        description: message,
      });
    }
  };

  const renderStep = () => {
    switch (step) {
      case "basic":
        return (
          <div className="space-y-6">
            <SectionTitle
              title="Node Information"
              description="Create the server record that backend management, monitoring, and agent control will use."
            />
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Display Name" required>
                <Input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="prod-web-01"
                  icon={<Server className="h-4 w-4" />}
                  className={inputErrorClass(fieldErrors.name)}
                />
                <FieldErrorText message={fieldErrors.name} />
              </Field>
              <Field label="Hostname">
                <Input
                  value={form.hostname}
                  onChange={(e) => updateField("hostname", e.target.value)}
                  placeholder="prod-web-01.internal"
                  className={inputErrorClass(fieldErrors.hostname)}
                />
                <FieldErrorText message={fieldErrors.hostname} />
              </Field>
              <Field label="IP / FQDN" required>
                <Input
                  value={form.ipAddress}
                  onChange={(e) => updateField("ipAddress", e.target.value)}
                  placeholder="10.10.1.24"
                  className={inputErrorClass(fieldErrors.ipAddress)}
                />
                <FieldErrorText message={fieldErrors.ipAddress} />
              </Field>
              <Field label="Environment">
                <select
                  value={form.environment}
                  onChange={(e) =>
                    updateField(
                      "environment",
                      e.target.value as FormState["environment"],
                    )
                  }
                  className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Operating System">
                <div className="grid grid-cols-2 gap-3">
                  <ChoiceButton
                    active={form.os === "linux"}
                    title="Linux"
                    description="SSH or Agent"
                    onClick={() => {
                      updateField("os", "linux");
                      updateField(
                        "port",
                        form.connectionMode === "agent"
                          ? "22"
                          : form.port || "22",
                      );
                      updateField("sshUser", "root");
                      setForm((current) => ({
                        ...current,
                        privilege: { user: "root", escalation: "sudo" },
                      }));
                    }}
                  />
                  <ChoiceButton
                    active={form.os === "windows"}
                    title="Windows"
                    description="Agent preferred"
                    onClick={() => {
                      updateField("os", "windows");
                      updateField("port", "5985");
                      updateField("connectionMode", "agent");
                      setForm((current) => ({
                        ...current,
                        privilege: {
                          user: "Administrator",
                          escalation: "admin",
                        },
                      }));
                    }}
                  />
                </div>
              </Field>
              <Field label="Tags">
                <Input
                  value={form.tags}
                  onChange={(e) => updateField("tags", e.target.value)}
                  placeholder="production, web, critical"
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                rows={4}
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Public-facing web server for production traffic"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
              />
            </Field>
          </div>
        );
      case "connection":
        return (
          <div className="space-y-6">
            <SectionTitle
              title="Connection Strategy"
              description="Choose how this node will be managed. Agent mode is the production-safe default."
            />
            <div className="grid gap-4 md:grid-cols-3">
              <ChoiceButton
                active={form.connectionMode === "agent"}
                title="Agent"
                description="Recommended. Outbound only."
                onClick={() => {
                  updateField("connectionMode", "agent");
                  updateField("authMethod", "agent_token");
                  updateField("port", form.os === "windows" ? "5985" : "22");
                }}
              />
              <ChoiceButton
                active={form.connectionMode === "ssh"}
                title={form.os === "windows" ? "WinRM" : "Direct"}
                description={
                  form.os === "windows"
                    ? "Direct WinRM login"
                    : "Direct SSH login"
                }
                onClick={() => {
                  updateField("connectionMode", "ssh");
                  updateField("authMethod", "password");
                  updateField("port", form.os === "windows" ? "5985" : "22");
                }}
              />
              <ChoiceButton
                active={form.connectionMode === "bastion"}
                title="Bastion"
                description="Connect through jump host"
                onClick={() => {
                  updateField("connectionMode", "bastion");
                  updateField("authMethod", "password");
                }}
              />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Port" required>
                <Input
                  value={form.port}
                  onChange={(e) => updateField("port", e.target.value)}
                  placeholder={form.os === "windows" ? "5985" : "22"}
                  className={inputErrorClass(fieldErrors.port)}
                />
                <FieldErrorText message={fieldErrors.port} />
              </Field>
              <Field label="Login User">
                <Input
                  value={form.sshUser}
                  onChange={(e) => updateField("sshUser", e.target.value)}
                  placeholder={form.os === "windows" ? "Administrator" : "root"}
                  className={inputErrorClass(fieldErrors.sshUser)}
                />
                <FieldErrorText message={fieldErrors.sshUser} />
              </Field>
            </div>
            {form.connectionMode === "bastion" && (
              <Field label="Bastion Host" required>
                <Input
                  value={form.bastionHost}
                  onChange={(e) => updateField("bastionHost", e.target.value)}
                  placeholder="jump-prod.internal"
                  className={inputErrorClass(fieldErrors.bastionHost)}
                />
                <FieldErrorText message={fieldErrors.bastionHost} />
              </Field>
            )}
          </div>
        );
      case "auth":
        return (
          <div className="space-y-6">
            <SectionTitle
              title="Authentication"
              description={
                form.connectionMode === "agent"
                  ? "Agent mode does not need a pre-issued token from the user. Backend will issue the token after the server record is created."
                  : "Choose the credential type that matches this node."
              }
            />
            {form.connectionMode === "agent" ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                Agent onboarding is automatic after create: FE will request an
                agent token and installation script from backend for this node.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-3">
                  <ChoiceChip
                    active={form.authMethod === "password"}
                    label="Password"
                    onClick={() => updateField("authMethod", "password")}
                  />
                  {form.os === "linux" && (
                    <ChoiceChip
                      active={form.authMethod === "ssh_key"}
                      label="SSH Key Path"
                      onClick={() => updateField("authMethod", "ssh_key")}
                    />
                  )}
                </div>
                {form.authMethod === "password" && (
                  <Field
                    label={
                      form.os === "windows"
                        ? "Password / WinRM Secret"
                        : "SSH Password"
                    }
                    required
                  >
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => updateField("password", e.target.value)}
                      placeholder="Enter secret"
                      className={inputErrorClass(fieldErrors.password)}
                    />
                    <FieldErrorText message={fieldErrors.password} />
                  </Field>
                )}
                {form.authMethod === "ssh_key" && (
                  <Field label="SSH Key Path" required>
                    <Input
                      value={form.sshKeyPath}
                      onChange={(e) =>
                        updateField("sshKeyPath", e.target.value)
                      }
                      placeholder="/home/einfra/.ssh/id_ed25519"
                      className={inputErrorClass(fieldErrors.sshKeyPath)}
                    />
                    <FieldErrorText message={fieldErrors.sshKeyPath} />
                    <p className="mt-2 text-xs text-zinc-500">
                      Backend hiện lưu `ssh_key_path`, không nhận private key
                      raw từ UI. Dùng path có sẵn trên control node hoặc agent
                      host.
                    </p>
                  </Field>
                )}
              </>
            )}
          </div>
        );
      case "privilege":
        return (
          <div className="space-y-6">
            <SectionTitle
              title="Privileges"
              description="Set the execution user used by server operations and automation."
            />
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <PrivilegeSettings
                os={form.os}
                value={form.privilege}
                onChange={(value) => updateField("privilege", value)}
              />
              <FieldErrorText
                message={fieldErrors.privilegeUser}
                className="mt-3"
              />
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-2 flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                <Activity className="h-4 w-4" />
                Ready to create
              </div>
              <ul className="space-y-1 text-zinc-600 dark:text-zinc-400">
                <li>Name: {form.name || "-"}</li>
                <li>Target: {form.ipAddress || "-"}</li>
                <li>Mode: {form.connectionMode}</li>
                <li>
                  Auth:{" "}
                  {form.connectionMode === "agent"
                    ? "agent token (issued by backend)"
                    : form.authMethod}
                </li>
              </ul>
            </div>
          </div>
        );
      case "complete":
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/30">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                <div>
                  <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">
                    Server created successfully
                  </h2>
                  <p className="text-sm text-emerald-800 dark:text-emerald-300">
                    Node is now registered in backend and ready for onboarding.
                  </p>
                </div>
              </div>
            </div>

            {result && (
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Server Summary
                  </h3>
                  <SummaryRow label="Server ID" value={result.server.id} />
                  <SummaryRow label="Name" value={result.server.name} />
                  <SummaryRow
                    label="Hostname"
                    value={result.server.hostname ?? result.server.name}
                  />
                  <SummaryRow label="Target" value={result.server.ip_address} />
                  <SummaryRow
                    label="Mode"
                    value={result.server.connection_mode ?? "agent"}
                  />
                  <SummaryRow
                    label="Onboarding Status"
                    value={result.server.onboarding_status ?? "pending"}
                  />
                  {result.server.connection_mode === "agent" && (
                    <SummaryRow
                      label="Agent Status"
                      value={
                        agentHealth?.online
                          ? "online"
                          : isCheckingStatus
                            ? "checking"
                            : "waiting for agent"
                      }
                    />
                  )}
                </div>

                <div className="space-y-5">
                  {result.token && (
                    <CopyCard
                      title="Agent Token"
                      value={result.token}
                      onCopy={copyValue}
                    />
                  )}
                  {result.installScript && (
                    <CopyCard
                      title="Install Script"
                      value={result.installScript}
                      onCopy={copyValue}
                      multiline
                    />
                  )}
                  {result.installCommand && (
                    <CopyCard
                      title="Quick Install Command"
                      value={result.installCommand}
                      onCopy={copyValue}
                    />
                  )}
                  {result.installURL && (
                    <CopyCard
                      title="Install URL"
                      value={result.installURL}
                      onCopy={copyValue}
                    />
                  )}
                </div>
              </div>
            )}

            {result?.server.connection_mode === "agent" && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-3 flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                  <Terminal className="h-4 w-4" />
                  Next step
                </div>
                <ol className="list-decimal space-y-2 pl-5 text-zinc-600 dark:text-zinc-400">
                  <li>Copy the install script.</li>
                  <li>Run it on the target node as root / Administrator.</li>
                  <li>
                    Return here and wait until Agent Status becomes `online`.
                  </li>
                </ol>
              </div>
            )}
          </div>
        );
    }
  };

  const currentStepIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <div className="mx-auto space-y-8 pb-16">
      <div className="space-y-3">
        <Link
          to="/servers"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to servers
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Add New Node
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
              This flow is mapped to the real backend. It creates the server
              record first, then optionally issues an agent token and install
              script for production-style onboarding.
            </p>
          </div>
          {result && (
            <Button
              variant="outline"
              onClick={() => navigate(`/servers/${result.server.id}/overview`)}
            >
              Open Server
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-3">
          {STEPS.map((item, index) => {
            const Icon = item.icon;
            const active = item.id === step;
            const completed = index < currentStepIndex;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!completed && !active}
                onClick={() => (completed ? setStep(item.id) : undefined)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                  active &&
                    "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-950/30 dark:text-blue-300",
                  !active &&
                    completed &&
                    "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
                  !active &&
                    !completed &&
                    "border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-600",
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-current dark:bg-zinc-900">
                  {completed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="text-xs opacity-75">Step {index + 1}</div>
                </div>
              </button>
            );
          })}
        </aside>

        <section className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {notice && (
            <OperationNotice
              type={notice.type}
              title={notice.title}
              description={notice.description}
              onClose={() => setNotice(null)}
            />
          )}

          {submitError && !notice && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
              {submitError}
            </div>
          )}

          {renderStep()}

          {step !== "complete" && (
            <div className="flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <Button
                variant="outline"
                onClick={previousStep}
                disabled={currentStepIndex === 0}
              >
                Previous
              </Button>
              <Button
                onClick={() => void nextStep()}
                isLoading={addServer.isPending || issueToken.isPending}
                disabled={!canGoNext}
              >
                {step === "privilege" ? "Create Server" : "Next"}
              </Button>
            </div>
          )}

          {step === "complete" && (
            <div className="flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <Button variant="outline" onClick={() => navigate("/servers")}>
                Back to List
              </Button>
              <Button onClick={() => window.location.reload()}>
                Add Another Node
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function resolveInstallScript(install: AgentInstallScriptDTO) {
  return install.script || install.install_script || "";
}

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function FieldErrorText({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  if (!message) {
    return null;
  }
  return (
    <p className={cn("text-xs font-medium text-red-500", className)}>
      {message}
    </p>
  );
}

function ChoiceButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-4 py-4 text-left transition-all",
        active
          ? "border-blue-500 bg-blue-50 dark:border-blue-500/50 dark:bg-blue-950/30"
          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950",
      )}
    >
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </div>
      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        {description}
      </div>
    </button>
  );
}

function ChoiceChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm transition-all",
        active
          ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-950/30 dark:text-blue-300"
          : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300",
      )}
    >
      {label}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-100 py-2 text-sm last:border-b-0 dark:border-zinc-800">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="max-w-[65%] break-all text-right font-medium text-zinc-900 dark:text-zinc-100">
        {value || "-"}
      </span>
    </div>
  );
}

function CopyCard({
  title,
  value,
  onCopy,
  multiline,
}: {
  title: string;
  value: string;
  onCopy: (value: string) => Promise<void>;
  multiline?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <Button variant="outline" size="sm" onClick={() => void onCopy(value)}>
          <Clipboard className="mr-2 h-4 w-4" />
          Copy
        </Button>
      </div>
      {multiline ? (
        <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950 p-4 text-xs text-zinc-100">
          {value}
        </pre>
      ) : (
        <div className="break-all rounded-xl bg-zinc-50 p-4 font-mono text-xs dark:bg-zinc-950 dark:text-zinc-100">
          {value}
        </div>
      )}
    </div>
  );
}

function OperationNotice({
  type,
  title,
  description,
  onClose,
}: {
  type: "success" | "error" | "info" | "warning";
  title: string;
  description?: string;
  onClose: () => void;
}) {
  const variants = {
    success: {
      icon: CheckCircle2,
      shell:
        "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200",
      iconBox:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    },
    error: {
      icon: AlertCircle,
      shell:
        "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200",
      iconBox: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    },
    warning: {
      icon: Info,
      shell:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200",
      iconBox:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    },
    info: {
      icon: Loader2,
      shell:
        "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200",
      iconBox:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    },
  };
  const variant = variants[type];
  const Icon = variant.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-4",
        variant.shell,
      )}
    >
      <div className={cn("mt-0.5 rounded-xl p-2", variant.iconBox)}>
        <Icon className={cn("h-4 w-4", type === "info" && "animate-spin")} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {description ? (
          <div className="mt-1 text-sm opacity-85">{description}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg p-1 text-current/70 transition-colors hover:bg-black/5 hover:text-current dark:hover:bg-white/5"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const message = error.message.replace(/^\[[^\]]+\]\s*/, "").trim();
    return message || "Request failed";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed";
}

function inputErrorClass(message?: string) {
  return message
    ? "border-red-300 focus-visible:ring-red-500 dark:border-red-700"
    : undefined;
}

function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const hostnameValue = (form.hostname || form.name).trim();
  const hostnameRegex = /^(?=.{1,253}$)(?!-)[a-zA-Z0-9.-]+(?<!-)$/;
  const fqdnRegex = /^(?=.{1,253}$)(?!-)[a-zA-Z0-9.-]+(?<!-)$/;
  const port = Number.parseInt(form.port, 10);

  if (!form.name.trim()) {
    errors.name = "Display name is required.";
  }
  if (!form.ipAddress.trim()) {
    errors.ipAddress = "IP or FQDN is required.";
  } else if (
    !fqdnRegex.test(form.ipAddress.trim()) &&
    !isValidIPv4(form.ipAddress.trim())
  ) {
    errors.ipAddress = "Enter a valid IPv4 address or host name.";
  }
  if (!hostnameValue) {
    errors.hostname = "Hostname is required.";
  } else if (!hostnameRegex.test(hostnameValue)) {
    errors.hostname = "Hostname contains invalid characters.";
  }
  if (!form.port.trim()) {
    errors.port = "Port is required.";
  } else if (Number.isNaN(port) || port < 1 || port > 65535) {
    errors.port = "Port must be between 1 and 65535.";
  }
  if (!form.sshUser.trim() && form.connectionMode !== "agent") {
    errors.sshUser = "Login user is required for direct access.";
  }
  if (form.connectionMode === "bastion" && !form.bastionHost.trim()) {
    errors.bastionHost = "Bastion host is required.";
  }
  if (
    form.connectionMode !== "agent" &&
    form.authMethod === "password" &&
    !form.password.trim()
  ) {
    errors.password = "Password is required.";
  }
  if (
    form.connectionMode !== "agent" &&
    form.authMethod === "ssh_key" &&
    !form.sshKeyPath.trim()
  ) {
    errors.sshKeyPath = "SSH key path is required.";
  }
  if (!form.privilege.user.trim()) {
    errors.privilegeUser = "Execution user is required.";
  }

  return errors;
}

function mapBackendFieldErrors(message: string): FieldErrors {
  const lowered = message.toLowerCase();
  const errors: FieldErrors = {};

  if (
    lowered.includes("already exists") &&
    (lowered.includes("ip") || lowered.includes("host"))
  ) {
    errors.ipAddress = "This IP or FQDN is already registered.";
  }
  if (lowered.includes("hostname")) {
    errors.hostname = "Hostname is invalid or already in use.";
  }
  if (lowered.includes("port")) {
    errors.port = "Port value is invalid.";
  }

  return errors;
}

function resolveStepForErrors(errors: FieldErrors): WizardStep {
  if (errors.name || errors.hostname || errors.ipAddress) {
    return "basic";
  }
  if (errors.port || errors.bastionHost || errors.sshUser) {
    return "connection";
  }
  if (errors.password || errors.sshKeyPath) {
    return "auth";
  }
  return "privilege";
}

function isValidIPv4(value: string) {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    const numeric = Number.parseInt(part, 10);
    return String(numeric) === part && numeric >= 0 && numeric <= 255;
  });
}
