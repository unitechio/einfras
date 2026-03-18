"use client";

import { useState } from "react";
import {
    RefreshCw,
    Download,
    Info,
    CheckCircle2,
    XCircle,
    Calendar,
    User as UserIcon,
    Globe,
    Database,
    Search,
} from "lucide-react";
import { useNotification } from "@/core/NotificationContext";
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

interface AuthEvent {
    id: string;
    time: string;
    origin: string;
    context: string;
    user: string;
    result: "success" | "failure";
}

export default function AuthLogsPage() {
    const { showNotification } = useNotification();
    const [searchTerm, setSearchTerm] = useState("");
    const [dateRange] = useState("Last 7 days");

    const events: AuthEvent[] = [
        {
            id: "1",
            time: "2024-03-19 11:59:40",
            origin: "192.168.18.131",
            context: "Internal",
            user: "admin",
            result: "success",
        },
        {
            id: "2",
            time: "2024-03-18 21:42:15",
            origin: "192.168.18.131",
            context: "Internal",
            user: "admin",
            result: "success",
        },
        {
            id: "3",
            time: "2024-03-18 12:36:32",
            origin: "192.168.18.131",
            context: "Internal",
            user: "admin",
            result: "success",
        },
        {
            id: "4",
            time: "2024-03-17 09:15:10",
            origin: "10.0.0.45",
            context: "LDAP",
            user: "j.doe",
            result: "failure",
        },
        {
            id: "5",
            time: "2024-03-17 08:30:22",
            origin: "192.168.1.102",
            context: "Internal",
            user: "guest_user",
            result: "failure",
        }
    ];

    const handleExport = () => {
        showNotification({
            type: "info",
            message: "Exporting logs",
            description: "Preparing your CSV file for download...",
        });
    };

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
            field: "origin",
            headerName: "Origin",
            flex: 1,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-2 h-full">
                    <Globe size={14} className="text-zinc-400" />
                    <span>{params.value}</span>
                </div>
            )
        },
        {
            field: "context",
            headerName: "Context",
            flex: 1,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-2 h-full">
                    <Database size={14} className="text-zinc-400" />
                    <span>{params.value}</span>
                </div>
            )
        },
        {
            field: "user",
            headerName: "User",
            flex: 1,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-2 h-full">
                    <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center border border-zinc-200">
                        <UserIcon size={12} className="text-zinc-500" />
                    </div>
                    <span className="font-bold text-zinc-700">{params.value}</span>
                </div>
            )
        },
        {
            field: "result",
            headerName: "Result",
            flex: 1.5,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-2 h-full">
                    {params.value === "success" ? (
                        <>
                            <span className="text-zinc-500">Authentication success</span>
                            <CheckCircle2 size={16} className="text-green-500" />
                        </>
                    ) : (
                        <>
                            <span className="text-red-500 font-medium">Authentication failed</span>
                            <XCircle size={16} className="text-red-500" />
                        </>
                    )}
                </div>
            )
        },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
            <div className="flex items-center gap-2 flex-none">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    User Activity <RefreshCw size={16} className="text-zinc-500 cursor-pointer hover:text-white transition-colors" />
                </h1>
            </div>

            {/* Filter Section */}
            <div className="bg-[#1c1c1c] border border-zinc-800 rounded p-6 space-y-4 flex-none">
                <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                    <label className="text-sm text-zinc-400">Date Range</label>
                    <div className="relative max-w-lg">
                        <input
                            readOnly
                            value={dateRange}
                            className="w-full bg-[#121212] border border-zinc-800 rounded px-4 py-2 text-sm text-zinc-300 outline-none cursor-pointer"
                        />
                        <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    </div>
                </div>

                <div className="flex items-start gap-4 py-1">
                    <div className="p-1 bg-blue-500/10 rounded">
                        <Info size={14} className="text-blue-400" />
                    </div>
                    <p className="text-xs text-zinc-500 max-w-2xl leading-relaxed">
                        Portainer user authentication activity logs have a maximum retention of 7 days.
                    </p>
                </div>

                <button
                    onClick={handleExport}
                    className="bg-[#0070f3] hover:bg-[#0061d1] text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                >
                    <Download size={14} /> Export as CSV
                </button>
            </div>

            {/* AG Grid Section */}
            <div className="bg-[#1c1c1c] border border-zinc-800 rounded-sm flex-1 flex flex-col min-h-[500px] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-500/10 rounded-full">
                            <CheckCircle2 size={16} className="text-blue-400" />
                        </div>
                        <span className="text-sm font-bold text-white">Authentication Events</span>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-[#121212] border border-zinc-800 rounded px-9 py-1.5 text-sm text-zinc-300 focus:border-zinc-700 outline-none w-64 transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 w-full overflow-hidden">
                    <AgGridReact
                        theme={myTheme}
                        rowData={events}
                        columnDefs={colDefs}
                        quickFilterText={searchTerm}
                        pagination={true}
                        paginationPageSize={10}
                        paginationPageSizeSelector={[10, 20, 50]}
                        domLayout="normal"
                    />
                </div>
            </div>
        </div>
    );
}
