import { Shield, Lock, Activity, Users } from "lucide-react";

export function SampleCard() {
    return (
        <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-lg flex items-center gap-x-4 border border-slate-200 hover:border-blue-500 transition-colors">
            <div className="shrink-0">
                <Shield className="size-12 text-blue-600" />
            </div>
            <div>
                <div className="text-xl font-medium text-black">Security App</div>
                <p className="text-slate-500">System Monitoring & Access Control</p>
            </div>
        </div>
    );
}

export function StatGrid() {
    const stats = [
        { label: "Active Nodes", value: "124", icon: Activity, color: "text-green-500" },
        { label: "Alerts", value: "12", icon: Lock, color: "text-red-500" },
        { label: "Users", value: "850", icon: Users, color: "text-purple-500" },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {stats.map((stat) => (
                <div key={stat.label} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between">
                        <stat.icon className={`size-6 ${stat.color}`} />
                        <span className="text-2xl font-bold">{stat.value}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-2">{stat.label}</p>
                </div>
            ))}
        </div>
    );
}
