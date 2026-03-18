"use client";

import React, { useState, useRef, useEffect } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface PopoverProps {
    trigger: React.ReactNode;
    content: React.ReactNode;
    align?: "left" | "right";
    className?: string;
}

export default function Popover({ trigger, content, align = "right", className }: PopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div className="relative" ref={popoverRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="cursor-pointer"
            >
                {trigger}
            </div>

            {isOpen && (
                <div className={cn(
                    "absolute top-full mt-2 z-50 min-w-[200px] rounded-lg border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200",
                    align === "right" ? "right-0" : "left-0",
                    className
                )}>
                    {content}
                </div>
            )}
        </div>
    );
}
