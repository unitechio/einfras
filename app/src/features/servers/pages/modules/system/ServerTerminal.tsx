import { useMemo, useState } from "react";
import { Clock3, Maximize2, Minimize2, Play, RefreshCw, Terminal as TerminalIcon } from "lucide-react";
import { useParams } from "react-router-dom";

import { useNotification } from "@/core/NotificationContext";
import { terminalApi } from "@/shared/api/client";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";

export default function ServerTerminal() {
  const { serverId = "" } = useParams();
  const { showNotification } = useNotification();
  const [command, setCommand] = useState("uname -a");
  const [output, setOutput] = useState("Terminal is connected to the real backend command path.\nRun a command to inspect this node.");
  const [running, setRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [history, setHistory] = useState<string[]>(["uname -a", "hostnamectl", "systemctl --failed"]);
  const [selectedPreset, setSelectedPreset] = useState("uname -a");
  const presets = useMemo(
    () => [
      "uname -a",
      "hostnamectl",
      "df -h",
      "free -m",
      "systemctl --failed",
      "ip -brief address",
      "docker ps",
      "kubectl get nodes",
    ],
    [],
  );

  const runCommand = async () => {
    if (!serverId || !command.trim()) return;
    setRunning(true);
    try {
      const response = await terminalApi.exec(serverId, {
        command: command.trim(),
        timeout_sec: 30,
      });
      const commandRecord = response.command as { output_preview?: string } | undefined;
      const text =
        typeof response.raw_output === "string" && response.raw_output.trim()
          ? response.raw_output
          : commandRecord?.output_preview
            ? String(commandRecord.output_preview ?? "")
            : "Command completed with no visible output.";
      setOutput(text);
      setHistory((prev) => [command.trim(), ...prev.filter((item) => item !== command.trim())].slice(0, 12));
      } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed.";
      setOutput(message);
      showNotification({
        type: "error",
        message: "Terminal command failed",
        description: message,
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-[#09090b] text-zinc-100 shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 dark:border-zinc-800 ${isFullscreen ? "fixed inset-0 z-50 h-screen w-screen rounded-none" : "h-[600px] w-full"}`}>
      <div className="flex items-center justify-between border-b border-zinc-800/60 bg-white px-4 py-3 dark:bg-[#121212] select-none">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <div className="h-3 w-3 rounded-full border border-red-500/50 bg-red-500/20 shadow-inner" />
            <div className="h-3 w-3 rounded-full border border-yellow-500/50 bg-yellow-500/20 shadow-inner" />
            <div className="h-3 w-3 rounded-full border border-emerald-500/50 bg-emerald-500/20 shadow-inner" />
          </div>
          <div className="mx-2 h-4 w-px bg-zinc-100 dark:bg-zinc-800" />
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
            <TerminalIcon size={12} />
            <span>backend terminal exec</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${running ? "bg-yellow-900/30 text-yellow-400" : "bg-green-900/30 text-green-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${running ? "bg-yellow-400" : "bg-green-500"}`} />
            {running ? "running" : "ready"}
          </span>
          <button onClick={() => setOutput("")} className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:bg-zinc-800 dark:text-white">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setIsFullscreen((current) => !current)} className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:bg-zinc-800 dark:text-white">
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      <div className="border-b border-zinc-800 bg-zinc-950/90 px-4 py-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setSelectedPreset(preset);
                setCommand(preset);
              }}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                selectedPreset === preset
                  ? "border-blue-500 bg-blue-500/15 text-blue-300"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                void runCommand();
              }
            }}
            className="flex-1 border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
            placeholder="Enter command (Ctrl+Enter to run)"
          />
          <Button variant="primary" onClick={() => void runCommand()} isLoading={running}>
            <Play size={14} className="mr-2" />
            Run
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <pre className="h-full w-full overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-950 p-4 font-mono text-xs text-zinc-100">
          {output}
        </pre>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Clock3 size={14} />
            Recent Commands
          </div>
          <div className="space-y-2">
            {history.map((item) => (
              <button
                key={item}
                onClick={() => setCommand(item)}
                className="block w-full rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-left font-mono text-[11px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
