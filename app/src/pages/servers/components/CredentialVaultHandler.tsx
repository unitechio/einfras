import { useState, useEffect } from "react";
import { Key, Lock, FileKey, Upload, Eye, EyeOff, Shield } from "lucide-react";

type CredentialType = "password" | "privateKey" | "token";
type InputMethod = "vault" | "manual" | "file";

interface CredentialValue {
    method: InputMethod;
    value: string;
    vaultId?: string;
    filename?: string;
}

interface CredentialVaultHandlerProps {
    type: CredentialType;
    label?: string;
    onChange: (value: CredentialValue) => void;
    className?: string;
}

export default function CredentialVaultHandler({
    type,
    label,
    onChange,
    className = "",
}: CredentialVaultHandlerProps) {
    const [method, setMethod] = useState<InputMethod>("manual");
    const [value, setValue] = useState("");
    const [showSecret, setShowSecret] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [fileName, setFileName] = useState("");

    // Mock Vault Items
    const vaultItems = [
        { id: "v1", name: "Prod SSH Key (2024)", type: "privateKey" },
        { id: "v2", name: "Dev Database Password", type: "password" },
        { id: "v3", name: "Agent Install Token (Global)", type: "token" },
        { id: "v4", name: "AWS East Keypair", type: "privateKey" },
    ].filter((item) => item.type === type);

    useEffect(() => {
        onChange({ method, value, filename: fileName });
    }, [method, value, fileName]);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            setFileName(file.name);
            setValue("file_content_placeholder"); // In real app, read file
        }
    };

    return (
        <div className={`space-y-3 ${className}`}>
            {label && (
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                    {type === "password" && <Lock size={14} />}
                    {type === "privateKey" && <Key size={14} />}
                    {type === "token" && <Shield size={14} />}
                    {label}
                </label>
            )}

            {/* Input Method Tabs */}
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-md mb-2 w-fit">
                <button
                    onClick={() => setMethod("manual")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-all ${method === "manual"
                            ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white"
                            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        }`}
                >
                    Manual Input
                </button>
                <button
                    onClick={() => setMethod("vault")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-all flex items-center gap-1.5 ${method === "vault"
                            ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600 dark:text-blue-400"
                            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                        }`}
                >
                    <Lock size={12} /> Vault
                </button>
                {type === "privateKey" && (
                    <button
                        onClick={() => setMethod("file")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-all flex items-center gap-1.5 ${method === "file"
                                ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white"
                                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                            }`}
                    >
                        <Upload size={12} /> Upload File
                    </button>
                )}
            </div>

            {/* Manual Input */}
            {method === "manual" && (
                <div className="relative">
                    {type === "privateKey" ? (
                        <textarea
                            rows={4}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-xs"
                            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                        />
                    ) : (
                        <div className="relative">
                            <input
                                type={showSecret ? "text" : "password"}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-2.5 pr-10 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-sm"
                                placeholder={type === "token" ? "Enter agent token..." : "Enter password..."}
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                onClick={() => setShowSecret(!showSecret)}
                            >
                                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    )}
                    <p className="text-[10px] text-orange-500 mt-1 flex items-center gap-1">
                        <EyeOff size={10} /> Not recommended for production keys. Use Vault instead.
                    </p>
                </div>
            )}

            {/* Vault Selection */}
            {method === "vault" && (
                <div className="space-y-2">
                    <select
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-sm px-4 py-2.5 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm appearance-none cursor-pointer"
                        onChange={(e) => setValue(e.target.value)}
                    >
                        <option value="">Select credential from vault...</option>
                        {vaultItems.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-sm border border-blue-100 dark:border-blue-900/30 text-xs text-blue-700 dark:text-blue-300">
                        <strong>Secure Storage:</strong> Credentials in vault are encrypted at rest and never exposed in plaintext.
                    </div>
                </div>
            )}

            {/* File Upload */}
            {method === "file" && (
                <div
                    className={`border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${dragActive
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50"
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => {
                        // Mock file dialog would go here
                    }}
                >
                    {fileName ? (
                        <div className="flex flex-col items-center gap-2">
                            <FileKey size={32} className="text-green-500" />
                            <span className="font-bold text-zinc-900 dark:text-white text-sm">{fileName}</span>
                            <span className="text-xs text-zinc-500">Click or drag to replace</span>
                        </div>
                    ) : (
                        <>
                            <Upload size={24} className="text-zinc-400 mb-2" />
                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                Drag SSH Key file here
                            </p>
                            <p className="text-xs text-zinc-500 mt-1">
                                or click to browse
                            </p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
