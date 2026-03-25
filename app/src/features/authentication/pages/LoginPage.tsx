"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EyeOff,
  Eye,
  AlertTriangle,
  ArrowRight,
  KeyRound,
  Lock,
  Mail,
  Shield,
  Smartphone,
  User,
  Cuboid,
  Moon,
  Sun,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/lib/utils";
import {
  settingsApi,
  type PublicLoginConfiguration,
} from "@/features/settings/api";
import {
  confirmMFAReset,
  login,
  loginWithTOTP,
  requestMFAReset,
  requestPasswordReset,
  resetPassword,
} from "../api";
import type { AuthSession } from "../auth-session";

interface LoginPageProps {
  onLogin: (session: AuthSession) => void | Promise<void>;
}

type Mode = "login" | "totp" | "forgot" | "reset" | "mfa-reset";

const ORGS = [{ id: "default", label: "default" }];

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("Admin123!");
  const [showPassword, setShowPassword] = useState(false);
  const [organizationID, setOrganizationID] = useState("default");
  const [totpCode, setTotpCode] = useState("");
  const [mfaToken, setMFAToken] = useState("");
  const [email, setEmail] = useState("admin@einfra.local");
  const [resetToken, setResetToken] = useState("");
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loginBanner, setLoginBanner] =
    useState<PublicLoginConfiguration | null>(null);
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    let active = true;
    void settingsApi
      .getPublicLoginConfiguration(organizationID || "default")
      .then((config) => {
        if (active) {
          setLoginBanner(config);
        }
      })
      .catch(() => {
        if (active) {
          setLoginBanner(null);
        }
      });
    return () => {
      active = false;
    };
  }, [organizationID]);

  const title = useMemo(() => {
    switch (mode) {
      case "totp":
        return "Verify your authenticator";
      case "forgot":
        return "Reset your password";
      case "reset":
        return "Apply new password";
      case "mfa-reset":
        return "Reset authenticator";
      default:
        return "Sign in to EINFRA";
    }
  }, [mode]);

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await login({
        identifier,
        password,
        organization_id: organizationID,
      });
      if (result.requiresMFA && result.mfaToken) {
        setMFAToken(result.mfaToken);
        setMode("totp");
        setMessage(
          "Enter the 6-digit code from Microsoft Authenticator or Google Authenticator.",
        );
        return;
      }
      if (result.session) {
        await new Promise((resolve) => window.setTimeout(resolve, 1400));
        await onLogin(result.session);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTOTPSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const session = await loginWithTOTP(mfaToken, totpCode);
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      await onLogin(session);
      return;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Authenticator verification failed",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await requestPasswordReset(email);
      setMessage(res.message);
      setMode("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request reset");
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await resetPassword(resetToken, resetPasswordValue);
      setMessage(res.message);
      setMode("login");
      setPassword("");
      setResetPasswordValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMFAReset(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      if (!resetToken) {
        const res = await requestMFAReset(email);
        setMessage(
          res.message + " Paste the emailed token below to complete the reset.",
        );
      } else {
        const res = await confirmMFAReset(resetToken);
        setMessage(res.message);
        setResetToken("");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to reset authenticator",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "relative min-h-screen overflow-hidden p-4 selection:bg-indigo-500/30",
        previewTheme === "dark" ? "dark bg-[#0A0A0A]" : "bg-zinc-50",
      )}
    >
      {/* Background Ambient Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 dark:bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-1/4 right-1/4 w-[28rem] h-[28rem] bg-emerald-500/20 dark:bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] dark:opacity-[0.05] pointer-events-none mix-blend-overlay" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1160px] flex-col justify-center">
        <div className="mb-6 flex justify-end">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/85 p-1 text-xs font-medium shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
            <button
              type="button"
              onClick={() => setPreviewTheme("light")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                previewTheme === "light"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
              )}
            >
              <Sun className="h-3.5 w-3.5" />
              Light
            </button>
            <button
              type="button"
              onClick={() => setPreviewTheme("dark")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                previewTheme === "dark"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
              )}
            >
              <Moon className="h-3.5 w-3.5" />
              Dark
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="relative w-14 h-14 mb-6 drop-shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-emerald-400 rounded-xl rotate-6 opacity-60 blur-md loading-pulse" />
            <div className="relative w-full h-full bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-xl flex items-center justify-center shadow-inner">
              <Shield className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-1.5">
            {title}
          </h1>
          <p className="text-[14px] text-zinc-500 dark:text-zinc-400">
            Log in to access your infrastructure workspace
          </p>
          <p className="mt-2 text-sm text-zinc-500  dark:text-zinc-400">
            Multi-tenant login with short-lived JWT, refresh token, TOTP and
            security notifications by email.
          </p>
        </div>
        <div className="flex justify-center py-10">
          {isLoading ? (
            <div className="mx-auto flex w-full max-w-[560px] flex-col items-center justify-center space-y-6 rounded-[28px] border border-zinc-200/70 bg-white/92 px-8 py-14 shadow-lg animate-in fade-in duration-500 dark:border-zinc-800/80 dark:bg-zinc-950/88">
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
                    <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-white">
                      Authenticating
                    </h3>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                      Establishing secure connection...
                    </p>
                    <p className="text-[12px] text-zinc-400 dark:text-zinc-500">
                      Verifying workspace, policies and notification channels.
                    </p>
                  </div>
            </div>
          ) : (
            <div
              className="w-full max-w-md rounded-2xl border border-zinc-200/60
            bg-white/90 px-6 py-6 shadow-lg
            dark:border-zinc-800/60 dark:bg-zinc-900/80"
            >
              <div className="space-y-5 px-2 py-1">
                <>
                  {message ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {message}
                    </div>
                  ) : null}

                  {error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  {mode === "login" && (
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <Field
                        label="Username or Email"
                        icon={<User className="w-4 h-4" />}
                      >
                        <input
                          value={identifier}
                          onChange={(e) => setIdentifier(e.target.value)}
                          className="w-full bg-transparent outline-none text-sm"
                          placeholder="admin or admin@einfra.local"
                          required
                        />
                      </Field>
                      <Field
                        label="Password"
                        icon={<Lock className="w-4 h-4" />}
                      >
                        <div className="relative w-full">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Your password"
                            required
                            className="w-full bg-transparent outline-none text-sm pr-9"
                          />

                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 flex items-center pr-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                            title={
                              showPassword ? "Hide password" : "Show password"
                            }
                          >
                            {showPassword ? (
                              <EyeOff size={15} />
                            ) : (
                              <Eye size={15} />
                            )}
                          </button>
                        </div>
                      </Field>
                      <Field
                        label="Organization Slug"
                        icon={<KeyRound className="w-4 h-4" />}
                      >
                        <input
                          list="org-options"
                          value={organizationID}
                          onChange={(e) => setOrganizationID(e.target.value)}
                          className="w-full bg-transparent outline-none text-sm"
                          placeholder="default"
                          required
                        />
                        <datalist id="org-options">
                          {ORGS.map((org) => (
                            <option key={org.id} value={org.id}>
                              {org.label}
                            </option>
                          ))}
                        </datalist>
                      </Field>
                      <Button
                        type="submit"
                        className="w-full h-12 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white flex items-center justify-center gap-2"
                        disabled={isLoading}
                      >
                        {isLoading ? "Signing in..." : "Sign In"}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </form>
                  )}

                  {mode === "totp" && (
                    <form onSubmit={handleTOTPSubmit} className="space-y-4">
                      <Field
                        label="Authenticator Code"
                        icon={<Smartphone className="w-4 h-4" />}
                      >
                        <input
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value)}
                          className="w-full bg-transparent outline-none text-sm tracking-[0.3em]"
                          placeholder="123456"
                          required
                        />
                      </Field>
                      <Button
                        type="submit"
                        className="w-full h-12 rounded-2xl bg-zinc-950 hover:bg-zinc-800 text-white"
                        disabled={isLoading}
                      >
                        {isLoading ? "Verifying..." : "Verify and Continue"}
                      </Button>
                    </form>
                  )}

                  {mode === "forgot" && (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <Field label="Email" icon={<Mail className="w-4 h-4" />}>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-transparent outline-none text-sm"
                          placeholder="admin@einfra.local"
                          required
                        />
                      </Field>
                      <Button
                        type="submit"
                        className="w-full h-12 rounded-2xl bg-zinc-950 text-white"
                        disabled={isLoading}
                      >
                        {isLoading ? "Sending..." : "Send Password Reset Mail"}
                      </Button>
                    </form>
                  )}

                  {mode === "reset" && (
                    <form onSubmit={handlePasswordReset} className="space-y-4">
                      <Field
                        label="Reset Token"
                        icon={<KeyRound className="w-4 h-4" />}
                      >
                        <input
                          value={resetToken}
                          onChange={(e) => setResetToken(e.target.value)}
                          className="w-full bg-transparent outline-none text-sm"
                          placeholder="Paste token from mail"
                          required
                        />
                      </Field>
                      <Field
                        label="New Password"
                        icon={<Lock className="w-4 h-4" />}
                      >
                        <input
                          type="password"
                          value={resetPasswordValue}
                          onChange={(e) =>
                            setResetPasswordValue(e.target.value)
                          }
                          className="w-full bg-transparent outline-none text-sm"
                          placeholder="Minimum 8 characters"
                          required
                        />
                      </Field>
                      <Button
                        type="submit"
                        className="w-full h-12 rounded-2xl bg-zinc-950 text-white"
                        disabled={isLoading}
                      >
                        {isLoading ? "Updating..." : "Update Password"}
                      </Button>
                    </form>
                  )}

                  {mode === "mfa-reset" && (
                    <form onSubmit={handleMFAReset} className="space-y-4">
                      <Field label="Email" icon={<Mail className="w-4 h-4" />}>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-transparent outline-none text-sm"
                          placeholder="admin@einfra.local"
                          required
                        />
                      </Field>
                      <Field
                        label="Reset Token"
                        icon={<Smartphone className="w-4 h-4" />}
                      >
                        <input
                          value={resetToken}
                          onChange={(e) => setResetToken(e.target.value)}
                          className="w-full bg-transparent outline-none text-sm"
                          placeholder="Leave empty to request mail first"
                        />
                      </Field>
                      <Button
                        type="submit"
                        className="w-full h-12 rounded-2xl bg-zinc-950 text-white"
                        disabled={isLoading}
                      >
                        {isLoading
                          ? "Processing..."
                          : resetToken
                            ? "Confirm Authenticator Reset"
                            : "Request Authenticator Reset Mail"}
                      </Button>
                    </form>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                    <MiniLink
                      label="Login"
                      active={mode === "login"}
                      onClick={() => setMode("login")}
                    />
                    <MiniLink
                      label="Forgot Password"
                      active={mode === "forgot"}
                      onClick={() => setMode("forgot")}
                    />
                    <MiniLink
                      label="Reset Authenticator"
                      active={mode === "mfa-reset"}
                      onClick={() => setMode("mfa-reset")}
                    />
                  </div>
                </>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
        {label}
      </span>
      <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-zinc-500 transition-colors focus-within:border-cyan-500 focus-within:bg-white dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400 dark:focus-within:bg-zinc-950">
        {icon}
        {children}
      </div>
    </label>
  );
}

function MiniLink({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2 text-sm transition-colors ${
        active
          ? "border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}
