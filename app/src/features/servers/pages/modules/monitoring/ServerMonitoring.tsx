import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  mockSecurityService,
  type ServerAlert,
} from "../shared/mockServerService";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  HardDrive,
  Cpu,
  Activity,
  Server as ServerIcon,
  LineChart
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

export default function ServerMonitoring() {
  const [alerts, setAlerts] = useState<ServerAlert[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "alerts">("overview");

  // Mock Realtime Data - In production this would be a stream/websocket
  const data = [
    { name: "10:00", cpu: 12, ram: 24, net: 5 },
    { name: "10:05", cpu: 15, ram: 25, net: 8 },
    { name: "10:10", cpu: 45, ram: 30, net: 25 },
    { name: "10:15", cpu: 32, ram: 28, net: 15 },
    { name: "10:20", cpu: 25, ram: 26, net: 12 },
    { name: "10:25", cpu: 18, ram: 25, net: 8 },
    { name: "10:30", cpu: 15, ram: 25, net: 6 },
  ];

  const diskData = [
    { name: "/", used: 45, total: 100 },
    { name: "/var", used: 28, total: 50 },
    { name: "/home", used: 12, total: 200 },
    { name: "/mnt/backup", used: 85, total: 500 },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const alertData = await mockSecurityService.getAlerts();
    setAlerts(alertData);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-100/50 dark:border-purple-500/20">
              <LineChart className="text-purple-500" size={20} />
            </div>
            System Monitoring
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-[13px] mt-2">
            Realtime track resource usage and system health.
          </p>
        </div>
        <div className="flex bg-zinc-100/50 dark:bg-[#121212] p-1.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800/60 shadow-sm">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-1.5 text-[13px] font-semibold rounded-md transition-all cursor-pointer ${activeTab === "overview" ? "bg-white dark:bg-[#2A2A2A] shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("alerts")}
            className={`px-4 py-1.5 text-[13px] font-semibold rounded-md transition-all cursor-pointer ${activeTab === "alerts" ? "bg-white dark:bg-[#2A2A2A] shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"}`}
          >
            Alerts
          </button>
        </div>
      </div>

      {activeTab === "overview" ? (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard
              icon={Cpu}
              label="CPU Load"
              value="15%"
              status="normal"
            />
            <MetricCard
              icon={Activity}
              label="Memory"
              value="4.2 GB"
              subValue="/ 16 GB"
              status="normal"
            />
            <MetricCard
              icon={HardDrive}
              label="Disk I/O"
              value="12 MB/s"
              status="warning"
            />
            <MetricCard
              icon={ServerIcon}
              label="Uptime"
              value="15d 2h"
              status="good"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <ChartCard title="CPU Usage History">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#09090b" stopOpacity={0.2} className="dark:stopColor-[#fafafa]" />
                    <stop offset="95%" stopColor="#09090b" stopOpacity={0} className="dark:stopColor-[#fafafa]" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.15} vertical={false} />
                <XAxis dataKey="name" fontSize={11} stroke="#888" tickLine={false} axisLine={false} dy={10} />
                <YAxis fontSize={11} stroke="#888" tickLine={false} axisLine={false} dx={-10} tickFormatter={(val) => `${val}%`} />
                <Tooltip
                  cursor={{ stroke: '#888', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e4e4e7', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#09090b', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="cpu" stroke="#09090b" className="dark:stroke-white" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" />
              </AreaChart>
            </ChartCard>

            <ChartCard title="Memory Usage">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#09090b" stopOpacity={0.2} className="dark:stopColor-[#fafafa]" />
                    <stop offset="95%" stopColor="#09090b" stopOpacity={0} className="dark:stopColor-[#fafafa]" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.15} vertical={false} />
                <XAxis dataKey="name" fontSize={11} stroke="#888" tickLine={false} axisLine={false} dy={10} />
                <YAxis fontSize={11} stroke="#888" tickLine={false} axisLine={false} dx={-10} tickFormatter={(val) => `${val}%`} />
                <Tooltip
                  cursor={{ stroke: '#888', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e4e4e7', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#09090b', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="ram" stroke="#09090b" className="dark:stroke-white" strokeWidth={2} fillOpacity={1} fill="url(#colorRam)" />
              </AreaChart>
            </ChartCard>

            <ChartCard title="Network I/O">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorNetIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.15} vertical={false} />
                <XAxis dataKey="name" fontSize={11} stroke="#888" tickLine={false} axisLine={false} dy={10} />
                <YAxis fontSize={11} stroke="#888" tickLine={false} axisLine={false} dx={-10} />
                <Tooltip
                  cursor={{ stroke: '#888', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e4e4e7', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#09090b', fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorNetIn)" />
              </AreaChart>
            </ChartCard>

            <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-[15px] tracking-tight text-zinc-900 dark:text-zinc-50 mb-6">
                Disk Usage per Mount
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={diskData} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.15} horizontal={false} />
                    <XAxis type="number" fontSize={11} stroke="#888" tickLine={false} axisLine={false} dx={10} />
                    <YAxis dataKey="name" type="category" width={80} fontSize={11} stroke="#888" tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#e4e4e7', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#09090b', fontWeight: 600 }}
                    />
                    <Bar dataKey="used" fill="#09090b" className="dark:fill-white" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-sm flex items-start gap-3">
            <AlertTriangle
              className="text-blue-600 dark:text-blue-400 mt-0.5"
              size={20}
            />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                Configure Alerts
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Set up thresholds to receive notifications when resource usage
                spikes or services fail.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Security / Alert Config Mock UI */}
            <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
              <h3 className="font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-6">New Alert Rule</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
                    Resource
                  </label>
                  <select className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-[#121212] dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300 font-medium text-zinc-900 dark:text-zinc-100">
                    <option>CPU Usage</option>
                    <option>Memory Usage</option>
                    <option>Disk Space</option>
                    <option>Service Status</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
                    Threshold
                  </label>
                  <div className="flex gap-2">
                    <select className="flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-[#121212] dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300 font-medium text-zinc-900 dark:text-zinc-100">
                      <option>Greater than</option>
                      <option>Less than</option>
                    </select>
                    <Input
                      type="number"
                      placeholder="80"
                      className="flex-1"
                    />
                    <div className="flex items-center justify-center px-3 bg-zinc-50 dark:bg-[#1A1A1A] border border-zinc-200 dark:border-zinc-800 rounded-md text-zinc-500 font-medium text-sm">
                      %
                    </div>
                  </div>
                </div>
                <div className="pt-2">
                  <Button variant="primary" className="w-full">
                    Create Alert
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Active Alerts</h3>
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {alert.status === "active" ? (
                      <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-100/50 dark:border-red-500/20 p-2.5 rounded-lg">
                        <Bell size={18} />
                      </div>
                    ) : (
                      <div className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100/50 dark:border-emerald-500/20 p-2.5 rounded-lg">
                        <CheckCircle size={18} />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-[15px] tracking-tight text-zinc-900 dark:text-white capitalize">
                        {alert.type} Alert
                      </p>
                      <p className="text-[13px] font-medium text-zinc-500">
                        Threshold: {alert.threshold}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md border ${alert.status === "active" ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-500/20" : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20"}`}
                  >
                    {alert.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  status,
}: {
  icon: any;
  label: string;
  value: string;
  subValue?: string;
  status: "good" | "warning" | "critical" | "normal";
}) {
  const getStatusColor = () => {
    if (status === "good") return "text-green-500";
    if (status === "warning") return "text-yellow-500";
    if (status === "critical") return "text-red-500";
    return "text-blue-500";
  };

  return (
    <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-zinc-500 uppercase font-semibold text-[11px] tracking-wider mb-2">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {value}
            </span>
            {subValue && (
              <span className="text-sm font-medium text-zinc-400">{subValue}</span>
            )}
          </div>
        </div>
        <div
          className={`p-2.5 rounded-xl bg-zinc-50 dark:bg-[#1A1A1A] border-zinc-100 dark:border-zinc-800 border bg-opacity-50 ${getStatusColor()}`}
        >
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#121212] border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl p-6 shadow-sm">
      <h3 className="font-semibold text-[15px] tracking-tight text-zinc-900 dark:text-zinc-50 mb-6">{title}</h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
