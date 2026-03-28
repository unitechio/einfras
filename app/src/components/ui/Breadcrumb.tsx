"use client";

import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  path?: string;
  active?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center select-none", className)}>
      <ol className="flex items-center gap-1 text-sm font-medium">
        <li className="flex items-center">
          <Link
            to="/"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all active:scale-95"
            title="Home"
          >
            <Home size={14} />
          </Link>
        </li>

        {items.map((item, index) => {
          // Skip if the item is just a root link that we've already covered with the Home icon
          if (index === 0 && (item.path === "/" || item.path === "")) {
            return null;
          }

          return (
            <li key={index} className="flex items-center gap-1 animate-in slide-in-from-left-2 fade-in duration-300" style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}>
              <ChevronRight
                size={13}
                className="text-zinc-300 dark:text-zinc-700 mx-0.5 shrink-0"
                aria-hidden="true"
              />
              {item.path && !item.active ? (
                <Link
                  to={item.path}
                  className="px-2 py-1 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-all active:scale-95 whitespace-nowrap"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    "px-2 py-1 whitespace-nowrap truncate max-w-[150px] md:max-w-[240px]",
                    item.active
                      ? "text-zinc-900 dark:text-zinc-50 font-bold"
                      : "text-zinc-400 dark:text-zinc-500 font-normal",
                  )}
                  aria-current={item.active ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
