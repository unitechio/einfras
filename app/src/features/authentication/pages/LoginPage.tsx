"use client";

import React, { useState } from "react";
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Server,
  Cloud,
  Cuboid
} from "lucide-react";
import { Button } from "@/shared/ui/Button";

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Fake loading delay to show off the fancy animation
    setTimeout(() => {
      onLogin();
    }, 2500);
  };

  return (
    <div className="relative min-h-screen bg-zinc-50 dark:bg-[#0A0A0A] flex flex-col items-center justify-center p-4 selection:bg-indigo-500/30 overflow-hidden">
      {/* Background Ambient Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 dark:bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-1/4 right-1/4 w-[28rem] h-[28rem] bg-emerald-500/20 dark:bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] dark:opacity-[0.05] pointer-events-none mix-blend-overlay" />

      <div className="w-full max-w-[420px] z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Logo & Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-14 h-14 mb-6 drop-shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-emerald-400 rounded-xl rotate-6 opacity-60 blur-md loading-pulse" />
            <div className="relative w-full h-full bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-xl flex items-center justify-center shadow-inner">
              <Shield className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-1.5">
            Welcome to EINFRA
          </h1>
          <p className="text-[14px] text-zinc-500 dark:text-zinc-400">
            Log in to access your infrastructure workspace
          </p>
        </div>

        {/* Main Card */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-b from-zinc-200 to-zinc-100 dark:from-zinc-800/80 dark:to-zinc-900 rounded-[22px] blur opacity-50 transition duration-500 group-hover:opacity-100" />
          
          <div className="relative bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-[20px] shadow-2xl overflow-hidden p-8 transition-all">
            
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-500">
                {/* Custom Characteristic Project Animation */}
                <div className="relative w-16 h-16">
                  {/* Orbiting Elements */}
                  <div className="absolute inset-0 border-[2px] border-zinc-100 dark:border-zinc-800 rounded-full" />
                  <div className="absolute inset-0 border-[2px] border-indigo-500 border-t-transparent border-l-transparent rounded-full animate-spin [animation-duration:1.5s]" />
                  <div className="absolute inset-2 border-[2px] border-zinc-100 dark:border-zinc-800 rounded-full" />
                  <div className="absolute inset-2 border-[2px] border-emerald-500 border-b-transparent border-r-transparent rounded-full animate-spin [animation-duration:2s] [animation-direction:reverse]" />
                  
                  {/* Center Pulse Icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Cuboid className="w-5 h-5 text-zinc-900 dark:text-white animate-pulse" />
                  </div>
                </div>
                
                <div className="text-center space-y-1">
                  <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-white">Authenticating</h3>
                  <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Establishing secure connection...</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in zoom-in-95 duration-300">
                
                {/* Inputs */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 pl-1">
                      Username or Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="admin"
                        className="block w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-[#0f0f0f] border border-zinc-200 dark:border-zinc-800/80 rounded-xl text-[14px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between pl-1 pr-1">
                      <label className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">
                        Password
                      </label>
                      <button type="button" className="text-[12px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors">
                        Recover access
                      </button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        className="block w-full pl-10 pr-11 py-2.5 bg-zinc-50 dark:bg-[#0f0f0f] border border-zinc-200 dark:border-zinc-800/80 rounded-xl text-[14px] font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full h-11 text-[14px] font-semibold bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all flex items-center justify-center gap-2 group"
                  >
                    <span>Authenticate</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform opacity-70" />
                  </Button>
                </div>
                
              </form>
            )}
          </div>
        </div>
        
        {/* Footer info */}
        <div className="mt-8 flex items-center justify-center gap-6 text-[12px] font-medium text-zinc-400 dark:text-zinc-500">
          <span className="flex items-center gap-1.5 hover:text-zinc-600 dark:hover:text-zinc-400 cursor-pointer transition-colors"><Server size={13}/> System Status</span>
          <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></span>
          <span className="flex items-center gap-1.5 hover:text-zinc-600 dark:hover:text-zinc-400 cursor-pointer transition-colors"><Cloud size={13}/> SaaS Version</span>
        </div>
      </div>
    </div>
  );
}
