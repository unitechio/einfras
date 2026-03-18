import { useState, useEffect } from "react";
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
} from "lucide-react";
import type { FirewallRule, FirewallDirection } from "@/types/firewall.types";
import { mockFirewallService } from "../shared/mockFirewallService";
import { useNotification } from "@/core/NotificationContext";

export default function FirewallRuleEditor() {
  const { serverId, ruleId } = useParams<{
    serverId: string;
    ruleId: string;
  }>();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const isEditing = !!ruleId;

  const [formData, setFormData] = useState<Partial<FirewallRule>>({
    direction: "INBOUND",
    protocol: "TCP",
    port: "",
    source: "Any",
    action: "ALLOW",
    enabled: true,
    priority: 100, // Default for new rules
    note: "",
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null,
  );

  useEffect(() => {
    if (isEditing) {
      mockFirewallService.getRule(ruleId).then((rule) => {
        if (rule) setFormData(rule);
      });
    }
  }, [isEditing, ruleId]);

  const handleChange = (field: keyof FirewallRule, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear errors on change
    if (errors.length > 0) setErrors([]);
    // Clear test results on change
    if (testResult) {
      setTestResult(null);
      setTestLogs([]);
    }
  };

  const validate = () => {
    const errs: string[] = [];

    // Port validation
    if (
      formData.protocol !== "ICMP" &&
      formData.protocol !== "ANY" &&
      !formData.port
    ) {
      errs.push("Port is required for TCP/UDP protocols");
    }

    // Dangerous rule checks
    if (
      formData.direction === "INBOUND" &&
      formData.action === "DENY" &&
      formData.source === "Any"
    ) {
      if (formData.port === "22" || formData.protocol === "ANY") {
        // Warning handled in UI
      }
    }

    setErrors(errs);
    return errs.length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    await mockFirewallService.saveRule(formData);
    navigate(`/servers/${serverId}/firewall`);
  };

  const handleTestRule = async () => {
    setIsTesting(true);
    setTestLogs([
      "> Initializing connectivity test agent...",
      "> Preparing clean environment...",
    ]);
    setTestResult(null);

    try {
      const result = await mockFirewallService.testRuleConnectivity(formData);
      setTestLogs((prev) => [...prev, ...result.logs]);
      setTestResult(result.success ? "success" : "error");

      showNotification({
        type: result.success ? "success" : "error",
        message: result.success
          ? "Connectivity Test Passed"
          : "Connectivity Test Failed",
        description: `Traffic was ${result.success ? "Allowed" : "Blocked"} as expected by the rule definition.`,
      });
    } catch (err) {
      showNotification({ type: "error", message: "Test execution failed" });
    } finally {
      setIsTesting(false);
    }
  };

  const isDangerous =
    formData.direction === "INBOUND" &&
    (formData.action === "DENY" || formData.action === "REJECT") &&
    (formData.port === "22" || formData.protocol === "ANY") &&
    formData.source === "Any";

  // Command Generation Logic
  const generateCommand = () => {
    const chain = formData.direction === "INBOUND" ? "INPUT" : "OUTPUT";
    const proto =
      formData.protocol !== "ANY"
        ? `-p ${formData.protocol?.toLowerCase()}`
        : "";
    const port =
      (formData.protocol === "TCP" || formData.protocol === "UDP") &&
      formData.port
        ? `--dport ${formData.port}`
        : "";
    const src =
      formData.source && formData.source !== "Any"
        ? `-s ${formData.source}`
        : "";
    const jump = formData.action === "ALLOW" ? "ACCEPT" : formData.action; // REJECT is valid in iptables

    return `iptables -A ${chain} ${proto} ${port} ${src} -j ${jump}`
      .replace(/\s+/g, " ")
      .trim();
  };

  const generateTestCommand = () => {
    if (formData.protocol === "TCP" && formData.port) {
      // Pick first port if range or list
      const p = formData.port.split(/[,-]/)[0];
      return `nc -zv <server_ip> ${p}`;
    }
    if (formData.protocol === "ICMP") {
      return `ping <server_ip>`;
    }
    return "# Cannot auto-generate test command for this rule";
  };

  return (
    <div className="mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-sm transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {isEditing ? "Edit Firewall Rule" : "Add Firewall Rule"}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm space-y-8">
            {/* ID & Status (Read-only / Toggle) */}
            <div className="flex justify-between items-start">
              <div>
                <label className="block text-sm font-bold text-zinc-500 mb-1">
                  Status
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleChange("enabled", !formData.enabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${formData.enabled ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
                  >
                    <div
                      className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.enabled ? "translate-x-6" : ""}`}
                    />
                  </button>
                  <span className="text-sm font-medium">
                    {formData.enabled ? "Enabled" : "Disabled (Skip)"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Direction */}
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Direction
                </label>
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-sm">
                  {(["INBOUND", "OUTBOUND"] as FirewallDirection[]).map(
                    (dir) => (
                      <button
                        key={dir}
                        onClick={() => handleChange("direction", dir)}
                        className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
                          formData.direction === dir
                            ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white"
                            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        }`}
                      >
                        {dir}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Action */}
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Action
                </label>
                <div className="flex gap-2">
                  {[
                    {
                      val: "ALLOW",
                      icon: ShieldCheck,
                      color: "text-green-600",
                      bg: "bg-green-100 dark:bg-green-900/20",
                      border: "border-green-200 dark:border-green-800",
                    },
                    {
                      val: "REJECT",
                      icon: ShieldAlert,
                      color: "text-orange-600",
                      bg: "bg-orange-100 dark:bg-orange-900/20",
                      border: "border-orange-200 dark:border-orange-800",
                    },
                    {
                      val: "DENY",
                      icon: ShieldBan,
                      color: "text-red-600",
                      bg: "bg-red-100 dark:bg-red-900/20",
                      border: "border-red-200 dark:border-red-800",
                    },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => handleChange("action", opt.val)}
                      className={`flex-1 py-2 px-3 rounded-sm border flex items-center justify-center gap-2 transition-all ${
                        formData.action === opt.val
                          ? `${opt.bg} ${opt.border} ${opt.color} ring-2 ring-offset-2 dark:ring-offset-zinc-900 ring-current`
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <opt.icon size={16} />
                      <span className="font-bold text-sm">{opt.val}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Protocol & Port */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Protocol
                </label>
                <select
                  value={formData.protocol}
                  onChange={(e) => handleChange("protocol", e.target.value)}
                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-sm px-3 py-2 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="TCP">TCP</option>
                  <option value="UDP">UDP</option>
                  <option value="ICMP">ICMP (Ping)</option>
                  <option value="ANY">Any / All</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Port / Range
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    e.g. 22, 80, 443, 8000-9000
                  </span>
                </label>
                <input
                  type="text"
                  disabled={
                    formData.protocol === "ICMP" || formData.protocol === "ANY"
                  }
                  value={formData.port}
                  onChange={(e) => handleChange("port", e.target.value)}
                  placeholder={
                    formData.protocol === "ANY" ? "All Ports" : "e.g. 80, 443"
                  }
                  className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-sm px-3 py-2 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-zinc-100 dark:disabled:bg-zinc-800/50 disabled:text-zinc-400"
                />
              </div>
            </div>

            {/* Source / Destination */}
            <div>
              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                {formData.direction === "INBOUND" ? "Source" : "Destination"}
                <span className="ml-2 text-xs font-normal text-zinc-500">
                  IP, CIDR, or "Any"
                </span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <select
                  className="md:col-span-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-sm px-3 py-2 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  onChange={(e) =>
                    handleChange(
                      "source",
                      e.target.value === "Custom" ? "" : e.target.value,
                    )
                  }
                  value={
                    ["Any", "192.168.1.0/24"].includes(formData.source || "")
                      ? formData.source
                      : "Custom"
                  }
                >
                  <option value="Any">Any (0.0.0.0/0)</option>
                  <option value="192.168.1.0/24">Local Network</option>
                  <option value="Custom">Custom IP/CIDR</option>
                </select>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => handleChange("source", e.target.value)}
                  placeholder="0.0.0.0/0"
                  className="md:col-span-2 flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-sm px-3 py-2 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                Note (Optional)
              </label>
              <input
                type="text"
                value={formData.note || ""}
                onChange={(e) => handleChange("note", e.target.value)}
                placeholder="Why is this rule here?"
                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-sm px-3 py-2 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Warning for Dangerous Rules */}
            {isDangerous && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-sm p-4 flex gap-4 items-start">
                <AlertTriangle className="text-red-600 shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-red-700 dark:text-red-400">
                    Potential Lockout Risk
                  </h4>
                  <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                    You are about to block connection to SSH or All Ports from
                    Any source. Ensure you have another ALLOW rule with higher
                    priority, or you may lock yourself out of the server.
                  </p>
                </div>
              </div>
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-300">
                  {errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 flex justify-end gap-3 text-sm">
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-2 rounded-sm text-zinc-600 dark:text-zinc-400 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 rounded-sm bg-gray-200 hover:bg-gray-300 text-gray-800 inset-shadow-gray-50 cursor-pointer transition-all active:scale-95 flex items-center gap-2"
              >
                <Save size={18} />
                Save Rule
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Command Preview & Test */}
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-6 shadow-sm sticky top-6">
            <div className="flex items-center gap-2 mb-4 text-zinc-400">
              <Terminal size={18} />
              <h3 className="font-bold text-sm uppercase tracking-wider">
                Command Preview
              </h3>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase">
                  Apply Command
                </label>
                <div className="bg-black/50 rounded-sm p-3 font-mono text-sm text-green-400 break-all relative group">
                  {generateCommand()}
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(generateCommand())
                    }
                    className="absolute top-2 right-2 p-1.5 bg-zinc-800 cursor-pointer hover:cursor-pointer rounded text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase">
                  Verify / Test
                </label>
                <div className="bg-black/50 rounded-sm p-3 font-mono text-sm text-blue-400 break-all relative group">
                  {generateTestCommand()}
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(generateTestCommand())
                    }
                    className="absolute top-2 right-2 p-1.5 bg-zinc-800 rounded text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Copy size={12} />
                  </button>
                </div>

                {/* Test Button */}
                <button
                  onClick={handleTestRule}
                  disabled={isTesting}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-400 text-black rounded-md py-2 text-sm transition-all"
                >
                  {isTesting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Testing...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Run Connectivity Test
                    </>
                  )}
                </button>
              </div>

              {/* Test Log Output */}
              {(testLogs.length > 0 || isTesting) && (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                  <label className="block text-xs font-bold text-zinc-500 mb-2 uppercase flex justify-between">
                    Test Logs
                    {testResult && (
                      <span
                        className={
                          testResult === "success"
                            ? "text-green-500"
                            : "text-red-500"
                        }
                      >
                        {testResult === "success" ? "PASSED" : "BLOCKED"}
                      </span>
                    )}
                  </label>
                  <div className="bg-black rounded-sm p-3 font-mono text-xs text-zinc-300 h-40 overflow-y-auto border border-zinc-800">
                    {testLogs.map((log, i) => (
                      <div key={i} className="mb-1 break-all">
                        <span className="text-zinc-600 mr-2">$</span>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
