"use client";

import { useState } from "react";
import {
    RefreshCw,
    Download,
    Calendar,
    X,
    User as UserIcon,
    Search as InspectIcon,
    ChevronRight,
    Activity,
    Box,
    Info,
    Search,
} from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
import { cn } from "@/lib/utils";
import { AgGridReact } from "ag-grid-react";
import { themeQuartz, iconSetQuartzLight } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

// Configure custom Quartz theme
const myTheme = themeQuartz
    .withPart(iconSetQuartzLight)
    .withParams({
        backgroundColor: "#ffffff",
        browserColorScheme: "light",
        columnBorder: false,
        fontFamily: "Inter, Arial, sans-serif",
        foregroundColor: "rgb(46, 55, 66)",
        headerBackgroundColor: "#F9FAFB",
        headerFontSize: 14,
        headerFontWeight: 600,
        headerTextColor: "#919191",
        oddRowBackgroundColor: "#F9FAFB",
        rowBorder: false,
        sidePanelBorder: false,
        spacing: 8,
        wrapperBorder: false,
        wrapperBorderRadius: 0,
    });

interface ActivityLog {
    id: string;
    time: string;
    user: string;
    environment: string;
    action: string;
    payload: any;
}

// Simple recursive JSON tree viewer
const JsonTree = ({ data, level = 0 }: { data: any; level?: number }) => {
    if (typeof data !== "object" || data === null) {
        return (
            <span className={cn(
                "text-sm font-mono",
                typeof data === "string" ? "text-green-400" : "text-blue-400"
            )}>
                {typeof data === "string" ? `"${data}"` : String(data)}
            </span>
        );
    }

    return (
        <div className={cn("space-y-1", level > 0 && "ml-4 border-l border-zinc-800 pl-4")}>
            {Object.entries(data).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                    <div className="flex items-start gap-2 group">
                        <span className="text-zinc-500 font-mono text-sm">{key}:</span>
                        <JsonTree data={value} level={level + 1} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default function ActivityLogsPage() {
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState("");
    const [inspectingLog, setInspectingLog] = useState<ActivityLog | null>(null);

    const handleExport = () => {
        showNotification({
            type: "info",
            message: "Exporting logs",
            description: "Preparing your CSV file for download...",
        });
    };

    const logs: ActivityLog[] = [
        {
            id: "1",
            time: "2025-10-06 10:27:53",
            user: "admin",
            environment: "Portainer",
            action: "POST /endpoints",
            payload: {
                Name: "Production Cluster",
                URL: "tcp://10.0.0.1:2375",
                Type: 1,
                GroupId: 1,
                TLS: true,
                TLSConfig: {
                    SkipVerify: false,
                    CA: "----BEGIN CERTIFICATE----\n...",
                }
            }
        },
        {
            id: "2",
            time: "2025-10-06 10:27:52",
            user: "admin",
            environment: "Portainer",
            action: "POST /endpoints",
            payload: { Name: "Staging", URL: "tcp://10.0.0.2:2375" }
        },
        {
            id: "3",
            time: "2022-08-30 12:30:07",
            user: "admin",
            environment: "docker",
            action: "POST http://unixsocket/containers/create?name=ubuntu-utils",
            payload: {
                AttachStderr: false,
                AttachStdin: false,
                AttachStdout: false,
                Cmd: ["bash"],
                Domainname: "",
                Entrypoint: null,
                Env: ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"],
                ExposedPorts: {},
                HostConfig: {
                    AutoRemove: false,
                    Binds: [],
                    BlkioDeviceReadBps: null,
                    Hostname: "7bfd22998e7d",
                },
                Image: "registry.bespin.carppe.nz/james/ubuntu-utils:latest",
                Labels: {},
                NetworkingConfig: {
                    EndpointsConfig: { "object Object": {} }
                },
                Volumes: {},
                name: "ubuntu-utils"
            }
        }
    ];

    const colDefs: any[] = [
        {
            field: "time",
            headerName: "Time",
            sortable: true,
            filter: true,
            flex: 1.5,
            cellStyle: { fontFamily: 'monospace', color: '#666' }
        },
        {
            field: "user",
            headerName: "User",
            flex: 1,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-2 h-full">
                    <UserIcon size={12} className="text-zinc-400" />
                    <span className="font-medium text-zinc-700">{params.value}</span>
                </div>
            )
        },
        {
            field: "environment",
            headerName: "Environment",
            flex: 1,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-2 h-full">
                    <Box size={14} className="text-zinc-400" />
                    <span className="text-zinc-600 font-medium">{params.value}</span>
                </div>
            )
        },
        {
            field: "action",
            headerName: "Action",
            flex: 2,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-xs font-mono text-zinc-500 bg-zinc-50 px-2 py-0.5 rounded border border-zinc-200">
                        {params.value}
                    </span>
                </div>
            )
        },
        {
            field: "payload",
            headerName: "Payload",
            flex: 1,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <button
                        onClick={() => setInspectingLog(params.data)}
                        className="text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-1.5 text-xs font-bold group"
                    >
                        <InspectIcon size={14} className="group-hover:scale-110 transition-transform" /> inspect
                    </button>
                </div>
            )
        },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-10 h-full flex flex-col">
            <div className="flex items-center gap-2 flex-none">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    User activity logs <RefreshCw size={16} className="text-zinc-500 cursor-pointer hover:text-white transition-colors" />
                </h1>
            </div>

            {/* Header Info */}
            <div className="bg-[#1c1c1c] border border-zinc-800 rounded p-6 space-y-4 flex-none">
                <div className="flex items-center gap-4">
                    <span className="text-sm text-zinc-400">Date range</span>
                    <div className="relative flex-1 max-w-lg">
                        <div className="bg-[#121212] border border-zinc-800 rounded px-4 py-2 text-sm text-zinc-500 flex items-center justify-between">
                            ----/--/-- --:--:-- -- ▽ ----/--/-- --:--:-- --
                            <div className="flex items-center gap-2">
                                <X size={14} className="hover:text-white cursor-pointer" />
                                <Calendar size={14} className="hover:text-white cursor-pointer" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <Info size={12} className="text-blue-500" />
                    Portainer user activity logs have a maximum retention of 7 days.
                </div>
                <button
                    onClick={handleExport}
                    className="bg-[#1a1a1a] border border-zinc-800 hover:border-zinc-700 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all"
                >
                    <Download size={14} /> Export as CSV
                </button>
            </div>

            {/* AG Grid Section */}
            <div className="bg-[#1c1c1c] border border-zinc-800 rounded-sm flex-1 flex flex-col min-h-[500px] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex-none">
                    <div className="flex items-center gap-2">
                        <Activity size={16} className="text-blue-400" />
                        <span className="text-sm font-bold text-white uppercase tracking-wider">Activity logs</span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-[#121212] border border-zinc-800 rounded px-9 py-1.5 text-sm text-zinc-300 outline-none w-64 focus:border-zinc-700 transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 w-full overflow-hidden">
                    <AgGridReact
                        theme={myTheme}
                        rowData={logs}
                        columnDefs={colDefs}
                        quickFilterText={searchTerm}
                        pagination={true}
                        paginationPageSize={10}
                        paginationPageSizeSelector={[10, 20, 50]}
                        domLayout="normal"
                    />
                </div>
            </div>

            {/* Inspect Modal */}
            {inspectingLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-[#0f0f0f] border border-zinc-800 rounded shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                        {/* Header */}
                        <div className="px-6 py-4 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-between flex-none">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded">
                                    <InspectIcon size={18} className="text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-white">Inspect Action Payload</h2>
                                    <p className="text-[10px] text-zinc-500 font-mono">{inspectingLog.action}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setInspectingLog(null)}
                                className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors group"
                            >
                                <X size={20} className="text-zinc-500 group-hover:text-white" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                            <div className="flex items-center gap-2 mb-6 text-zinc-500 italic text-xs border-b border-zinc-800 pb-2">
                                <ChevronRight size={14} /> Object:
                            </div>
                            <div className="bg-[#121212] p-6 rounded border border-zinc-800 shadow-inner">
                                <JsonTree data={inspectingLog.payload} />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-zinc-900/30 border-t border-zinc-800 flex justify-end flex-none">
                            <button
                                onClick={() => setInspectingLog(null)}
                                className="px-6 py-2 rounded text-xs font-bold bg-zinc-800 text-white hover:bg-zinc-700 transition-all border border-zinc-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
