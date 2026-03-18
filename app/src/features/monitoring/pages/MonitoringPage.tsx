"use client";

import { MetricsDashboard } from '../components/MetricsDashboard';
import { Activity, Info } from 'lucide-react';
import { Button } from '@/shared/ui/Button';

export const MonitoringPage = () => (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                    <Activity className="h-6 w-6 text-indigo-500" />
                    System Monitoring
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Real-time observability and resource metrics across your infrastructure.</p>
            </div>
            
            <div className="flex items-center gap-2">
                <Button variant="outline" size="md">
                    Configure Alerts
                </Button>
            </div>
        </div>

        <MetricsDashboard />

        <div className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700/50 rounded-lg mt-8">
            <Info className="text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0 w-5 h-5" />
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                Detailed charts and historical metrics are temporarily unavailable while the new visualization engine is deployed. Stay tuned for advanced PromQL queries and Grafana integrations.
            </p>
        </div>
    </div>
);
