"use client";

import React, { useState } from "react";
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      onLogin();
    }, 300);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-6 h-6 text-zinc-950" />
            </div>
            <h1 className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">
              EINFRA.iO
            </h1>
          </div>
          <h2 className="text-xl font-bold text-zinc-800 dark:text-white mt-4">
            Log in to your account
          </h2>
          <p className="text-zinc-500 text-sm">
            Welcome back! Please enter your details
          </p>
        </div>

        {isLoading ? (
          <div className="bg-white dark:bg-(--grey-1) border border-zinc-200 dark:border-zinc-800 rounded-sm py-8 px-14 shadow-xl dark:shadow-2xl flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
              <span className="text-sm font-medium">
                Authentication in progress...
              </span>
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-(--grey-1) border border-zinc-200 dark:border-zinc-800 rounded-sm px-8 py-12 shadow-xl dark:shadow-2xl space-y-6 transition-all duration-300"
          >
            <div className="space-y-2">
              <label className="text-sm text-zinc-500 dark:text-zinc-100 tracking-wider ml-1">
                Username
              </label>
              <div className="relative group dark:bg-black rounded-sm">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5  text-zinc-400 dark:text-zinc-500 group-focus-within:text-white transition-colors" />
                <input
                  type="text"
                  required
                  placeholder="Enter your username"
                  className="
                    w-full
                    bg-black
                    border border-zinc-200 dark:border-zinc-800
                    rounded-sm
                    py-3 pl-12 pr-4
                    text-sm
                    text-zinc-900 dark:text-white
                    placeholder:text-zinc-400 dark:placeholder:text-zinc-600
                    focus:border-white
                    focus:ring-1 focus:ring-white
                    outline-none
                    transition-all
                  "
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-sm text-zinc-500 dark:text-zinc-100 tracking-wider ml-1">
                  Password
                </label>
              </div>
              <div className="relative group rounded-sm">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500 group-focus-within:text-white transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter your password"
                  className="w-full bg-black border border-zinc-200 dark:border-zinc-800 rounded-sm py-3 pl-12 pr-12 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-white focus:ring-1 focus:ring-white outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-white hover:cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white hover:bg-gray-200 text-zinc-900 font-bold py-2 px-4 cursor-pointer rounded-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-blue-500/20"
            >
              <span>Login</span>
              <ArrowRight
                size={18}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
