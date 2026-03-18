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
} from "lucide-react";

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            System Monitoring
          </h2>
          <p className="text-zinc-500 text-sm">
            Realtrack resource usage and system health.
          </p>
        </div>
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${activeTab === "overview" ? "bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("alerts")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${activeTab === "alerts" ? "bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"}`}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="CPU Usage History">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#333"
                  opacity={0.1}
                />
                <XAxis dataKey="name" fontSize={12} stroke="#888" />
                <YAxis fontSize={12} stroke="#888" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#27272a",
                    color: "#fff",
                  }}
                  itemStyle={{ color: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="cpu"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorCpu)"
                />
              </AreaChart>
            </ChartCard>

            <ChartCard title="Memory Usage">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#333"
                  opacity={0.1}
                />
                <XAxis dataKey="name" fontSize={12} stroke="#888" />
                <YAxis fontSize={12} stroke="#888" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#27272a",
                    color: "#fff",
                  }}
                  itemStyle={{ color: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="ram"
                  stroke="#8b5cf6"
                  fillOpacity={1}
                  fill="url(#colorRam)"
                />
              </AreaChart>
            </ChartCard>

            <ChartCard title="Network I/O">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#333"
                  opacity={0.1}
                />
                <XAxis dataKey="name" fontSize={12} stroke="#888" />
                <YAxis fontSize={12} stroke="#888" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#27272a",
                    color: "#fff",
                  }}
                  itemStyle={{ color: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorNet)"
                />
              </AreaChart>
            </ChartCard>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm">
              <h3 className="font-bold text-zinc-900 dark:text-white mb-6">
                Disk Usage per Mount
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={diskData}
                    layout="vertical"
                    margin={{ left: 40 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#333"
                      opacity={0.1}
                    />
                    <XAxis type="number" fontSize={12} stroke="#888" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={80}
                      fontSize={12}
                      stroke="#888"
                    />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      contentStyle={{
                        backgroundColor: "#18181b",
                        borderColor: "#27272a",
                        color: "#fff",
                      }}
                      itemStyle={{ color: "#fff" }}
                    />
                    <Bar
                      dataKey="used"
                      fill="#f59e0b"
                      radius={[0, 4, 4, 0]}
                      barSize={20}
                    />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Security / Alert Config Mock UI */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6">
              <h3 className="font-bold mb-4">New Alert Rule</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Resource
                  </label>
                  <select className="w-full p-2 rounded border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                    <option>CPU Usage</option>
                    <option>Memory Usage</option>
                    <option>Disk Space</option>
                    <option>Service Status</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Threshold
                  </label>
                  <div className="flex gap-2">
                    <select className="p-2 rounded border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                      <option>Greater than</option>
                      <option>Less than</option>
                    </select>
                    <input
                      type="number"
                      placeholder="80"
                      className="flex-1 p-2 rounded border bg-transparent border-zinc-200 dark:border-zinc-800"
                    />
                    <span className="p-2 text-zinc-500">%</span>
                  </div>
                </div>
                <button className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
                  {/*<button className="w-full  bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-700 px-4 py-2 rounded-sm text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95">*/}
                  Create Alert
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold">Active Alerts</h3>
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm"
                >
                  <div className="flex items-center gap-3">
                    {alert.status === "active" ? (
                      <div className="text-red-500 bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                        <Bell size={16} />
                      </div>
                    ) : (
                      <div className="text-green-500 bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                        <CheckCircle size={16} />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-white capitalize">
                        {alert.type} Alert
                      </p>
                      <p className="text-xs text-zinc-500">
                        Threshold: {alert.threshold}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${alert.status === "active" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
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
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-sm shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-zinc-500 text-xs uppercase font-medium">{label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">
              {value}
            </span>
            {subValue && (
              <span className="text-sm text-zinc-400">{subValue}</span>
            )}
          </div>
        </div>
        <div
          className={`p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 ${getStatusColor()}`}
        >
          <Icon size={20} />
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
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-6 shadow-sm">
      <h3 className="font-bold text-zinc-900 dark:text-white mb-6">{title}</h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children as any}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
