"use client";

import { Link } from "react-router-dom";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
    <nav aria-label="Breadcrumb" className={cn("flex", className)}>
      <ol className="flex items-center text-xs font-medium uppercase tracking-wider">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <span
                className="mx-2 text-zinc-300 dark:text-zinc-700"
                aria-hidden="true"
              >
                /
              </span>
            )}
            {item.path && !item.active ? (
              <Link
                to={item.path}
                className="text-zinc-500 dark:text-zinc-400 hover:text-blue-500 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  item.active
                    ? "text-zinc-900 dark:text-white font-bold"
                    : "text-zinc-500 dark:text-zinc-400",
                )}
                aria-current={item.active ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
