"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Copy,
  KeyRound,
  Mail,
  QrCode,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { useNotification } from "@/core/NotificationContext";
import {
  beginMFASetup,
  confirmMFASetup,
  requestMFAReset,
} from "@/features/authentication/api";
import { getStoredSession } from "@/features/authentication/auth-session";

export default function AuthenticationSettingsPage() {
  const { showNotification } = useNotification();
  const [sessionEmail, setSessionEmail] = useState("");
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [setupToken, setSetupToken] = useState("");
  const [secret, setSecret] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [otpAuthURL, setOtpAuthURL] = useState("");
  const [qrImage, setQRImage] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const session = getStoredSession();
    setSessionEmail(session?.user.email ?? "");
    setTotpEnabled(!!session?.user.totp_enabled);
  }, []);

  useEffect(() => {
    let active = true;
    if (!otpAuthURL) {
      setQRImage("");
      return;
    }
    void QRCode.toDataURL(otpAuthURL, {
      margin: 1,
      width: 320,
      color: {
        dark: "#0f172a",
        light: "#f8fafc",
      },
    })
      .then((dataURL) => {
        if (active) {
          setQRImage(dataURL);
        }
      })
      .catch(() => {
        if (active) {
          setQRImage("");
        }
      });
    return () => {
      active = false;
    };
  }, [otpAuthURL]);

  async function handleBeginSetup() {
    setIsLoading(true);
    try {
      const result = await beginMFASetup();
      setSetupToken(result.setup_token);
      setSecret(result.secret);
      setRecoveryCodes(result.recovery_codes);
      setOtpAuthURL(result.otpauth_url);
      setConfirmCode("");
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to start MFA setup",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirmSetup() {
    setIsLoading(true);
    try {
      await confirmMFASetup(setupToken, confirmCode);
      setTotpEnabled(true);
      showNotification({
        type: "success",
        message: "Authenticator enabled",
        description: "TOTP is now active for this account.",
      });
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to confirm MFA",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetRequest() {
    setIsLoading(true);
    try {
      const result = await requestMFAReset(sessionEmail);
      showNotification({
        type: "success",
        message: "Reset mail sent",
        description: result.message,
      });
    } catch (err) {
      showNotification({
        type: "error",
        message: "Unable to send reset mail",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showNotification({
        type: "success",
        message: `${label} copied`,
        description: "Saved to clipboard for quick paste.",
      });
    } catch {
      showNotification({
        type: "error",
        message: "Copy failed",
        description: `Unable to copy ${label.toLowerCase()}.`,
      });
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-8 text-white shadow-sm dark:border-zinc-800">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Account Security
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Authenticator and recovery controls
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Scan a real QR code with Google or Microsoft Authenticator, then
              keep the recovery codes safe for incident response.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Current state
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {totpEnabled ? "MFA Enabled" : "MFA Not Enabled"}
            </div>
            <div className="mt-1 text-sm text-slate-300">
              {sessionEmail || "No session email"}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                TOTP authenticator setup
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Scan the QR below, then confirm with the 6-digit code from your
                app.
              </p>
            </div>
          </div>

          {!setupToken ? (
            <div className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-950/50">
              <QrCode className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-600" />
              <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Generate a fresh MFA enrollment
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-500 dark:text-zinc-400">
                This creates a temporary setup token, shared secret and recovery
                codes for the current signed-in account.
              </p>
              <Button
                variant="primary"
                className="mt-6 shadow-lg shadow-indigo-500/20"
                onClick={handleBeginSetup}
                isLoading={isLoading}
              >
                Begin MFA Setup
              </Button>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-2xl border border-zinc-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/50">
                <div className="rounded-[1.5rem] bg-white p-4 shadow-sm dark:bg-[#121212]">
                  {qrImage ? (
                    <img
                      src={qrImage}
                      alt="Authenticator QR code"
                      className="mx-auto w-full max-w-72 rounded-xl"
                    />
                  ) : (
                    <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-600">
                      Preparing QR code...
                    </div>
                  )}
                </div>
                <div className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
                  Scan this code in Google Authenticator or Microsoft
                  Authenticator.
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      step: "01",
                      label: "Scan QR",
                      detail: "Open Google or Microsoft Authenticator.",
                    },
                    {
                      step: "02",
                      label: "Store codes",
                      detail: "Save recovery codes in a secure vault.",
                    },
                    {
                      step: "03",
                      label: "Confirm",
                      detail: "Enter the 6-digit code to activate MFA.",
                    },
                  ].map((item) => (
                    <div
                      key={item.step}
                      className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm dark:border-zinc-800 dark:bg-[#121212]"
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
                        {item.step}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {item.label}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {item.detail}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        Manual setup secret
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Use this only if camera scanning is unavailable.
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void copyText("Secret", secret)}
                      className="dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Copy
                    </Button>
                  </div>
                  <div className="mt-3 rounded-xl bg-white px-4 py-3 font-mono text-sm tracking-[0.2em] text-zinc-900 shadow-sm dark:bg-[#121212] dark:text-zinc-100">
                    {secret}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        Recovery codes
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        Each code works once when your authenticator is
                        unavailable.
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void copyText(
                          "Recovery codes",
                          recoveryCodes.join("\n"),
                         )
                      }
                      className="dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      Copy All
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {recoveryCodes.map((code) => (
                      <code
                        key={code}
                        className="rounded-xl bg-white px-3 py-2 text-center text-sm text-zinc-800 shadow-sm dark:bg-[#121212] dark:text-zinc-300"
                      >
                        {code}
                      </code>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#121212]">
                  <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Confirm setup code
                  </label>
                  <Input
                    value={confirmCode}
                    onChange={(event) => setConfirmCode(event.target.value)}
                    placeholder="Enter the 6-digit code from your authenticator"
                    className="mt-2"
                  />
                  <Button
                    variant="primary"
                    className="mt-4 w-full shadow-lg shadow-indigo-500/20"
                    onClick={handleConfirmSetup}
                    isLoading={isLoading}
                    disabled={confirmCode.trim().length < 6}
                  >
                    Confirm MFA
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-[#121212]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Recovery workflow
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Reset notifications go to the mailbox attached to this account.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/50">
            <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Account email
            </label>
            <Input
              value={sessionEmail}
              onChange={(event) => setSessionEmail(event.target.value)}
              placeholder="Account email"
              className="mt-2"
            />
            <Button
              variant="primary"
              className="mt-4 w-full shadow-lg shadow-indigo-500/20"
              onClick={handleResetRequest}
              isLoading={isLoading}
              disabled={!sessionEmail.trim()}
            >
              Send Authenticator Reset Mail
            </Button>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <KeyRound className="h-4 w-4 text-indigo-500" />
              What this security flow covers
            </div>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Password reset email with one-time token
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Authenticator reset email with one-time token
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                New login notification after successful sign-in
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Recovery codes for offline account regain
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 dark:border-cyan-500/20 dark:bg-cyan-500/10">
            <div className="text-sm font-semibold text-cyan-950 dark:text-cyan-50">
              Operator note
            </div>
            <div className="mt-2 text-sm leading-6 text-cyan-900 dark:text-cyan-100/70">
              MFA setup is generated from the live backend session. If you
              rotate authenticator apps, request a reset first instead of
              regenerating secrets in place.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
