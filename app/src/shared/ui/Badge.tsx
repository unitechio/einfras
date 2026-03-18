import { cn } from "@/lib/utils"
import React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "error" | "outline"
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
    success: "bg-green-100/50 text-green-700 dark:bg-green-500/10 dark:text-green-400 border border-green-200/50 dark:border-green-500/20",
    warning: "bg-yellow-100/50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 border border-yellow-200/50 dark:border-yellow-500/20",
    error: "bg-red-100/50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200/50 dark:border-red-500/20",
    outline: "text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold transition-colors uppercase tracking-wider",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
