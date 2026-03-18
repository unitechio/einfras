"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { CheckCircle2, AlertCircle, Clock, Construction } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function K8sStatusBadge({ status, className }: StatusBadgeProps) {
  const s = status.toLowerCase();
  
  if (s === "running" || s === "ready" || s === "active" || s === "succeeded") {
    return (
      <Badge variant="success" className={cn("px-2 py-0.5 border-none shadow-none bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-medium capitalize", className)}>
        <CheckCircle2 size={12} className="mr-1.5" />
        {status}
      </Badge>
    );
  }

  if (s === "pending" || s === "starting" || s === "reloading" || s === "creating") {
    return (
      <Badge variant="warning" className={cn("px-2 py-0.5 border-none shadow-none bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 font-medium capitalize", className)}>
        <Clock size={12} className="mr-1.5 animate-pulse" />
        {status}
      </Badge>
    );
  }

  if (s === "failed" || s === "notready" || s === "error" || s === "crashloopbackoff") {
    return (
      <Badge variant="error" className={cn("px-2 py-0.5 border-none shadow-none bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 font-medium capitalize", className)}>
        <AlertCircle size={12} className="mr-1.5" />
        {status}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn("px-2 py-0.5 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium capitalize", className)}>
      <Construction size={12} className="mr-1.5" />
      {status}
    </Badge>
  );
}
