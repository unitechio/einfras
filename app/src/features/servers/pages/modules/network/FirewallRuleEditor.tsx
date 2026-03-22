import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ShieldBan,
  Terminal,
  Copy,
  Play,
  RefreshCw,
} from "lucide-react";

import type { FirewallRule, FirewallDirection } from "@/types/firewall.types";
import { useNotification } from "@/core/NotificationContext";
import { Input } from "@/shared/ui/Input";
import { Button } from "@/shared/ui/Button";
import { iptablesApi, networkApi, serversApi, type IPTableRuleDTO } from "@/shared/api/client";

export default function FirewallRuleEditor() {
  const { serverId = "", ruleId } = useParams<{
    serverId: string;
    ruleId: string;
  }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const isEditing = !!ruleId;

  const [serverIp, setServerIp] = useState<string>("");
  const [existingRules, setExistingRules] = useState<IPTableRuleDTO[]>([]);
  const [formData, setFormData] = useState<Partial<FirewallRule>>({
    direction: "INBOUND",
    protocol: "TCP",
    port: "",
    source: "Any",
    action: "ALLOW",
    enabled: true,
    priority: 100,
    note: "",
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!serverId) return;
      setLoading(true);
      try {
        const [server, rules] = await Promise.all([
          serversApi.get(serverId),
          iptablesApi.list(serverId),
        ]);
        setServerIp(server.ip_address);
        setExistingRules(rules);
        if (ruleId) {
          const found = rules.find((rule) => rule.id === ruleId);
          if (found) {
            setFormData(mapRule(found));
          }
        }
      } catch (error) {
        showNotification({
          type: "error",
          message: "Unable to load firewall editor",
          description: error instanceof Error ? error.message : "Request failed.",
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [serverId, ruleId]);

  const duplicateRule = useMemo(() => {
    return existingRules.find((rule) => {
      if (rule.id === ruleId) return false;
      const sameDirection = (rule.chain === "OUTPUT" ? "OUTBOUND" : "INBOUND") === formData.direction;
      const sameProtocol = (rule.protocol || "ANY").toUpperCase() === formData.protocol;
      const samePort = (rule.dest_port || rule.source_port || "*") === (formData.port || "*");
      const sameTarget = (rule.source_ip || rule.dest_ip || "Any") === (formData.source || "Any");
      return sameDirection && sameProtocol && samePort && sameTarget;
    });
  }, [existingRules, formData.direction, formData.protocol, formData.port, formData.source, ruleId]);

  const handleChange = (field: keyof FirewallRule, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors([]);
    setTestResult(null);
    setTestLogs([]);
  };

  const validate = () => {
    const errs: string[] = [];
    if (
      formData.protocol !== "ICMP" &&
      formData.protocol !== "ANY" &&
      !String(formData.port || "").trim()
    ) {
      errs.push("Port is required for TCP/UDP rules.");
    }
    if (duplicateRule) {
      errs.push("A rule with the same direction, protocol, port, and target already exists.");
    }
    if (String(formData.port || "").includes(" ")) {
      errs.push("Port or range should not include spaces.");
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSave = async () => {
    if (!serverId || !validate()) return;
    setSaving(true);
    try {
      const body: Partial<IPTableRuleDTO> = {
        enabled: formData.enabled ?? true,
        chain: formData.direction === "OUTBOUND" ? "OUTPUT" : "INPUT",
        action: formData.action,
        protocol: formData.protocol === "ANY" ? "" : formData.protocol,
        dest_port: formData.protocol === "ICMP" || formData.protocol === "ANY" ? "" : String(formData.port || ""),
        source_ip: formData.source || "Any",
        position: Number(formData.priority ?? 100),
        comment: String(formData.note || ""),
      };

      if (isEditing && ruleId) {
        await iptablesApi.update(serverId, ruleId, body);
      } else {
        await iptablesApi.add(serverId, body as Omit<IPTableRuleDTO, "id" | "server_id">);
      }

      showNotification({
        type: "success",
        message: isEditing ? "Firewall rule updated" : "Firewall rule created",
        description: `${formData.direction} ${formData.protocol} ${formData.port || "*"} has been saved.`,
      });
      navigate(`/servers/${serverId}/firewall`);
    } catch (error) {
      showNotification({
        type: "error",
        message: "Unable to save firewall rule",
        description: error instanceof Error ? error.message : "Request failed.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestRule = async () => {
    if (!serverId) return;
    setIsTesting(true);
    setTestLogs([
      `> validating ${formData.direction} ${formData.protocol} ${formData.port || "*"}`,
      `> target server: ${serverIp || "unknown"}`,
    ]);
    setTestResult(null);
    try {
      if (formData.protocol === "ICMP") {
        await networkApi.check(serverId, serverIp || "127.0.0.1");
      } else if (formData.port) {
        const port = Number.parseInt(String(formData.port).split(/[,-]/)[0] || "0", 10);
        await networkApi.testPort(serverId, serverIp || "127.0.0.1", port);
      }
      setTestLogs((prev) => [...prev, "> connectivity test request accepted"]);
      setTestResult("success");
      showNotification({
        type: "success",
        message: "Connectivity test queued",
        description: "Firewall verification was sent to the backend using the current server IP.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test failed.";
      setTestLogs((prev) => [...prev, `> ${message}`]);
      setTestResult("error");
      showNotification({
        type: "error",
        message: "Connectivity test failed",
        description: message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const isDangerous =
    formData.direction === "INBOUND" &&
    (formData.action === "DENY" || formData.action === "REJECT") &&
    (formData.port === "22" || formData.protocol === "ANY") &&
    formData.source === "Any";

  const generateCommand = () => {
    const chain = formData.direction === "INBOUND" ? "INPUT" : "OUTPUT";
    const proto =
      formData.protocol !== "ANY"
        ? `-p ${String(formData.protocol).toLowerCase()}`
        : "";
    const port =
      (formData.protocol === "TCP" || formData.protocol === "UDP") && formData.port
        ? `--dport ${formData.port}`
        : "";
    const src =
      formData.source && formData.source !== "Any"
        ? `-s ${formData.source}`
        : "";
    const jump = formData.action === "ALLOW" ? "ACCEPT" : formData.action;
    return `iptables -A ${chain} ${proto} ${port} ${src} -j ${jump}`.replace(/\s+/g, " ").trim();
  };

  const generateTestCommand = () => {
    if (formData.protocol === "TCP" && formData.port) {
      const port = String(formData.port).split(/[,-]/)[0];
      return `nc -zv ${serverIp || "<server_ip>"} ${port}`;
    }
    if (formData.protocol === "ICMP") {
      return `ping ${serverIp || "<server_ip>"}`;
    }
    return `nc -zv ${serverIp || "<server_ip>"} <port>`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-zinc-500 dark:text-zinc-400">
        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
        Loading firewall editor...
      </div>
    );
  }

  return (
    <div className="mx-auto space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          size="icon"
          className="border-transparent hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {isEditing ? "Edit Firewall Rule" : "Add Firewall Rule"}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Rule configuration</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Create inbound or outbound rule and validate it before apply.
                </div>
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Server IP: <span className="font-mono text-zinc-700 dark:text-zinc-300">{serverIp || "unknown"}</span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-zinc-700 dark:text-zinc-300">Direction</label>
                  <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
                    {(["INBOUND", "OUTBOUND"] as FirewallDirection[]).map((dir) => (
                      <button
                        key={dir}
                        onClick={() => handleChange("direction", dir)}
                        className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${
                          formData.direction === dir
                            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                            : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-white"
                        }`}
                      >
                        {dir}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">Action</label>
                  <div className="flex gap-2">
                    {[
                      { val: "ALLOW", icon: ShieldCheck, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/20", border: "border-green-200 dark:border-green-800" },
                      { val: "REJECT", icon: ShieldAlert, color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-800" },
                      { val: "DENY", icon: ShieldBan, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/20", border: "border-red-200 dark:border-red-800" },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => handleChange("action", opt.val)}
                        className={`flex-1 rounded-xl border px-3 py-2 transition-all ${
                          formData.action === opt.val
                            ? `${opt.bg} ${opt.border} ${opt.color} ring-2 ring-current ring-offset-2 dark:ring-offset-zinc-900`
                            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <opt.icon size={16} />
                          <span className="font-bold text-sm">{opt.val}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">Protocol</label>
                  <select
                    value={formData.protocol}
                    onChange={(e) => handleChange("protocol", e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-950 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100 dark:focus:ring-zinc-300"
                  >
                    <option value="TCP">TCP</option>
                    <option value="UDP">UDP</option>
                    <option value="ICMP">ICMP</option>
                    <option value="ANY">ANY</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                    Port / Range
                    <span className="ml-2 text-[11px] font-medium text-zinc-500">22, 443, 8000-8080</span>
                  </label>
                  <Input
                    type="text"
                    disabled={formData.protocol === "ICMP" || formData.protocol === "ANY"}
                    value={String(formData.port || "")}
                    onChange={(e) => handleChange("port", e.target.value)}
                    placeholder={formData.protocol === "ANY" ? "All Ports" : "e.g. 80, 443"}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
                  {formData.direction === "INBOUND" ? "Source" : "Destination"}
                </label>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <select
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-950 dark:border-zinc-800 dark:bg-[#121212] dark:text-zinc-100 dark:focus:ring-zinc-300"
                    onChange={(e) => handleChange("source", e.target.value === "Custom" ? "" : e.target.value)}
                    value={["Any", "192.168.1.0/24"].includes(String(formData.source || "")) ? String(formData.source || "Any") : "Custom"}
                  >
                    <option value="Any">Any (0.0.0.0/0)</option>
                    <option value="192.168.1.0/24">Local Network</option>
                    <option value="Custom">Custom IP/CIDR</option>
                  </select>
                  <div className="md:col-span-2">
                    <Input
                      type="text"
                      value={String(formData.source || "")}
                      onChange={(e) => handleChange("source", e.target.value)}
                      placeholder="0.0.0.0/0"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">Note</label>
                <Input
                  type="text"
                  value={String(formData.note || "")}
                  onChange={(e) => handleChange("note", e.target.value)}
                  placeholder="Why this rule exists"
                  className="w-full"
                />
              </div>

              {duplicateRule ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  A matching rule already exists in this firewall set. Review the current rules before adding another duplicate.
                </div>
              ) : null}

              {isDangerous ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                  <div className="flex gap-4">
                    <AlertTriangle className="mt-1 shrink-0 text-red-600" />
                    <div>
                      <h4 className="font-bold text-red-700 dark:text-red-400">Potential Lockout Risk</h4>
                      <p className="mt-1 text-sm text-red-600 dark:text-red-300">
                        This rule can block SSH or broad inbound access from any source. Make sure you already have a safe allow rule in place.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {errors.length > 0 ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                  <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-300">
                    {errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="flex justify-end gap-3 pt-4 text-sm">
                <Button variant="outline" onClick={() => navigate(-1)} className="border-transparent">
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
                  {saving ? <RefreshCw size={16} className="mr-1.5 animate-spin" /> : <Save size={16} className="mr-1.5" />}
                  Save Rule
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="sticky top-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Terminal size={18} />
              <h3 className="text-sm font-bold uppercase tracking-wider">Command Preview</h3>
            </div>

            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-zinc-500">Apply Command</label>
                <div className="group relative break-all rounded-xl bg-black/70 p-3 font-mono text-sm text-green-400">
                  {generateCommand()}
                  <button
                    onClick={() => navigator.clipboard.writeText(generateCommand())}
                    className="absolute right-2 top-2 rounded bg-zinc-100 p-1.5 text-zinc-600 opacity-0 transition-opacity hover:text-zinc-900 group-hover:opacity-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-white"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase text-zinc-500">Verify / Test</label>
                <div className="group relative break-all rounded-xl bg-black/70 p-3 font-mono text-sm text-blue-400">
                  {generateTestCommand()}
                  <button
                    onClick={() => navigator.clipboard.writeText(generateTestCommand())}
                    className="absolute right-2 top-2 rounded bg-zinc-100 p-1.5 text-zinc-600 opacity-0 transition-opacity hover:text-zinc-900 group-hover:opacity-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-white"
                  >
                    <Copy size={12} />
                  </button>
                </div>

                <Button
                  onClick={() => void handleTestRule()}
                  disabled={isTesting}
                  variant="outline"
                  className="mt-4 w-full border-zinc-300 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw size={16} className="mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Play size={16} className="mr-2" />
                      Run Connectivity Test
                    </>
                  )}
                </Button>
              </div>

              {(testLogs.length > 0 || isTesting) ? (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <label className="mb-2 flex justify-between text-xs font-bold uppercase text-zinc-500">
                    Test Logs
                    {testResult ? (
                      <span className={testResult === "success" ? "text-green-500" : "text-red-500"}>
                        {testResult === "success" ? "PASSED" : "FAILED"}
                      </span>
                    ) : null}
                  </label>
                  <div className="h-40 overflow-y-auto rounded-xl border border-zinc-200 bg-black p-3 font-mono text-xs text-zinc-300 dark:border-zinc-800">
                    {testLogs.map((log, i) => (
                      <div key={i} className="mb-1 break-all">
                        <span className="mr-2 text-zinc-600">$</span>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function mapRule(rule: IPTableRuleDTO): Partial<FirewallRule> {
  return {
    id: rule.id,
    direction: rule.chain === "OUTPUT" ? "OUTBOUND" : "INBOUND",
    protocol: ((rule.protocol || "ANY").toUpperCase() as FirewallRule["protocol"]) || "ANY",
    port: rule.dest_port || rule.source_port || "",
    source: rule.source_ip || rule.dest_ip || "Any",
    action: (rule.action as FirewallRule["action"]) || "ALLOW",
    enabled: rule.enabled ?? true,
    priority: rule.position ?? 100,
    note: rule.comment || rule.description || "",
  };
}
