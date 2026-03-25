"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface Environment {
    id: string;
    serverId?: string;
    name: string;
    type: "docker" | "kubernetes";
    status: "up" | "down";
    url: string;
    selfHost?: boolean;
    os?: string;
    arch?: string;
    lastSeen?: string;
    cpuCores?: number;
    memoryGB?: number;
    diskGB?: number;
    cpuPercent?: number;
    memPercent?: number;
    diskPercent?: number;
    stats?: {
        stacks?: number;
        containers?: number;
        images?: number;
        volumes?: number;
        nodes?: number;
        readyNodes?: number;
        namespaces?: number;
        pods?: number;
        serverVersion?: string;
        storageDriver?: string;
        kernelVersion?: string;
        dockerRootDir?: string;
        memTotal?: number;
        currentContext?: string;
        operatingSystem?: string;
    };
}

interface EnvironmentContextType {
    selectedEnvironment: Environment | null;
    setSelectedEnvironment: (env: Environment | null) => void;
    isEnvironmentMode: boolean;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(
    undefined,
);

export function EnvironmentProvider({ children }: { children: React.ReactNode }) {
    const [selectedEnvironment, setSelectedEnvironmentState] =
        useState<Environment | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("selectedEnvironment");
            if (saved) {
                try {
                    setSelectedEnvironmentState(JSON.parse(saved));
                } catch (e) {
                    console.error("Failed to parse saved environment", e);
                }
            }
        }
    }, []);

    const setSelectedEnvironment = (env: Environment | null) => {
        setSelectedEnvironmentState(env);
        if (env) {
            localStorage.setItem("selectedEnvironment", JSON.stringify(env));
        } else {
            localStorage.removeItem("selectedEnvironment");
        }
    };

    return (
        <EnvironmentContext.Provider
            value={{
                selectedEnvironment,
                setSelectedEnvironment,
                isEnvironmentMode: !!selectedEnvironment,
            }}
        >
            {children}
        </EnvironmentContext.Provider>
    );
}

export function useEnvironment() {
    const context = useContext(EnvironmentContext);
    if (context === undefined) {
        throw new Error("useEnvironment must be used within an EnvironmentProvider");
    }
    return context;
}
