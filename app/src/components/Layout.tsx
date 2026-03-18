"use client";

import React from "react";
import Sidebar from "./Sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {children}
                <footer className="h-10 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 text-[10px] font-medium text-zinc-500 dark:text-zinc-500 bg-white dark:bg-zinc-950/50 flex-shrink-0">
                    <div>&copy; 2026 EINFRA.io - All Rights Reserved</div>
                    <div className="flex items-center gap-4 uppercase tracking-tighter">
                        <a href="#" className="hover:text-blue-500">Documentation</a>
                        <a href="#" className="hover:text-blue-500">Support</a>
                        <a href="#" className="hover:text-blue-500 font-bold">v1.2.4-stable</a>
                    </div>
                </footer>
            </div>
        </div>
    );
}
