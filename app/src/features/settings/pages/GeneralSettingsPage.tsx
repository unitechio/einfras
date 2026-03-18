"use client";

import { useState } from "react";
import { Settings as SettingsIcon, AlertTriangle, Upload, Download, Briefcase, Shield, Lock, Key, Database, Cloud, Globe } from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/Table";
import { Badge } from "@/shared/ui/Badge";

export default function GeneralSettingsPage() {
  const { showNotification } = useNotification();

  // Application Settings State
  const [snapshotInterval, setSnapshotInterval] = useState("5m");
  const [pollFrequency, setPollFrequency] = useState("5 seconds");
  const [useCustomLogo, setUseCustomLogo] = useState(false);
  const [allowAnonymousStats, setAllowAnonymousStats] = useState(true);
  const [loginBanner, setLoginBanner] = useState(false);
  const [appTemplatesUrl, setAppTemplatesUrl] = useState("https://raw.githubusercontent.com/portainer/templates/master/templates.json");

  // Kubernetes Settings State
  const [helmRepoUrl, setHelmRepoUrl] = useState("https://charts.bitnami.com/bitnami");
  const [kubeconfigExpiry, setKubeconfigExpiry] = useState("No expiry");
  const [enforceCodeDeployment, setEnforceCodeDeployment] = useState(false);
  const [requireNote, setRequireNote] = useState(false);
  const [allowStacks, setAllowStacks] = useState(true);

  // SSL Settings State
  const [forceHttps, setForceHttps] = useState(false);

  // Hidden Containers State
  const [filterName, setFilterName] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [filters, setFilters] = useState<Array<{ name: string; value: string }>>([]);

  // Backup Settings State
  const [backupOption, setBackupOption] = useState<"download" | "s3">("download");
  const [passwordProtect, setPasswordProtect] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");

  const handleSave = (section: string) => {
    showNotification({ type: "success", message: `${section} saved`, description: `Your changes to ${section.toLowerCase()} have been applied successfully.` });
  };

  const handleAddFilter = () => {
    if (!filterName.trim()) {
      showNotification({ type: "error", message: "Name required", description: "Filter name cannot be empty." });
      return;
    }
    setFilters([...filters, { name: filterName, value: filterValue }]);
    setFilterName(""); setFilterValue("");
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleDownloadBackup = () => {
    if (passwordProtect && !backupPassword) {
      showNotification({ type: "error", message: "Password required", description: "Please enter a backup password." });
      return;
    }
    showNotification({ type: "info", message: "Preparing backup", description: "Your export is being generated..." });
  };

  const Switch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button type="button" onClick={onChange} className={cn("relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2", checked ? "bg-indigo-600" : "bg-zinc-200 dark:bg-zinc-700")}>
      <span className={cn("pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out", checked ? "translate-x-4" : "translate-x-0")} />
    </button>
  );

  const Section = ({ title, icon: Icon, children, badge }: { title: string, icon: any, children: React.ReactNode, badge?: string }) => (
    <div className="bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden mb-6 filter drop-shadow-sm">
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 flex items-center gap-3">
        <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg">
          <Icon size={18} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        {badge && <Badge variant="outline" className="ml-auto flex items-center gap-1.5 bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-500 dark:border-yellow-500/20"><Briefcase size={12}/>{badge}</Badge>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );

  const SettingRow = ({ label, description, children, businessFeature }: any) => (
    <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 last:pb-0 first:pt-0">
      <div className="flex-1 pr-6">
        <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          {label}
          {businessFeature && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20">Pro</Badge>}
        </label>
        {description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{description}</p>}
      </div>
      <div className="sm:w-80 flex-shrink-0">
        {children}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-indigo-500" />
            General Settings
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage global configuration for your instance.</p>
        </div>
      </div>

      <Section title="Application Settings" icon={Globe}>
        <div className="space-y-2">
          <SettingRow label="Snapshot interval" description="How often environments are polled for status updates.">
            <Input value={snapshotInterval} onChange={e => setSnapshotInterval(e.target.value)} />
          </SettingRow>
          <SettingRow label="Edge agent poll frequency" description="Default interval for edge agents to phone home.">
            <select value={pollFrequency} onChange={e => setPollFrequency(e.target.value)} className="w-full h-10 px-3 py-2 bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow">
              <option>5 seconds</option><option>10 seconds</option><option>30 seconds</option><option>1 minute</option>
            </select>
          </SettingRow>
          <SettingRow label="Custom Logo" description="Replace the default brand logo across the application." businessFeature>
            <div className="flex items-center justify-end"><Switch checked={useCustomLogo} onChange={() => setUseCustomLogo(!useCustomLogo)} /></div>
          </SettingRow>
          <SettingRow label="Anonymous Statistics" description="Help us improve by sending anonymous usage data.">
            <div className="flex items-center justify-end"><Switch checked={allowAnonymousStats} onChange={() => setAllowAnonymousStats(!allowAnonymousStats)} /></div>
          </SettingRow>
          <SettingRow label="Login Screen Banner" description="Display an informational message on the login screen." businessFeature>
            <div className="flex items-center justify-end"><Switch checked={loginBanner} onChange={() => setLoginBanner(!loginBanner)} /></div>
          </SettingRow>
          <SettingRow label="App Templates URL" description="Provide a custom registry JSON for one-click templates.">
            <Input value={appTemplatesUrl} onChange={e => setAppTemplatesUrl(e.target.value)} />
          </SettingRow>
        </div>
        <div className="mt-8 flex justify-end">
          <Button variant="primary" onClick={() => handleSave("Application Settings")}>Save Application Settings</Button>
        </div>
      </Section>

      <Section title="Kubernetes Configuration" icon={Database}>
        <div className="space-y-2">
          <SettingRow label="Global Helm Repository" description="Default repository for deploying charts.">
            <Input value={helmRepoUrl} onChange={e => setHelmRepoUrl(e.target.value)} />
          </SettingRow>
          <SettingRow label="Kubeconfig Expiry" description="Maximum lifetime for user-downloaded kubeconfig files.">
            <select value={kubeconfigExpiry} onChange={e => setKubeconfigExpiry(e.target.value)} className="w-full h-10 px-3 py-2 bg-white dark:bg-[#121212] border border-zinc-200 dark:border-zinc-800 rounded-md text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow">
              <option>No expiry</option><option>1 hour</option><option>1 day</option><option>7 days</option><option>30 days</option>
            </select>
          </SettingRow>
          <SettingRow label="Enforce GitOps" description="Prevent UI-based deployments, demanding code-based configs." businessFeature>
            <div className="flex items-center justify-end"><Switch checked={enforceCodeDeployment} onChange={() => setEnforceCodeDeployment(!enforceCodeDeployment)} /></div>
          </SettingRow>
          <SettingRow label="Require Change Notes" description="Mandate a reason when applications are updated." businessFeature>
            <div className="flex items-center justify-end"><Switch checked={requireNote} onChange={() => setRequireNote(!requireNote)} /></div>
          </SettingRow>
          <SettingRow label="Enable K8s Stacks" description="Allow stack functionality via Custom Resource Definitions.">
            <div className="flex items-center justify-end"><Switch checked={allowStacks} onChange={() => setAllowStacks(!allowStacks)} /></div>
          </SettingRow>
        </div>
        <div className="mt-8 flex justify-end">
          <Button variant="primary" onClick={() => handleSave("Kubernetes Settings")}>Save Kubernetes Settings</Button>
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="Helm CA Certificates" icon={Key} badge="Business">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">Provide additional Certificate Authority (CA) files for establishing trusted TLS connections to private Helm repositories.</p>
          <div className="space-y-4">
            <div className="border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900/20 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group">
              <Upload className="h-8 w-8 text-zinc-400 group-hover:text-indigo-500 mb-2 transition-colors" />
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Click to Select File</p>
              <p className="text-xs text-zinc-500 mt-1">.pem, .crt, or .cer extensions supported</p>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="outline" onClick={() => handleSave("CA Certificates")}>Upload & Apply</Button>
          </div>
        </Section>

        <Section title="SSL Certificates" icon={Lock}>
          <div className="flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg mb-6">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">Forcing HTTPS will instantly close HTTP ports. Edge agents relying on HTTP connections will be disconnected entirely.</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Force HTTPS Only</span>
              <Switch checked={forceHttps} onChange={() => setForceHttps(!forceHttps)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-md p-3 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <Upload size={16} className="text-zinc-400 mb-1" />
                <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">Upload Cert</span>
              </div>
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-md p-3 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <Upload size={16} className="text-zinc-400 mb-1" />
                <span className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">Upload Key</span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button variant="primary" onClick={() => handleSave("SSL Settings")}>Save SSL Config</Button>
          </div>
        </Section>
      </div>

      <Section title="Hidden Containers via Labels" icon={Shield}>
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Specify label keys/values to globally hide specific containers from lists in the UI.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Label Key <span className="text-red-500">*</span></label>
                <Input placeholder="com.example.system" value={filterName} onChange={e => setFilterName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Label Value</label>
                <Input placeholder="true" value={filterValue} onChange={e => setFilterValue(e.target.value)} />
              </div>
            </div>
            <Button variant="outline" onClick={handleAddFilter}>Add Label Filter</Button>
          </div>

          <div className="flex-1 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden flex flex-col max-h-64">
             <div className="flex-1 overflow-y-auto">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead className="py-2.5">Label Key</TableHead>
                     <TableHead className="py-2.5">Value</TableHead>
                     <TableHead className="py-2.5 w-16 text-right"></TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {filters.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={3} className="text-center py-6 text-zinc-500 dark:text-zinc-400 text-xs">No filters defined.</TableCell>
                     </TableRow>
                   ) : (
                     filters.map((f, i) => (
                       <TableRow key={i}>
                         <TableCell className="py-2 font-mono text-xs">{f.name}</TableCell>
                         <TableCell className="py-2 font-mono text-xs text-zinc-500">{f.value || '*'}</TableCell>
                         <TableCell className="py-2 text-right">
                           <button onClick={()=>removeFilter(i)} className="text-zinc-400 hover:text-red-500 transition-colors text-xs font-medium">Remove</button>
                         </TableCell>
                       </TableRow>
                     ))
                   )}
                 </TableBody>
               </Table>
             </div>
          </div>
        </div>
      </Section>

      <Section title="System Backup" icon={Download}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Export Configuration</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">Generate a complete archive of your system configuration, environments, and RBAC rules. Note: Container volumes and images are not included.</p>
            
            <div className="grid grid-cols-2 gap-4 max-w-xl">
               <div onClick={() => setBackupOption("download")} className={cn("border rounded-xl p-5 cursor-pointer transition-all flex flex-col", backupOption === "download" ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10 ring-1 ring-indigo-500" : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-[#121212]")}>
                 <div className="flex justify-between items-start mb-3">
                   <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400"><Download size={18}/></div>
                   {backupOption === "download" && <div className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center"><div className="w-2 h-2 bg-white rounded-full"/></div>}
                 </div>
                 <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Local Download</h4>
                 <p className="text-xs text-zinc-500 mt-1">Export as a tar.gz archive.</p>
               </div>
               
               <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-zinc-50 dark:bg-zinc-900/20 opacity-60 cursor-not-allowed flex flex-col">
                 <div className="flex justify-between items-start mb-3">
                   <div className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg text-zinc-500"><Cloud size={18}/></div>
                   <Badge variant="outline" className="text-[10px] h-4 leading-none">Pro</Badge>
                 </div>
                 <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-300">S3 Storage</h4>
                 <p className="text-xs text-zinc-500 mt-1">Automated remote backups.</p>
               </div>
            </div>
          </div>

          <div className="bg-zinc-50 dark:bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flexItems-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Lock size={14} className="text-indigo-500"/> Password Protection
                </h4>
                <Switch checked={passwordProtect} onChange={() => setPasswordProtect(!passwordProtect)} />
              </div>
              <div className={cn("transition-all duration-300 overflow-hidden", passwordProtect ? "max-h-24 opacity-100" : "max-h-0 opacity-0")}>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Encryption Password</label>
                <Input type="password" placeholder="Enter secure password" value={backupPassword} onChange={e => setBackupPassword(e.target.value)} />
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
              <Button variant="primary" onClick={handleDownloadBackup} className="w-full justify-center">
                Generate Backup Archive
              </Button>
            </div>
          </div>
        </div>
      </Section>

    </div>
  );
}
