"use client";

import { Shield } from "lucide-react";

export default function LoadingPage() {
  return (
    <div className="fixed inset-0 bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center z-50 transition-colors duration-300">
      <div className="flex flex-col items-center gap-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-2xl shadow-blue-500/20">
            <Shield className="w-6 h-6 text-zinc-950" />
          </div>
          <h1 className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">
            EINFRA.iO
          </h1>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="text-zinc-500 dark:text-zinc-400 text-sm font-medium tracking-widest uppercase">
            Loading Einfra Environment...
          </div>
          <div className="w-48 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-white animate-[loading_2s_ease-in-out_infinite]"></div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 text-zinc-400 dark:text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em]">
        Enterprise Infrastructure Platform &copy; 2026
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes loading {
          0% { width: 0%; transform: translateX(-100%); }
          50% { width: 40%; transform: translateX(100%); }
          100% { width: 0%; transform: translateX(300%); }
        }
      `,
        }}
      />
    </div>
  );
}
